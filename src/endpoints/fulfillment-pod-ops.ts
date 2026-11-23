/**
 * Model A Print-on-Demand (POD) Fulfillment Endpoints — /api/fulfillment-ops/pod/*
 *
 * Creator-owned Printful (OAuth 2.0 + Private API Token) & Printify integration:
 *   - GET  /fulfillment-ops/pod/status             (sanitized status + webhook URL)
 *   - GET|POST /fulfillment-ops/pod/printful/connect  (OAuth init OR Private Token save)
 *   - GET  /fulfillment-ops/pod/printful/callback  (OAuth 2.0 callback)
 *   - POST /fulfillment-ops/pod/printify/connect   (Printify API Token + Shop ID save)
 *   - POST /fulfillment-ops/pod/disconnect         (remove encrypted POD credentials)
 *   - POST /fulfillment-ops/pod/settings           (autoConfirm, packingSlip, activeProvider)
 *   - POST /fulfillment-ops/pod/sync               (sync Printful/Printify merch -> Products)
 *   - POST /fulfillment-ops/pod/shipping-rates     (live checkout rate estimator)
 *   - POST /fulfillment-ops/pod/webhooks/printful  (tracking & fulfillment updates)
 *   - POST /fulfillment-ops/pod/webhooks/printify  (HMAC verified tracking updates)
 */
import crypto from 'node:crypto'
import type { Payload, PayloadHandler } from 'payload'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
import { getServerSideURL } from '@/utilities/getURL'
import { logError } from '@/utilities/logError'
import { originFromHeaderValues } from '@/utilities/originFromHeaders'
import {
  disconnectPODAccount,
  getConnectedPODCredentials,
  getPlatformPrintfulOAuthEnv,
  getTenantPODSettings,
  isPrintfulOAuthConfigured,
  sanitizePODSettingsForClient,
  saveConnectedPrintfulAccount,
  saveConnectedPrintifyAccount,
  saveTenantPODSettings,
} from '@/lib/fulfillment/config'
import {
  buildPrintfulAuthorizeUrl,
  exchangePrintfulOAuthCode,
  fetchPrintfulShippingRates,
  fetchPrintfulSyncProducts,
  parsePrintfulWebhookEvent,
  refreshPrintfulTokenIfNeeded,
  registerPrintfulWebhook,
  verifyPrintfulConnection,
  verifyPrintfulWebhookSignature,
} from '@/lib/fulfillment/providers/printful'
import {
  fetchPrintifyProducts,
  fetchPrintifyShippingRates,
  parsePrintifyWebhookEvent,
  verifyPrintifyConnection,
  verifyPrintifyWebhookSignature,
} from '@/lib/fulfillment/providers/printify'
import type {
  PODNormalizedWebhookEvent,
  PODProviderId,
  PODRecipientAddress,
  PODShippingRateRequestItem,
  PODSyncProduct,
} from '@/lib/fulfillment/types'

function resolveOriginFromReq(req: Parameters<PayloadHandler>[0]): string {
  const host = req.headers?.get?.('x-forwarded-host') || req.headers?.get?.('host')
  const proto = req.headers?.get?.('x-forwarded-proto')
  return host ? originFromHeaderValues(host, proto) : getServerSideURL()
}

export function signPODOAuthState(payloadObj: Record<string, unknown>): string {
  const secret = process.env.PAYLOAD_SECRET || process.env.ENCRYPTION_SECRET || 'angel-os-pod-oauth'
  const b64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

export function verifyPODOAuthState(stateRaw: string): Record<string, unknown> | null {
  const parts = stateRaw.split('.')
  if (parts.length !== 2) return null
  const [b64, sig] = parts
  if (!b64 || !sig) return null
  const secret = process.env.PAYLOAD_SECRET || process.env.ENCRYPTION_SECRET || 'angel-os-pod-oauth'
  const expected = crypto.createHmac('sha256', secret).update(b64).digest('base64url')
  const a = Uint8Array.from(Buffer.from(sig))
  const b = Uint8Array.from(Buffer.from(expected))
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(Buffer.from(b64, 'base64url').toString('utf-8')) as Record<
      string,
      unknown
    >
    const ts = Number(parsed.ts || 0)
    if (ts && Date.now() - ts > 25 * 60 * 1000) return null
    return parsed
  } catch {
    return null
  }
}

async function resolveTenantIdFromRequest(
  req: Parameters<PayloadHandler>[0],
  body?: Record<string, unknown>,
): Promise<number | string | null> {
  const url = new URL(req.url || '', 'http://localhost')
  const explicitId =
    body?.tenantId ?? url.searchParams.get('tenantId')
  if (explicitId != null && String(explicitId).trim() !== '') {
    const num = Number(explicitId)
    return Number.isFinite(num) ? num : String(explicitId).trim()
  }

  const slug =
    (typeof body?.tenantSlug === 'string' && body.tenantSlug) ||
    url.searchParams.get('tenant') ||
    req.headers?.get?.('x-tenant-id') ||
    ''

  if (slug && slug !== 'default') {
    const res = await req.payload.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (res.docs?.[0]?.id != null) {
      return res.docs[0].id
    }
  }

  return null
}

async function userCanManageTenant(
  req: Parameters<PayloadHandler>[0],
  tenantId: number | string,
): Promise<boolean> {
  if (!req.user) return false
  const roles = ((req.user as { roles?: string[] }).roles) || []
  if (roles.includes('super_admin')) return true
  const memberships = await req.payload.find({
    collection: 'tenant-memberships',
    where: {
      and: [
        { user: { equals: req.user.id } },
        { tenant: { equals: tenantId } },
        { status: { equals: 'active' } },
        { role: { in: ['tenant_admin', 'tenant_manager'] } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return memberships.docs.length > 0
}

function buildWebhookUrl(
  origin: string,
  provider: PODProviderId,
  tenantId: number | string,
  webhookSecret?: string,
): string {
  const u = new URL(`${origin.replace(/\/+$/, '')}/api/fulfillment-ops/pod/webhooks/${provider}`)
  u.searchParams.set('tenantId', String(tenantId))
  if (webhookSecret) u.searchParams.set('token', webhookSecret)
  return u.toString()
}

function slugifyProduct(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

async function downloadProductPreviewMedia(
  payload: Payload,
  tenantId: number | string,
  imageUrl: string,
  altMarker: string,
  title: string,
): Promise<number | string | null> {
  if (!imageUrl || !imageUrl.startsWith('http')) return null
  try {
    const existing = await payload.find({
      collection: 'media',
      where: { and: [{ tenant: { equals: tenantId } }, { alt: { equals: altMarker } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.docs?.[0]?.id != null) {
      return existing.docs[0].id
    }

    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || 'image/png'
    if (!contentType.startsWith('image/')) return null
    const arrayBuf = await res.arrayBuffer()
    if (arrayBuf.byteLength === 0 || arrayBuf.byteLength > 8 * 1024 * 1024) return null

    const ext = contentType.includes('jpeg') || contentType.includes('jpg')
      ? 'jpg'
      : contentType.includes('webp')
        ? 'webp'
        : 'png'
    const safeName = `${slugifyProduct(altMarker) || 'pod-product'}.${ext}`

    const created = await payload.create({
      collection: 'media',
      data: {
        alt: altMarker || title,
        tenant: Number(tenantId) as never,
      } as never,
      file: {
        data: Buffer.from(arrayBuf),
        mimetype: contentType.split(';')[0] || 'image/png',
        name: safeName,
        size: arrayBuf.byteLength,
      },
      overrideAccess: true,
    })
    return created?.id ?? null
  } catch {
    return null
  }
}

async function syncPODProductsIntoCatalog(
  payload: Payload,
  tenantId: number | string,
  podProducts: PODSyncProduct[],
): Promise<{
  created: number
  updated: number
  synced: Array<{ id: number | string; title: string; slug: string; variantCount: number }>
}> {
  let created = 0
  let updated = 0
  const synced: Array<{ id: number | string; title: string; slug: string; variantCount: number }> = []
  const nowIso = new Date().toISOString()

  for (const podProd of podProducts) {
    const slug = `pod-${podProd.provider}-${slugifyProduct(podProd.externalProductId)}`
    const positivePrices = podProd.variants
      .map((v) => v.retailPriceCents)
      .filter((p) => Number.isFinite(p) && p > 0)
    const basePriceCents = positivePrices.length > 0 ? Math.min(...positivePrices) : 2500

    const existingRes = await payload.find({
      collection: 'products',
      where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const existing = existingRes.docs?.[0] as
      | { id: number | string; _status?: string; gallery?: Array<{ image: unknown }> }
      | undefined

    const altMarker = `pod-img-${podProd.provider}-${podProd.externalProductId}`
    let gallery = existing?.gallery
    if ((!gallery || gallery.length === 0) && podProd.thumbnailUrl) {
      const mediaId = await downloadProductPreviewMedia(
        payload,
        tenantId,
        podProd.thumbnailUrl,
        altMarker,
        podProd.title,
      )
      if (mediaId != null) {
        gallery = [{ image: mediaId }]
      }
    }

    const sizes = Array.from(
      new Set(podProd.variants.map((v) => v.size).filter((s): s is string => Boolean(s))),
    )
    const colors = Array.from(
      new Set(podProd.variants.map((v) => v.color).filter((c): c is string => Boolean(c))),
    )

    const configuratorOptions = {
      ...(sizes.length > 0 ? { sizes } : {}),
      ...(colors.length > 0 ? { colors } : {}),
      pod: {
        provider: podProd.provider,
        externalProductId: podProd.externalProductId,
        thumbnailUrl: podProd.thumbnailUrl || null,
        syncedAt: nowIso,
        variants: podProd.variants,
      },
    }

    const productData: Record<string, unknown> = {
      title: podProd.title,
      slug,
      tenant: Number(tenantId),
      productionType: 'print_on_demand',
      fulfillmentMode: 'self',
      priceInUSDEnabled: true,
      priceInUSD: basePriceCents,
      inventory: 999,
      configuratorOptions,
      ...(gallery && gallery.length > 0 ? { gallery } : {}),
    }

    if (existing) {
      await payload.update({
        collection: 'products',
        id: existing.id,
        data: productData as never,
        overrideAccess: true,
      })
      updated++
      synced.push({
        id: existing.id,
        title: podProd.title,
        slug,
        variantCount: podProd.variants.length,
      })
    } else {
      const doc = await payload.create({
        collection: 'products',
        data: {
          ...productData,
          _status: 'draft',
        } as never,
        overrideAccess: true,
      })
      created++
      synced.push({
        id: doc.id,
        title: podProd.title,
        slug,
        variantCount: podProd.variants.length,
      })
    }
  }

  return { created, updated, synced }
}

// ── 1. GET /api/fulfillment-ops/pod/status ──────────────────────────────────

export const podStatusHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  const tenantId = await resolveTenantIdFromRequest(req)
  if (!tenantId) {
    return Response.json({ error: 'tenantId or tenant slug required' }, { status: 400 })
  }
  if (!(await userCanManageTenant(req, tenantId))) {
    return Response.json({ error: 'Not permitted for this tenant' }, { status: 403 })
  }

  const settings = await getTenantPODSettings(req.payload, tenantId)
  const creds = await getConnectedPODCredentials(req.payload, tenantId).catch(() => null)
  const origin = resolveOriginFromReq(req)
  const activeProv = creds?.provider || 'printful'

  return Response.json({
    ok: true,
    tenantId,
    status: sanitizePODSettingsForClient(settings),
    webhookUrl: buildWebhookUrl(origin, activeProv, tenantId, creds?.webhookSecret),
  })
}

// ── 2. GET|POST /api/fulfillment-ops/pod/printful/connect ───────────────────

export const podPrintfulConnectHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  if (req.method === 'POST') {
    body = (await (req as Request).json().catch(() => ({}))) as Record<string, unknown>
  }

  const tenantId = await resolveTenantIdFromRequest(req, body)
  if (!tenantId) {
    return Response.json({ error: 'tenantId is required' }, { status: 400 })
  }
  if (!(await userCanManageTenant(req, tenantId))) {
    return Response.json({ error: 'Not permitted for this tenant' }, { status: 403 })
  }

  const origin = resolveOriginFromReq(req)
  const url = new URL(req.url || '', 'http://localhost')
  const mode =
    (typeof body.mode === 'string' && body.mode) ||
    url.searchParams.get('mode') ||
    (body.apiToken ? 'private_token' : 'oauth')

  if (mode === 'oauth') {
    if (!isPrintfulOAuthConfigured()) {
      return Response.json(
        {
          error:
            'Printful OAuth 2.0 is not configured on this node yet (PRINTFUL_CLIENT_ID / PRINTFUL_CLIENT_SECRET missing). Connect using a Printful Private API Token instead.',
        },
        { status: 503 },
      )
    }

    const env = getPlatformPrintfulOAuthEnv()
    const state = signPODOAuthState({
      tenantId: Number(tenantId),
      userId: req.user.id,
      origin,
      ts: Date.now(),
    })
    const redirectUrl = `${getServerSideURL().replace(/\/+$/, '')}/api/fulfillment-ops/pod/printful/callback`
    const authorizeUrl = buildPrintfulAuthorizeUrl({
      clientId: env.clientId,
      redirectUrl,
      state,
    })

    if (req.method === 'POST') {
      return Response.json({ ok: true, mode: 'oauth', authorizeUrl })
    }
    return new Response(null, { status: 302, headers: { Location: authorizeUrl } })
  }

  // Private API Token path (immediately functional with zero Printful Partner approval wait)
  const apiToken = typeof body.apiToken === 'string' ? body.apiToken.trim() : ''
  if (!apiToken) {
    return Response.json({ error: 'Printful API token is required' }, { status: 400 })
  }

  const check = await verifyPrintfulConnection(apiToken)
  if (!check.ok) {
    return Response.json(
      { ok: false, error: check.error || 'Could not verify Printful API token' },
      { status: 400 },
    )
  }

  await saveConnectedPrintfulAccount(req.payload, tenantId, {
    authMode: 'private_token',
    accessToken: apiToken,
    storeId: check.storeId,
    storeName: check.storeName,
    storeType: check.storeType,
  })

  const creds = await getConnectedPODCredentials(req.payload, tenantId, 'printful')
  const webhookUrl = buildWebhookUrl(origin, 'printful', tenantId, creds?.webhookSecret)
  const whRes = await registerPrintfulWebhook(apiToken, check.storeId, webhookUrl).catch(() => ({
    ok: false,
    error: 'Webhook auto-registration skipped',
  }))

  const updated = await getTenantPODSettings(req.payload, tenantId)
  return Response.json({
    ok: true,
    mode: 'private_token',
    webhookRegistered: whRes.ok,
    webhookUrl,
    status: sanitizePODSettingsForClient(updated),
  })
}

// ── 3. GET /api/fulfillment-ops/pod/printful/callback ───────────────────────

export const podPrintfulCallbackHandler: PayloadHandler = async (req) => {
  const url = new URL(req.url || '', 'http://localhost')
  const code = url.searchParams.get('code') || ''
  const stateRaw = url.searchParams.get('state') || ''
  const errParam = url.searchParams.get('error') || ''

  const state = verifyPODOAuthState(stateRaw)
  const returnOrigin =
    (typeof state?.origin === 'string' && state.origin) || getServerSideURL()

  const redirectTo = (query: string) =>
    new Response(null, {
      status: 302,
      headers: {
        Location: `${returnOrigin.replace(/\/+$/, '')}/dashboard/admin/settings?tab=leo&${query}`,
      },
    })

  if (errParam) {
    return redirectTo(`pod_error=${encodeURIComponent(errParam)}`)
  }
  if (!code || !state?.tenantId) {
    return redirectTo('pod_error=missing_code_or_state')
  }

  try {
    const exchanged = await exchangePrintfulOAuthCode({ code })
    const check = await verifyPrintfulConnection(exchanged.accessToken)
    if (!check.ok) {
      return redirectTo(`pod_error=${encodeURIComponent(check.error || 'verify_failed')}`)
    }

    const tenantId = Number(state.tenantId)
    await saveConnectedPrintfulAccount(req.payload, tenantId, {
      authMode: 'oauth',
      accessToken: exchanged.accessToken,
      refreshToken: exchanged.refreshToken,
      expiresAt: exchanged.expiresAt,
      storeId: check.storeId,
      storeName: check.storeName,
      storeType: check.storeType,
    })

    const creds = await getConnectedPODCredentials(req.payload, tenantId, 'printful')
    const webhookUrl = buildWebhookUrl(returnOrigin, 'printful', tenantId, creds?.webhookSecret)
    await registerPrintfulWebhook(exchanged.accessToken, check.storeId, webhookUrl).catch(
      () => undefined,
    )

    return redirectTo('pod=connected')
  } catch (err) {
    void logError({
      source: 'fulfillment-pod-ops/printful/callback',
      message: `Printful OAuth callback error: ${err instanceof Error ? err.message : String(err)}`,
    })
    return redirectTo('pod_error=oauth_exchange_failed')
  }
}

// ── 4. POST /api/fulfillment-ops/pod/printify/connect ───────────────────────

export const podPrintifyConnectHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const body = (await (req as Request).json().catch(() => ({}))) as Record<string, unknown>
  const tenantId = await resolveTenantIdFromRequest(req, body)
  if (!tenantId) {
    return Response.json({ error: 'tenantId is required' }, { status: 400 })
  }
  if (!(await userCanManageTenant(req, tenantId))) {
    return Response.json({ error: 'Not permitted for this tenant' }, { status: 403 })
  }

  const apiToken = typeof body.apiToken === 'string' ? body.apiToken.trim() : ''
  const preferredShopId = typeof body.shopId === 'string' ? body.shopId.trim() : undefined
  if (!apiToken) {
    return Response.json({ error: 'Printify API token is required' }, { status: 400 })
  }

  const check = await verifyPrintifyConnection(apiToken, preferredShopId)
  if (!check.ok || !check.shopId) {
    return Response.json(
      { ok: false, error: check.error || 'Could not verify Printify API token' },
      { status: 400 },
    )
  }

  await saveConnectedPrintifyAccount(req.payload, tenantId, {
    apiToken,
    shopId: check.shopId,
    shopTitle: check.shopTitle,
    salesChannel: check.salesChannel,
  })

  const origin = resolveOriginFromReq(req)
  const creds = await getConnectedPODCredentials(req.payload, tenantId, 'printify')
  const updated = await getTenantPODSettings(req.payload, tenantId)

  return Response.json({
    ok: true,
    webhookUrl: buildWebhookUrl(origin, 'printify', tenantId, creds?.webhookSecret),
    status: sanitizePODSettingsForClient(updated),
  })
}

// ── 5. POST /api/fulfillment-ops/pod/disconnect ─────────────────────────────

export const podDisconnectHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  const body = (await (req as Request).json().catch(() => ({}))) as Record<string, unknown>
  const tenantId = await resolveTenantIdFromRequest(req, body)
  if (!tenantId) {
    return Response.json({ error: 'tenantId is required' }, { status: 400 })
  }
  if (!(await userCanManageTenant(req, tenantId))) {
    return Response.json({ error: 'Not permitted for this tenant' }, { status: 403 })
  }

  const provider = body.provider === 'printify' ? 'printify' : 'printful'
  await disconnectPODAccount(req.payload, tenantId, provider)
  const updated = await getTenantPODSettings(req.payload, tenantId)

  return Response.json({
    ok: true,
    disconnected: provider,
    status: sanitizePODSettingsForClient(updated),
  })
}

// ── 6. POST /api/fulfillment-ops/pod/settings ───────────────────────────────

export const podSettingsUpdateHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  const body = (await (req as Request).json().catch(() => ({}))) as Record<string, unknown>
  const tenantId = await resolveTenantIdFromRequest(req, body)
  if (!tenantId) {
    return Response.json({ error: 'tenantId is required' }, { status: 400 })
  }
  if (!(await userCanManageTenant(req, tenantId))) {
    return Response.json({ error: 'Not permitted for this tenant' }, { status: 403 })
  }

  const existing = await getTenantPODSettings(req.payload, tenantId)
  const requestedActiveProvider: PODProviderId | undefined =
    body.activeProvider === 'printful'
      ? 'printful'
      : body.activeProvider === 'printify'
        ? 'printify'
        : undefined
  const next = {
    ...existing,
    ...(typeof body.autoConfirmOrders === 'boolean'
      ? { autoConfirmOrders: body.autoConfirmOrders }
      : {}),
    ...(typeof body.packingSlipMessage === 'string'
      ? { packingSlipMessage: body.packingSlipMessage.slice(0, 300) }
      : {}),
    ...(typeof body.packingSlipPhone === 'string'
      ? { packingSlipPhone: body.packingSlipPhone.slice(0, 40) }
      : {}),
    ...(requestedActiveProvider ? { activeProvider: requestedActiveProvider } : {}),
  }

  await saveTenantPODSettings(req.payload, tenantId, next)
  return Response.json({
    ok: true,
    status: sanitizePODSettingsForClient(next),
  })
}

// ── 7. POST /api/fulfillment-ops/pod/sync ───────────────────────────────────

export const podSyncCatalogHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  const body = (await (req as Request).json().catch(() => ({}))) as Record<string, unknown>
  const tenantId = await resolveTenantIdFromRequest(req, body)
  if (!tenantId) {
    return Response.json({ error: 'tenantId is required' }, { status: 400 })
  }
  if (!(await userCanManageTenant(req, tenantId))) {
    return Response.json({ error: 'Not permitted for this tenant' }, { status: 403 })
  }

  const requestedProvider =
    body.provider === 'printful' || body.provider === 'printify' ? body.provider : undefined
  const creds = await getConnectedPODCredentials(req.payload, tenantId, requestedProvider)
  if (!creds) {
    return Response.json(
      { error: 'Connect a Printful or Printify account first before syncing products.' },
      { status: 400 },
    )
  }

  try {
    let podProducts: PODSyncProduct[] = []
    if (creds.provider === 'printful') {
      const accessToken = await refreshPrintfulTokenIfNeeded(req.payload, tenantId, creds)
      podProducts = await fetchPrintfulSyncProducts(accessToken, creds.storeId)
    } else if (creds.shopId) {
      podProducts = await fetchPrintifyProducts(creds.apiToken, creds.shopId)
    }

    const syncRes = await syncPODProductsIntoCatalog(req.payload, tenantId, podProducts)

    const existing = await getTenantPODSettings(req.payload, tenantId)
    const nextSettings = {
      ...existing,
      lastSyncAt: new Date().toISOString(),
      syncedProductCount: podProducts.length,
    }
    await saveTenantPODSettings(req.payload, tenantId, nextSettings)

    return Response.json({
      ok: true,
      provider: creds.provider,
      total: podProducts.length,
      created: syncRes.created,
      updated: syncRes.updated,
      products: syncRes.synced,
      status: sanitizePODSettingsForClient(nextSettings),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}

// ── 8. POST /api/fulfillment-ops/pod/shipping-rates ─────────────────────────

export const podShippingRatesHandler: PayloadHandler = async (req) => {
  const denied = applyRateLimit(req, 'orders')
  if (denied) return denied

  const body = (await (req as Request).json().catch(() => ({}))) as {
    tenantId?: number | string
    tenantSlug?: string
    recipient?: Partial<PODRecipientAddress>
    items?: PODShippingRateRequestItem[]
  }

  const recipient = body.recipient
  if (!recipient?.address1 || !recipient?.city || !recipient?.zip) {
    return Response.json(
      { ok: false, error: 'recipient.address1, city, and zip are required' },
      { status: 400 },
    )
  }

  const tenantId = await resolveTenantIdFromRequest(req, body as Record<string, unknown>)
  if (!tenantId) {
    return Response.json({ ok: true, provider: null, rates: [] })
  }

  const creds = await getConnectedPODCredentials(req.payload, tenantId)
  if (!creds) {
    return Response.json({ ok: true, provider: null, rates: [] })
  }

  const items = Array.isArray(body.items) ? body.items : []
  if (items.length === 0) {
    return Response.json({ ok: true, provider: creds.provider, rates: [] })
  }

  try {
    const fullRecipient: PODRecipientAddress = {
      name: recipient.name || 'Customer',
      address1: recipient.address1,
      city: recipient.city,
      stateCode: recipient.stateCode,
      countryCode: recipient.countryCode || 'US',
      zip: recipient.zip,
    }

    if (creds.provider === 'printful') {
      const token = await refreshPrintfulTokenIfNeeded(req.payload, tenantId, creds)
      const rates = await fetchPrintfulShippingRates(token, creds.storeId, fullRecipient, items)
      return Response.json({ ok: true, provider: 'printful', rates })
    }

    if (creds.provider === 'printify' && creds.shopId) {
      const rates = await fetchPrintifyShippingRates(
        creds.apiToken,
        creds.shopId,
        fullRecipient,
        items,
      )
      return Response.json({ ok: true, provider: 'printify', rates })
    }

    return Response.json({ ok: true, provider: null, rates: [] })
  } catch (err) {
    return Response.json(
      {
        ok: false,
        provider: creds.provider,
        rates: [],
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    )
  }
}

// ── 9. POST /api/fulfillment-ops/pod/webhooks/:provider ─────────────────────

async function applyNormalizedPODWebhookEvent(
  payload: Payload,
  tenantId: number | string,
  event: PODNormalizedWebhookEvent,
): Promise<{ updatedOrderId: string | number | null }> {
  const rawExt = (event.externalOrderId || '').trim()
  if (!rawExt) return { updatedOrderId: null }

  const normalizedId = rawExt.replace(/^aos-order-/i, '')
  const candidateId = /^\d+$/.test(normalizedId) ? Number(normalizedId) : normalizedId

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const order = (await (payload.findByID as any)({
    collection: 'orders',
    id: candidateId,
    depth: 0,
    overrideAccess: true,
  }).catch(() => null)) as Record<string, any> | null

  if (!order) return { updatedOrderId: null }

  const orderTenantId = typeof order.tenant === 'object' ? order.tenant?.id : order.tenant
  if (orderTenantId != null && String(orderTenantId) !== String(tenantId)) {
    return { updatedOrderId: null }
  }

  const list = Array.isArray(order.fulfillment) ? [...order.fulfillment] : []
  const nowIso = new Date().toISOString()

  const nextList =
    list.length > 0
      ? list.map((f: Record<string, any>) => ({
          ...f,
          fulfillmentStatus: event.status,
          ...(event.shippedAt ? { shippedAt: event.shippedAt } : {}),
          ...(event.trackingNumber ? { trackingNumber: event.trackingNumber } : {}),
          ...(event.trackingUrl ? { trackingUrl: event.trackingUrl } : {}),
          ...(event.failureReason ? { rejectionReason: event.failureReason } : {}),
          selectedConfiguration: {
            ...(typeof f.selectedConfiguration === 'object' && f.selectedConfiguration
              ? f.selectedConfiguration
              : {}),
            lastWebhook: {
              provider: event.provider,
              eventType: event.eventType,
              carrier: event.carrier || null,
              receivedAt: nowIso,
            },
          },
        }))
      : [
          {
            orderItemIndex: 0,
            fulfillmentStatus: event.status,
            ...(event.shippedAt ? { shippedAt: event.shippedAt } : {}),
            ...(event.trackingNumber ? { trackingNumber: event.trackingNumber } : {}),
            ...(event.trackingUrl ? { trackingUrl: event.trackingUrl } : {}),
            ...(event.failureReason ? { rejectionReason: event.failureReason } : {}),
          },
        ]

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (payload.update as any)({
    collection: 'orders',
    id: order.id,
    data: { fulfillment: nextList },
    overrideAccess: true,
  })

  return { updatedOrderId: order.id }
}

export const podPrintfulWebhookHandler: PayloadHandler = async (req) => {
  const url = new URL(req.url || '', 'http://localhost')
  const tenantId = await resolveTenantIdFromRequest(req)
  const queryToken = url.searchParams.get('token')
  const rawBody = await (req as Request).text()

  if (!tenantId) {
    return Response.json({ error: 'tenantId required' }, { status: 400 })
  }

  const creds = await getConnectedPODCredentials(req.payload, tenantId, 'printful').catch(() => null)
  if (!creds || creds.provider !== 'printful') {
    return Response.json({ error: 'Printful not connected for tenant' }, { status: 404 })
  }

  if (creds.webhookSecret) {
    const sigHeader =
      req.headers?.get?.('x-pf-webhook-signature') ||
      req.headers?.get?.('x-printful-signature') ||
      req.headers?.get?.('x-signature')
    const valid = verifyPrintfulWebhookSignature({
      rawBody,
      signatureHeader: sigHeader,
      queryToken,
      expectedSecret: creds.webhookSecret,
    })
    if (!valid) {
      return Response.json({ error: 'Invalid webhook signature' }, { status: 401 })
    }
  }

  const event = parsePrintfulWebhookEvent(rawBody)
  if (!event) {
    return Response.json({ received: true, parsed: false })
  }

  const res = await applyNormalizedPODWebhookEvent(req.payload, tenantId, event)
  return Response.json({ received: true, ...res })
}

export const podPrintifyWebhookHandler: PayloadHandler = async (req) => {
  const url = new URL(req.url || '', 'http://localhost')
  const tenantId = await resolveTenantIdFromRequest(req)
  const queryToken = url.searchParams.get('token')
  const rawBody = await (req as Request).text()

  if (!tenantId) {
    return Response.json({ error: 'tenantId required' }, { status: 400 })
  }

  const creds = await getConnectedPODCredentials(req.payload, tenantId, 'printify').catch(() => null)
  if (!creds || creds.provider !== 'printify') {
    return Response.json({ error: 'Printify not connected for tenant' }, { status: 404 })
  }

  if (creds.webhookSecret) {
    const sigHeader = req.headers?.get?.('x-pfy-signature')
    const sigOk =
      (queryToken && queryToken === creds.webhookSecret) ||
      verifyPrintifyWebhookSignature({
        rawBody,
        signatureHeader: sigHeader,
        expectedSecret: creds.webhookSecret,
      })
    if (!sigOk) {
      return Response.json({ error: 'Invalid Printify webhook signature' }, { status: 401 })
    }
  }

  const event = parsePrintifyWebhookEvent(rawBody)
  if (!event) {
    return Response.json({ received: true, parsed: false })
  }

  const res = await applyNormalizedPODWebhookEvent(req.payload, tenantId, event)
  return Response.json({ received: true, ...res })
}
