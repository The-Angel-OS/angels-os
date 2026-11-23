/**
 * Printful Provider Adapter (Model A Creator-Owned Account)
 *
 * Uses native fetch (zero SDK bloat) across Printful OAuth 2.0 + REST API v2/v1:
 *   - OAuth 2.0 Authorize (`redirect_url`), Code Exchange, and Token Refresh
 *   - Store verification (`/v2/stores` with `/stores` fallback)
 *   - Sync Product Catalog & Variants import (`/store/products`)
 *   - Mockup Generator (`/v2/mockup-tasks`)
 *   - Live Checkout Shipping Rate Estimation (`/shipping/rates`)
 *   - Idempotent Order Dispatch with `external_id`, `confirm`, and `packing_slip`
 *   - Webhook Registration & Signature/Secret Parsing
 */
import crypto from 'node:crypto'
import type { Payload } from 'payload'
import { getPlatformPrintfulOAuthEnv, saveConnectedPrintfulAccount } from '../config'
import type {
  PODNormalizedWebhookEvent,
  PODOrderSubmitRequest,
  PODOrderSubmitResult,
  PODRecipientAddress,
  PODShippingRateOption,
  PODShippingRateRequestItem,
  PODSyncProduct,
  PODSyncVariant,
} from '../types'

const PRINTFUL_API_BASE = 'https://api.printful.com'
const PRINTFUL_OAUTH_AUTHORIZE = 'https://www.printful.com/oauth/authorize'
const PRINTFUL_OAUTH_TOKEN = 'https://www.printful.com/oauth/token'

async function printfulFetch<T = Record<string, unknown>>(
  accessToken: string,
  path: string,
  opts: {
    method?: string
    body?: unknown
    storeId?: string
    timeoutMs?: number
  } = {},
): Promise<{ ok: boolean; status: number; data: T; errorText?: string }> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (opts.storeId) {
    headers['X-PF-Store-Id'] = String(opts.storeId)
  }

  const res = await fetch(`${PRINTFUL_API_BASE}${path}`, {
    method: opts.method || 'GET',
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    signal: AbortSignal.timeout(opts.timeoutMs || 15_000),
  })

  const text = await res.text()
  let parsed = {} as T
  try {
    parsed = (text ? JSON.parse(text) : {}) as T
  } catch {
    parsed = {} as T
  }

  if (!res.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyData = parsed as any
    const detail =
      anyData?.error?.message ||
      anyData?.result ||
      anyData?.data?.message ||
      text.slice(0, 240)
    return {
      ok: false,
      status: res.status,
      data: parsed,
      errorText: typeof detail === 'string' && detail ? detail : `Printful HTTP ${res.status}`,
    }
  }

  return { ok: true, status: res.status, data: parsed }
}

export function buildPrintfulAuthorizeUrl(params: {
  clientId?: string
  redirectUrl: string
  state: string
}): string {
  const clientId = params.clientId || getPlatformPrintfulOAuthEnv().clientId
  const u = new URL(PRINTFUL_OAUTH_AUTHORIZE)
  u.searchParams.set('client_id', clientId)
  u.searchParams.set('redirect_url', params.redirectUrl)
  u.searchParams.set('state', params.state)
  return u.toString()
}

export async function exchangePrintfulOAuthCode(params: {
  code: string
  clientId?: string
  clientSecret?: string
}): Promise<{
  accessToken: string
  refreshToken?: string
  expiresAt?: string
}> {
  const env = getPlatformPrintfulOAuthEnv()
  const clientId = params.clientId || env.clientId
  const clientSecret = params.clientSecret || env.clientSecret
  if (!clientId || !clientSecret) {
    throw new Error('PRINTFUL_CLIENT_ID and PRINTFUL_CLIENT_SECRET are required for Printful OAuth.')
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    code: params.code,
  })

  const res = await fetch(PRINTFUL_OAUTH_TOKEN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  })

  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string
    refresh_token?: string
    expires_at?: number
    expires_in?: number
    error_description?: string
    error?: string
  }

  if (!res.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || `Printful OAuth exchange failed (HTTP ${res.status})`,
    )
  }

  const expiresAt = json.expires_at
    ? new Date(json.expires_at * 1000).toISOString()
    : json.expires_in
      ? new Date(Date.now() + json.expires_in * 1000).toISOString()
      : undefined

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt,
  }
}

export async function refreshPrintfulTokenIfNeeded(
  payload: Payload,
  tenantId: number | string,
  creds: {
    authMode: 'oauth' | 'private_token'
    storeId?: string
    storeName?: string
    accessToken: string
    refreshToken?: string
    expiresAt?: string
    webhookSecret?: string
    connectedAt: string
  },
): Promise<string> {
  if (creds.authMode !== 'oauth' || !creds.refreshToken || !creds.expiresAt) {
    return creds.accessToken
  }
  const expiresMs = Date.parse(creds.expiresAt)
  if (!Number.isFinite(expiresMs) || expiresMs - Date.now() > 5 * 60 * 1000) {
    return creds.accessToken
  }

  const env = getPlatformPrintfulOAuthEnv()
  if (!env.clientId || !env.clientSecret) {
    return creds.accessToken
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.clientId,
      client_secret: env.clientSecret,
      refresh_token: creds.refreshToken,
    })

    const res = await fetch(PRINTFUL_OAUTH_TOKEN, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(15_000),
    })

    const json = (await res.json().catch(() => ({}))) as {
      access_token?: string
      refresh_token?: string
      expires_at?: number
      expires_in?: number
    }
    if (!res.ok || !json.access_token) {
      return creds.accessToken
    }

    const nextExpiresAt = json.expires_at
      ? new Date(json.expires_at * 1000).toISOString()
      : json.expires_in
        ? new Date(Date.now() + json.expires_in * 1000).toISOString()
        : creds.expiresAt

    await saveConnectedPrintfulAccount(payload, tenantId, {
      authMode: 'oauth',
      storeId: creds.storeId,
      storeName: creds.storeName,
      accessToken: json.access_token,
      refreshToken: json.refresh_token || creds.refreshToken,
      expiresAt: nextExpiresAt,
      webhookSecret: creds.webhookSecret,
      connectedAt: creds.connectedAt,
    })

    return json.access_token
  } catch {
    return creds.accessToken
  }
}

export async function verifyPrintfulConnection(accessToken: string): Promise<{
  ok: boolean
  storeId?: string
  storeName?: string
  storeType?: string
  error?: string
}> {
  // Try v2 stores first, then fall back to v1 /stores
  const v2 = await printfulFetch<{
    data?: Array<{ id?: number | string; name?: string; type?: string }>
  }>(accessToken, '/v2/stores')

  if (v2.ok) {
    const stores = Array.isArray(v2.data?.data) ? v2.data.data : []
    const first = stores[0]
    if (first?.id != null) {
      return {
        ok: true,
        storeId: String(first.id),
        storeName: first.name || `Store #${first.id}`,
        storeType: first.type || 'api',
      }
    }
    return {
      ok: true,
      storeName: 'Printful Connected Store',
      storeType: 'api',
    }
  }

  const v1 = await printfulFetch<{
    result?: Array<{ id?: number | string; name?: string; type?: string }>
  }>(accessToken, '/stores')

  if (v1.ok) {
    const stores = Array.isArray(v1.data?.result) ? v1.data.result : []
    const first = stores[0]
    return {
      ok: true,
      ...(first?.id != null ? { storeId: String(first.id) } : {}),
      storeName: first?.name || 'Printful Connected Store',
      storeType: first?.type || 'api',
    }
  }

  // Store-scoped private token fallback (/store)
  const single = await printfulFetch<{
    result?: { id?: number | string; name?: string; type?: string }
  }>(accessToken, '/store')

  if (single.ok && single.data?.result) {
    return {
      ok: true,
      ...(single.data.result.id != null ? { storeId: String(single.data.result.id) } : {}),
      storeName: single.data.result.name || 'Printful Store',
      storeType: single.data.result.type || 'store',
    }
  }

  return {
    ok: false,
    error: v2.errorText || v1.errorText || single.errorText || 'Invalid Printful token',
  }
}

function parsePriceToCents(raw: unknown): number {
  const num = Number(raw)
  if (!Number.isFinite(num) || num <= 0) return 0
  return Math.round(num * 100)
}

function parseSizeColorFromVariantName(name: string): { size?: string; color?: string } {
  const parts = name.split('/').map((s) => s.trim()).filter(Boolean)
  if (parts.length >= 2) {
    return { color: parts[parts.length - 2], size: parts[parts.length - 1] }
  }
  return {}
}

export async function fetchPrintfulSyncProducts(
  accessToken: string,
  storeId?: string,
  limit = 40,
): Promise<PODSyncProduct[]> {
  const listRes = await printfulFetch<{
    result?: Array<{
      id?: number | string
      external_id?: string
      name?: string
      thumbnail_url?: string
    }>
  }>(accessToken, `/store/products?limit=${Math.min(Math.max(limit, 1), 100)}`, { storeId })

  if (!listRes.ok) {
    throw new Error(`Printful catalog fetch failed: ${listRes.errorText}`)
  }

  const summaries = Array.isArray(listRes.data?.result) ? listRes.data.result : []
  const products: PODSyncProduct[] = []

  for (const summary of summaries.slice(0, limit)) {
    if (!summary?.id) continue
    const detailRes = await printfulFetch<{
      result?: {
        sync_product?: {
          id?: number | string
          name?: string
          thumbnail_url?: string
        }
        sync_variants?: Array<{
          id?: number | string
          external_id?: string
          variant_id?: number
          sku?: string
          name?: string
          size?: string
          color?: string
          retail_price?: string | number
          currency?: string
          availability_status?: string
          files?: Array<{ type?: string; preview_url?: string; thumbnail_url?: string }>
          product?: { image?: string }
        }>
      }
    }>(accessToken, `/store/products/${summary.id}`, { storeId })

    const sp = detailRes.ok ? detailRes.data?.result?.sync_product : undefined
    const rawVariants = detailRes.ok && Array.isArray(detailRes.data?.result?.sync_variants)
      ? detailRes.data.result.sync_variants
      : []

    const variants: PODSyncVariant[] = rawVariants.map((sv) => {
      const label = sv.name || summary.name || 'Variant'
      const guessed = parseSizeColorFromVariantName(label)
      const previewFile =
        sv.files?.find((f) => f.type === 'preview') ||
        sv.files?.find((f) => Boolean(f.preview_url || f.thumbnail_url))

      return {
        externalVariantId: String(sv.id || sv.external_id || ''),
        ...(Number.isFinite(Number(sv.id)) ? { syncVariantId: Number(sv.id) } : {}),
        ...(sv.sku ? { sku: sv.sku } : {}),
        name: label,
        size: sv.size || guessed.size,
        color: sv.color || guessed.color,
        retailPriceCents: parsePriceToCents(sv.retail_price),
        currency: (sv.currency || 'USD').toUpperCase(),
        previewUrl: previewFile?.preview_url || previewFile?.thumbnail_url || sv.product?.image,
        inStock: sv.availability_status !== 'out_of_stock',
      }
    })

    products.push({
      provider: 'printful',
      externalProductId: String(sp?.id || summary.id),
      title: sp?.name || summary.name || `Printful Product #${summary.id}`,
      thumbnailUrl:
        sp?.thumbnail_url ||
        summary.thumbnail_url ||
        variants.find((v) => v.previewUrl)?.previewUrl,
      variants,
    })
  }

  return products
}

export async function createPrintfulMockupTask(
  accessToken: string,
  storeId: string | undefined,
  body: Record<string, unknown>,
): Promise<{ taskKey: string; raw: unknown }> {
  const res = await printfulFetch<{ data?: Array<{ id?: string | number; task_key?: string }>; result?: { task_key?: string } }>(
    accessToken,
    '/v2/mockup-tasks',
    { method: 'POST', storeId, body },
  )
  if (!res.ok) {
    throw new Error(`Printful mockup task failed: ${res.errorText}`)
  }
  const taskKey =
    res.data?.data?.[0]?.task_key ||
    String(res.data?.data?.[0]?.id || res.data?.result?.task_key || '')
  return { taskKey, raw: res.data }
}

export async function getPrintfulMockupTask(
  accessToken: string,
  storeId: string | undefined,
  taskIdOrKey: string,
): Promise<{ status: string; mockups: string[]; raw: unknown }> {
  const res = await printfulFetch<{
    data?: Array<{
      status?: string
      catalog_variant_mockups?: Array<{ mockups?: Array<{ mockup_url?: string }> }>
    }>
  }>(accessToken, `/v2/mockup-tasks?id=${encodeURIComponent(taskIdOrKey)}`, { storeId })
  if (!res.ok) {
    throw new Error(`Printful mockup lookup failed: ${res.errorText}`)
  }
  const item = res.data?.data?.[0]
  const urls: string[] = []
  for (const vm of item?.catalog_variant_mockups || []) {
    for (const m of vm.mockups || []) {
      if (m.mockup_url) urls.push(m.mockup_url)
    }
  }
  return {
    status: item?.status || 'unknown',
    mockups: urls,
    raw: res.data,
  }
}

export async function fetchPrintfulShippingRates(
  accessToken: string,
  storeId: string | undefined,
  recipient: PODRecipientAddress,
  items: PODShippingRateRequestItem[],
): Promise<PODShippingRateOption[]> {
  const mappedItems = items
    .map((i): { sync_variant_id?: number; variant_id?: number; quantity: number } => ({
      ...(i.syncVariantId != null
        ? { sync_variant_id: Number(i.syncVariantId) }
        : i.externalVariantId != null && Number.isFinite(Number(i.externalVariantId))
          ? { sync_variant_id: Number(i.externalVariantId) }
          : i.variantId != null
            ? { variant_id: Number(i.variantId) }
            : {}),
      quantity: Math.max(1, Number(i.quantity) || 1),
    }))
    .filter((i) => i.sync_variant_id != null || i.variant_id != null)

  if (mappedItems.length === 0) return []

  const res = await printfulFetch<{
    result?: Array<{
      id?: string
      name?: string
      rate?: string | number
      currency?: string
      minDeliveryDays?: number
      maxDeliveryDays?: number
    }>
  }>(accessToken, '/shipping/rates', {
    method: 'POST',
    storeId,
    body: {
      recipient: {
        address1: recipient.address1,
        city: recipient.city,
        state_code: recipient.stateCode || undefined,
        country_code: recipient.countryCode || 'US',
        zip: recipient.zip,
      },
      items: mappedItems,
    },
  })

  if (!res.ok) {
    throw new Error(`Printful shipping rate lookup failed: ${res.errorText}`)
  }

  const rates = Array.isArray(res.data?.result) ? res.data.result : []
  return rates.map((r) => ({
    id: String(r.id || 'STANDARD'),
    name: r.name || 'Standard Shipping',
    rateCents: parsePriceToCents(r.rate),
    currency: (r.currency || 'USD').toUpperCase(),
    ...(r.minDeliveryDays != null ? { minDeliveryDays: r.minDeliveryDays } : {}),
    ...(r.maxDeliveryDays != null ? { maxDeliveryDays: r.maxDeliveryDays } : {}),
  }))
}

export async function submitPrintfulOrder(
  accessToken: string,
  storeId: string | undefined,
  req: PODOrderSubmitRequest,
): Promise<PODOrderSubmitResult> {
  const autoConfirm = req.autoConfirm === true
  const path = autoConfirm ? '/orders?confirm=true' : '/orders?confirm=false'

  const body: Record<string, unknown> = {
    external_id: req.externalOrderId,
    recipient: {
      name: req.recipient.name,
      address1: req.recipient.address1,
      ...(req.recipient.address2 ? { address2: req.recipient.address2 } : {}),
      city: req.recipient.city,
      ...(req.recipient.stateCode ? { state_code: req.recipient.stateCode } : {}),
      country_code: req.recipient.countryCode || 'US',
      zip: req.recipient.zip,
      ...(req.recipient.email ? { email: req.recipient.email } : {}),
      ...(req.recipient.phone ? { phone: req.recipient.phone } : {}),
    },
    items: req.items.map((item) => ({
      ...(item.syncVariantId != null
        ? { sync_variant_id: item.syncVariantId }
        : item.variantId != null
          ? { variant_id: item.variantId }
          : item.externalVariantId && Number.isFinite(Number(item.externalVariantId))
            ? { sync_variant_id: Number(item.externalVariantId) }
            : {}),
      name: item.name,
      quantity: Math.max(1, Number(item.quantity) || 1),
      ...(item.retailPriceCents != null
        ? { retail_price: (item.retailPriceCents / 100).toFixed(2) }
        : {}),
      ...(item.files && item.files.length > 0 ? { files: item.files } : {}),
    })),
    ...(req.packingSlip?.message || req.packingSlip?.email || req.packingSlip?.phone
      ? {
          packing_slip: {
            ...(req.packingSlip.email ? { email: req.packingSlip.email } : {}),
            ...(req.packingSlip.phone ? { phone: req.packingSlip.phone } : {}),
            ...(req.packingSlip.message ? { message: req.packingSlip.message } : {}),
          },
        }
      : {}),
  }

  const res = await printfulFetch<{
    result?: { id?: number | string; status?: string; external_id?: string }
  }>(accessToken, path, { method: 'POST', storeId, body })

  if (!res.ok) {
    return {
      ok: false,
      provider: 'printful',
      externalOrderId: req.externalOrderId,
      status: 'failed',
      autoConfirmed: autoConfirm,
      error: res.errorText || 'Printful order submission failed',
      raw: res.data,
    }
  }

  const pfStatus = String(res.data?.result?.status || (autoConfirm ? 'pending' : 'draft'))
  return {
    ok: true,
    provider: 'printful',
    externalOrderId: res.data?.result?.external_id || req.externalOrderId,
    providerOrderId: res.data?.result?.id != null ? String(res.data.result.id) : undefined,
    status: pfStatus === 'draft' ? 'draft' : 'in_production',
    autoConfirmed: autoConfirm,
    raw: res.data,
  }
}

export async function registerPrintfulWebhook(
  accessToken: string,
  storeId: string | undefined,
  webhookUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const res = await printfulFetch(accessToken, '/webhooks', {
    method: 'POST',
    storeId,
    body: {
      url: webhookUrl,
      types: [
        'package_shipped',
        'order_failed',
        'order_canceled',
        'order_put_hold',
        'order_updated',
      ],
    },
  })
  return { ok: res.ok, error: res.errorText }
}

export function verifyPrintfulWebhookSignature(opts: {
  rawBody: string
  signatureHeader?: string | null
  queryToken?: string | null
  expectedSecret?: string
}): boolean {
  if (!opts.expectedSecret) return false
  if (opts.queryToken && opts.queryToken === opts.expectedSecret) {
    return true
  }
  const sig = (opts.signatureHeader || '').trim().replace(/^sha256=/i, '')
  if (!sig) return false
  const digest = crypto
    .createHmac('sha256', opts.expectedSecret)
    .update(opts.rawBody)
    .digest('hex')
  const a = Uint8Array.from(Buffer.from(sig))
  const b = Uint8Array.from(Buffer.from(digest))
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function parsePrintfulWebhookEvent(rawBody: string): PODNormalizedWebhookEvent | null {
  try {
    const body = JSON.parse(rawBody) as {
      type?: string
      data?: {
        order?: { id?: number | string; external_id?: string; status?: string }
        shipment?: {
          carrier?: string
          tracking_number?: string
          tracking_url?: string
          ship_date?: string
          shipped_at?: number | string
        }
        reason?: string
      }
    }

    const eventType = String(body.type || '')
    const order = body.data?.order
    const shipment = body.data?.shipment

    let status: PODNormalizedWebhookEvent['status'] = 'in_production'
    if (eventType === 'package_shipped' || shipment?.tracking_number) {
      status = 'shipped'
    } else if (eventType === 'order_canceled') {
      status = 'cancelled'
    } else if (eventType === 'order_failed') {
      status = 'rejected'
    } else if (eventType === 'order_put_hold') {
      status = 'pending_match'
    }

    const shippedAt =
      typeof shipment?.ship_date === 'string'
        ? shipment.ship_date
        : typeof shipment?.shipped_at === 'number'
          ? new Date(shipment.shipped_at * 1000).toISOString()
          : eventType === 'package_shipped'
            ? new Date().toISOString()
            : undefined

    return {
      provider: 'printful',
      eventType,
      externalOrderId: order?.external_id,
      providerOrderId: order?.id != null ? String(order.id) : undefined,
      status,
      carrier: shipment?.carrier,
      trackingNumber: shipment?.tracking_number,
      trackingUrl: shipment?.tracking_url,
      shippedAt,
      failureReason: body.data?.reason,
    }
  } catch {
    return null
  }
}
