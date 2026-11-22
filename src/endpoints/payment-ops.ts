/**
 * Unified Dual-Rail Payment Endpoints — /api/payment-ops/*
 *
 *   - GET  /api/payment-ops/providers          (active rails for host tenant)
 *   - POST /api/payment-ops/checkout           (shop cart hosted checkout)
 *   - POST /api/payment-ops/confirm            (server-verified return capture)
 *   - POST /api/payment-ops/webhooks/square    (HMAC-SHA256 verified)
 *   - POST /api/payment-ops/webhooks/paypal    (PayPal cryptographic verify)
 *   - GET|POST /api/payment-ops/square/connect (multi-tenant Square OAuth init)
 *   - GET  /api/payment-ops/square/callback    (Square OAuth callback)
 *   - POST /api/payment-ops/square/disconnect  (disconnect tenant Square OAuth)
 *   - GET|POST /api/payment-ops/setup          (live self-test + webhook bootstrap)
 */
import crypto from 'node:crypto'
import type { PayloadHandler } from 'payload'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
import { calculateBootstrapFee } from '@/utilities/bootstrapFees'
import { getServerSideURL } from '@/utilities/getURL'
import { logError } from '@/utilities/logError'
import { originFromHeaderValues } from '@/utilities/originFromHeaders'
import { feeCents, getPlatformFeeBps } from '@/utilities/platformFee'
import {
  detectLeftoverStripeEnvVars,
  disconnectSquareAccount,
  generateCheckoutRef,
  getCheckoutIntent,
  getPlatformSquareEnv,
  getTenantPaymentSettings,
  isPayPalConfigured,
  isSquareConfigured,
  saveConnectedSquareAccount,
} from '@/lib/payments/config'
import { fulfillVerifiedPayment } from '@/lib/payments/fulfillment'
import {
  parsePayPalWebhookEvent,
  registerPayPalWebhook,
  runPayPalSelfTest,
  verifyPayPalWebhookSignature,
} from '@/lib/payments/providers/paypal'
import {
  parseSquareWebhookEvent,
  registerSquareWebhook,
  resolveSquareLocationId,
  runSquareSelfTest,
  squareBaseUrl,
  verifySquareWebhookSignature,
} from '@/lib/payments/providers/square'
import {
  getAvailableProviders,
  resolveConnectedSquareForTenant,
  resolveProvider,
  startHostedCheckout,
  verifyOrCaptureCheckout,
} from '@/lib/payments/registry'
import type { PaymentProviderId } from '@/lib/payments/types'

function resolveOriginFromReq(req: Parameters<PayloadHandler>[0]): string {
  const host = req.headers?.get?.('x-forwarded-host') || req.headers?.get?.('host')
  const proto = req.headers?.get?.('x-forwarded-proto')
  return host ? originFromHeaderValues(host, proto) : getServerSideURL()
}

function isCronOrSuperAdmin(req: Parameters<PayloadHandler>[0]): boolean {
  const url = new URL(req.url || '', 'http://localhost')
  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get?.('authorization') || ''
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  const roles = ((req.user as { roles?: string[] } | null)?.roles) || []
  return keyOk || roles.includes('super_admin')
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
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return memberships.docs.length > 0
}

function signOAuthState(payloadObj: Record<string, unknown>): string {
  const secret = process.env.PAYLOAD_SECRET || process.env.ENCRYPTION_SECRET || 'angel-os-oauth'
  const b64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

function verifyOAuthState(stateRaw: string): Record<string, unknown> | null {
  const parts = stateRaw.split('.')
  if (parts.length !== 2) return null
  const [b64, sig] = parts
  const secret = process.env.PAYLOAD_SECRET || process.env.ENCRYPTION_SECRET || 'angel-os-oauth'
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

// ── 1. GET /api/payment-ops/providers ────────────────────────────────────────

export const paymentProvidersHandler: PayloadHandler = async (req) => {
  const { payload } = req
  const url = new URL(req.url || '', 'http://localhost')
  const slug =
    req.headers?.get?.('x-tenant-id') || url.searchParams.get('tenant') || ''

  let tenantId: number | string | null = null
  if (slug && slug !== 'default' && slug !== 'platform') {
    const res = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    tenantId = res.docs?.[0]?.id ?? null
  }

  const available = await getAvailableProviders(payload, tenantId)
  return Response.json({
    ok: true,
    ...available,
  })
}

// ── 2. POST /api/payment-ops/checkout (Unified Shop Cart Checkout) ───────────

export const paymentCheckoutHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const denied = applyRateLimit(req, 'orders')
  if (denied) return denied

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const cartId = body.cartId as string | number | undefined
  const customerEmail =
    typeof body.customerEmail === 'string'
      ? body.customerEmail.trim()
      : ((user as { email?: string } | null)?.email || '').trim()
  const requestedProvider =
    typeof body.provider === 'string' ? body.provider.trim() : undefined
  const fulfillmentMethod = body.fulfillmentMethod === 'pickup' ? 'pickup' : 'ship'
  const shippingAddress =
    body.shippingAddress && typeof body.shippingAddress === 'object'
      ? (body.shippingAddress as Record<string, unknown>)
      : undefined
  const billingAddress =
    body.billingAddress && typeof body.billingAddress === 'object'
      ? (body.billingAddress as Record<string, unknown>)
      : undefined

  if (!cartId) {
    return Response.json({ error: 'cartId is required' }, { status: 400 })
  }
  if (!customerEmail) {
    return Response.json({ error: 'A valid customerEmail is required' }, { status: 400 })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cart = (await (payload.findByID as any)({
      collection: 'carts',
      id: cartId,
      depth: 2,
      overrideAccess: true,
    }).catch(() => null)) as Record<string, any> | null

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return Response.json({ error: 'Cart is empty or not found.' }, { status: 404 })
    }

    // Compute exact amount in cents from cart subtotal or line items
    let amountCents = Number(cart.subtotal || 0)
    const itemTitles: string[] = []
    let inferredTenantId: number | undefined

    for (const item of cart.items) {
      const prod = typeof item.product === 'object' ? item.product : null
      const variant = typeof item.variant === 'object' ? item.variant : null
      if (prod?.title) itemTitles.push(`${prod.title}${item.quantity > 1 ? ` x${item.quantity}` : ''}`)
      if (inferredTenantId == null && prod?.tenant) {
        inferredTenantId = Number(typeof prod.tenant === 'object' ? prod.tenant.id : prod.tenant)
      }
      if (!amountCents) {
        const unit = Number(variant?.priceInUSD ?? prod?.priceInUSD ?? 0)
        amountCents += unit * (Number(item.quantity) || 1)
      }
    }

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return Response.json({ error: 'Cart total must be greater than zero.' }, { status: 400 })
    }

    const headerSlug = req.headers?.get?.('x-tenant-id') || ''
    if (inferredTenantId == null && cart.tenant) {
      inferredTenantId = Number(typeof cart.tenant === 'object' ? cart.tenant.id : cart.tenant)
    }
    if (inferredTenantId == null && headerSlug && headerSlug !== 'default') {
      const tRes = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: headerSlug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (tRes.docs?.[0]?.id != null) inferredTenantId = Number(tRes.docs[0].id)
    }

    let tenantName = 'Angel OS Store'
    let tenantSlug = headerSlug || undefined
    if (inferredTenantId != null) {
      const tDoc = (await payload
        .findByID({ collection: 'tenants', id: inferredTenantId, depth: 0, overrideAccess: true })
        .catch(() => null)) as { name?: string; slug?: string; branding?: { siteName?: string } } | null
      if (tDoc) {
        tenantName = tDoc.branding?.siteName || tDoc.name || tenantName
        tenantSlug = tDoc.slug || tenantSlug
      }
    }

    const provider = await resolveProvider(payload, requestedProvider, inferredTenantId)
    const connectedSquare =
      provider === 'square' && inferredTenantId != null
        ? await resolveConnectedSquareForTenant(payload, inferredTenantId)
        : null

    let applicationFeeCents = 0
    if (connectedSquare && inferredTenantId != null) {
      const baseFee = feeCents(amountCents, await getPlatformFeeBps(payload, inferredTenantId))
      let bootFee = 0
      try {
        const bf = await calculateBootstrapFee(inferredTenantId, amountCents)
        bootFee = bf.bootstrapFeeCents || 0
      } catch {
        bootFee = 0
      }
      applicationFeeCents = baseFee + bootFee
    }

    const ref = generateCheckoutRef()
    const origin = resolveOriginFromReq(req)
    const title =
      itemTitles.length > 0
        ? itemTitles.slice(0, 3).join(', ') + (itemTitles.length > 3 ? ` +${itemTitles.length - 3} more` : '')
        : `${tenantName} Order`

    const returnUrl = `${origin}/checkout/confirm-order?provider=${provider}&ref=${ref}&email=${encodeURIComponent(customerEmail)}`
    const cancelUrl = `${origin}/checkout?cancelled=1`

    const session = await startHostedCheckout(payload, {
      ref,
      provider,
      kind: 'order',
      title,
      description: `Order from ${tenantName}`,
      amountCents: Math.round(amountCents),
      currency: 'USD',
      tenantId: inferredTenantId,
      tenantSlug,
      tenantName,
      chargeModel: connectedSquare ? 'direct' : 'platform',
      applicationFeeCents,
      connectedSquare,
      customerEmail,
      collectShippingAddress: fulfillmentMethod === 'ship' && !shippingAddress,
      returnUrl,
      cancelUrl,
      intentData: {
        cartId: cart.id,
        fulfillmentMethod,
        shippingAddress,
        billingAddress,
        memberUserId: (user as { id?: number | string } | null)?.id,
      },
    })

    return Response.json({
      ok: true,
      checkoutUrl: session.checkoutUrl,
      provider: session.provider,
      externalId: session.externalId,
      ref: session.ref,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Checkout failed'
    void logError({
      source: 'payment-ops/checkout',
      message: msg,
      details: err instanceof Error ? err.stack : String(err),
      statusCode: 500,
    })
    const status = msg.includes('not configured') ? 503 : 500
    return Response.json({ error: msg }, { status })
  }
}

// ── 3. POST /api/payment-ops/confirm (Server-Verified Return Handler) ────────

export const paymentConfirmHandler: PayloadHandler = async (req) => {
  const { payload } = req
  let body: Record<string, unknown> = {}
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const ref = typeof body.ref === 'string' ? body.ref.trim() : ''
  const orderIdParam = typeof body.orderId === 'string' ? body.orderId.trim() : undefined
  const transactionIdParam =
    typeof body.transactionId === 'string' ? body.transactionId.trim() : undefined
  const subscriptionIdParam =
    typeof body.subscriptionId === 'string' ? body.subscriptionId.trim() : undefined

  if (!ref) {
    return Response.json({ error: 'ref is required' }, { status: 400 })
  }

  const intent = await getCheckoutIntent(payload, ref)
  if (!intent) {
    return Response.json({ error: 'Payment session not found.' }, { status: 404 })
  }

  if (intent.status === 'completed') {
    return Response.json({
      ok: true,
      alreadyConfirmed: true,
      kind: intent.kind,
      provider: intent.provider,
      status: 'completed',
      orderId: intent.orderId,
      bookingId: intent.bookingId,
      amountCents: intent.amountCents,
    })
  }

  try {
    const verified = await verifyOrCaptureCheckout(payload, {
      provider: intent.provider,
      intent,
      orderId: orderIdParam,
      transactionId: transactionIdParam,
      subscriptionId: subscriptionIdParam,
    })

    if (!verified.verified) {
      const code = verified.status === 'failed' || verified.status === 'canceled' ? 402 : 200
      return Response.json(
        {
          ok: false,
          pending: verified.status === 'pending',
          kind: intent.kind,
          provider: intent.provider,
          status: verified.status,
          rawStatus: verified.rawStatus,
          error:
            verified.status === 'pending'
              ? 'Payment is still finalizing — please retry in a moment.'
              : 'Payment was not completed.',
        },
        { status: code },
      )
    }

    const fulfilled = await fulfillVerifiedPayment(payload, {
      idempotencyKey: `confirm:${intent.ref}`,
      intent,
      verified,
    })

    return Response.json({
      ok: true,
      kind: intent.kind,
      provider: intent.provider,
      status: verified.status,
      orderId: fulfilled.orderId ?? intent.orderId,
      bookingId: fulfilled.bookingId ?? intent.bookingId,
      amountCents: verified.amountCents || intent.amountCents,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verification failed'
    void logError({
      source: 'payment-ops/confirm',
      message: `Payment confirm failed for ref=${ref}: ${msg}`,
      details: err instanceof Error ? err.stack : String(err),
      tenantId: intent.tenantId,
    })
    return Response.json({ error: msg }, { status: 500 })
  }
}

// ── 4. POST /api/payment-ops/webhooks/square ─────────────────────────────────

export const squareWebhookHandler: PayloadHandler = async (req) => {
  const { payload } = req
  let rawBody = ''
  try {
    rawBody = await (req as Request).text()
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  const sig = req.headers?.get?.('x-square-hmacsha256-signature')
  const webhookKey = getPlatformSquareEnv().webhookSignatureKey
  if (webhookKey) {
    const canonicalUrl = `${getServerSideURL()}/api/payment-ops/webhooks/square`
    const requestUrl = `${resolveOriginFromReq(req)}/api/payment-ops/webhooks/square`
    const valid =
      verifySquareWebhookSignature(rawBody, sig, canonicalUrl, webhookKey) ||
      verifySquareWebhookSignature(rawBody, sig, requestUrl, webhookKey)
    if (!valid) {
      return Response.json({ error: 'Invalid Square webhook signature' }, { status: 401 })
    }
  }

  const parsed = parseSquareWebhookEvent(rawBody)
  if (!parsed) {
    return Response.json({ received: true, ignored: true })
  }

  if (parsed.ref && parsed.status) {
    const intent = await getCheckoutIntent(payload, parsed.ref)
    if (intent) {
      await fulfillVerifiedPayment(payload, {
        idempotencyKey: `square:${parsed.eventId}`,
        intent,
        verified: {
          verified: parsed.status === 'completed' || parsed.status === 'active',
          provider: 'square',
          externalId: parsed.externalId || intent.externalId || parsed.ref,
          subscriptionId: parsed.subscriptionId,
          customerId: parsed.customerId,
          payerEmail: parsed.payerEmail,
          amountCents: parsed.amountCents,
          currentPeriodEnd: parsed.currentPeriodEnd,
          status:
            parsed.status === 'refunded'
              ? 'canceled'
              : parsed.status === 'active'
                ? 'active'
                : parsed.status === 'completed'
                  ? 'completed'
                  : parsed.status === 'canceled'
                    ? 'canceled'
                    : parsed.status === 'past_due'
                      ? 'past_due'
                      : 'failed',
        },
      }).catch((err) => {
        void logError({
          source: 'payment-ops/webhooks/square',
          message: `Square webhook fulfillment failed (${parsed.eventId}): ${err instanceof Error ? err.message : String(err)}`,
          tenantId: intent.tenantId,
        })
      })
    }
  }

  return Response.json({ received: true })
}

// ── 5. POST /api/payment-ops/webhooks/paypal ─────────────────────────────────

export const paypalWebhookHandler: PayloadHandler = async (req) => {
  const { payload } = req
  let rawBody = ''
  try {
    rawBody = await (req as Request).text()
  } catch {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  const valid = await verifyPayPalWebhookSignature(rawBody, req.headers).catch(() => false)
  if (!valid) {
    return Response.json({ error: 'Invalid PayPal webhook signature' }, { status: 401 })
  }

  const parsed = parsePayPalWebhookEvent(rawBody)
  if (!parsed) {
    return Response.json({ received: true, ignored: true })
  }

  if (parsed.ref && parsed.status) {
    const intent = await getCheckoutIntent(payload, parsed.ref)
    if (intent) {
      await fulfillVerifiedPayment(payload, {
        idempotencyKey: `paypal:${parsed.eventId}`,
        intent,
        verified: {
          verified: parsed.status === 'completed' || parsed.status === 'active',
          provider: 'paypal',
          externalId: parsed.externalId || intent.externalId || parsed.ref,
          subscriptionId: parsed.subscriptionId,
          payerEmail: parsed.payerEmail,
          amountCents: parsed.amountCents,
          currentPeriodEnd: parsed.currentPeriodEnd,
          status:
            parsed.status === 'refunded'
              ? 'canceled'
              : parsed.status === 'active'
                ? 'active'
                : parsed.status === 'completed'
                  ? 'completed'
                  : parsed.status === 'canceled'
                    ? 'canceled'
                    : parsed.status === 'past_due'
                      ? 'past_due'
                      : 'failed',
        },
      }).catch((err) => {
        void logError({
          source: 'payment-ops/webhooks/paypal',
          message: `PayPal webhook fulfillment failed (${parsed.eventId}): ${err instanceof Error ? err.message : String(err)}`,
          tenantId: intent.tenantId,
        })
      })
    }
  }

  return Response.json({ received: true })
}

// ── 6. Square Multi-Tenant OAuth Connect / Callback / Disconnect ─────────────

const SQUARE_OAUTH_SCOPES = [
  'PAYMENTS_WRITE',
  'ORDERS_WRITE',
  'CUSTOMERS_READ',
  'CUSTOMERS_WRITE',
  'SUBSCRIPTIONS_WRITE',
  'MERCHANT_PROFILE_READ',
].join(' ')

export const squareConnectInitHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const url = new URL(req.url || '', 'http://localhost')
  let tenantId: string | number | undefined = url.searchParams.get('tenantId') || undefined
  if (!tenantId && req.method === 'POST') {
    try {
      const body = (await (req as Request).json()) as { tenantId?: string | number }
      tenantId = body.tenantId
    } catch {
      /* ignore */
    }
  }

  if (!tenantId) {
    return Response.json({ error: 'tenantId is required' }, { status: 400 })
  }
  if (!(await userCanManageTenant(req, tenantId))) {
    return Response.json({ error: 'Not permitted for this tenant' }, { status: 403 })
  }

  const cfg = getPlatformSquareEnv()
  if (!cfg.applicationId || !cfg.applicationSecret) {
    return Response.json(
      {
        error:
          'Square OAuth is not configured yet (SQUARE_APPLICATION_ID / SQUARE_APPLICATION_SECRET missing).',
      },
      { status: 503 },
    )
  }

  const origin = resolveOriginFromReq(req)
  const state = signOAuthState({
    tenantId: Number(tenantId),
    userId: req.user.id,
    origin,
    ts: Date.now(),
  })

  const redirectUri = `${getServerSideURL()}/api/payment-ops/square/callback`
  const params = new URLSearchParams({
    client_id: cfg.applicationId,
    scope: SQUARE_OAUTH_SCOPES,
    session: 'false',
    state,
    redirect_uri: redirectUri,
  })

  const authUrl = `${squareBaseUrl(cfg.environment)}/oauth2/authorize?${params.toString()}`
  if (req.method === 'POST') {
    return Response.json({ ok: true, authUrl })
  }
  return new Response(null, { status: 302, headers: { Location: authUrl } })
}

export const squareConnectCallbackHandler: PayloadHandler = async (req) => {
  const { payload } = req
  const url = new URL(req.url || '', 'http://localhost')
  const code = url.searchParams.get('code')
  const stateRaw = url.searchParams.get('state') || ''
  const errParam = url.searchParams.get('error')

  const state = verifyOAuthState(stateRaw)
  const returnOrigin =
    (typeof state?.origin === 'string' && state.origin) || getServerSideURL()

  const backWith = (query: string) =>
    new Response(null, {
      status: 302,
      headers: { Location: `${returnOrigin}/dashboard/admin/payments?${query}` },
    })

  if (errParam) {
    return backWith(`square_error=${encodeURIComponent(errParam)}`)
  }
  if (!code || !state?.tenantId) {
    return backWith('square_error=missing_code_or_state')
  }

  const cfg = getPlatformSquareEnv()
  if (!cfg.applicationId || !cfg.applicationSecret) {
    return backWith('square_error=oauth_not_configured')
  }

  try {
    const tokenRes = await fetch(`${squareBaseUrl(cfg.environment)}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Square-Version': '2025-10-16',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: cfg.applicationId,
        client_secret: cfg.applicationSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: `${getServerSideURL()}/api/payment-ops/square/callback`,
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!tokenRes.ok) {
      return backWith(`square_error=${encodeURIComponent(`token_http_${tokenRes.status}`)}`)
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string
      refresh_token?: string
      expires_at?: string
      merchant_id?: string
    }

    if (!tokenData.access_token || !tokenData.merchant_id) {
      return backWith('square_error=incomplete_token')
    }

    const { locationId, locationName } = await resolveSquareLocationId(
      payload,
      tokenData.access_token,
      cfg.environment,
    )

    let merchantName = locationName
    try {
      const meRes = await fetch(`${squareBaseUrl(cfg.environment)}/v2/merchants/me`, {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Square-Version': '2025-10-16',
        },
        signal: AbortSignal.timeout(8_000),
      })
      if (meRes.ok) {
        const meData = (await meRes.json()) as { merchant?: { business_name?: string } }
        merchantName = meData.merchant?.business_name || merchantName
      }
    } catch {
      /* non-fatal */
    }

    await saveConnectedSquareAccount(payload, Number(state.tenantId), {
      merchantId: tokenData.merchant_id,
      merchantName,
      locationId,
      environment: cfg.environment,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_at,
      connectedAt: new Date().toISOString(),
    })

    return backWith('square=connected')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'oauth_failed'
    return backWith(`square_error=${encodeURIComponent(msg.slice(0, 100))}`)
  }
}

export const squareDisconnectHandler: PayloadHandler = async (req) => {
  if (!req.user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }
  const denied = applyRateLimit(req, 'stripe_disconnect')
  if (denied) return denied

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const tenantId = body.tenantId as number | string | undefined
  if (!tenantId) {
    return Response.json({ error: 'tenantId is required' }, { status: 400 })
  }
  if (!(await userCanManageTenant(req, tenantId))) {
    return Response.json({ error: 'Not permitted for this tenant' }, { status: 403 })
  }

  await disconnectSquareAccount(req.payload, tenantId)
  return Response.json({ ok: true })
}

// ── 7. GET|POST /api/payment-ops/setup (Self-Test + Webhook Bootstrap) ──────

export const paymentSetupDiagnosticsHandler: PayloadHandler = async (req) => {
  if (!isCronOrSuperAdmin(req)) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  const { payload } = req
  const canonicalUrl = getServerSideURL()
  const squareWebhookUrl = `${canonicalUrl}/api/payment-ops/webhooks/square`
  const paypalWebhookUrl = `${canonicalUrl}/api/payment-ops/webhooks/paypal`

  if (req.method === 'POST') {
    let body: Record<string, unknown> = {}
    try {
      body = (await (req as Request).json()) as Record<string, unknown>
    } catch {
      body = {}
    }

    if (body.action === 'bootstrap-webhooks') {
      const results: Record<string, unknown> = {}
      if (isSquareConfigured()) {
        try {
          results.square = await registerSquareWebhook(squareWebhookUrl)
        } catch (err) {
          results.square = { error: err instanceof Error ? err.message : String(err) }
        }
      } else {
        results.square = { skipped: 'SQUARE_ACCESS_TOKEN not set' }
      }

      if (isPayPalConfigured()) {
        try {
          results.paypal = await registerPayPalWebhook(paypalWebhookUrl)
        } catch (err) {
          results.paypal = { error: err instanceof Error ? err.message : String(err) }
        }
      } else {
        results.paypal = { skipped: 'PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET not set' }
      }

      return Response.json({
        ok: true,
        action: 'bootstrap-webhooks',
        webhookUrls: { square: squareWebhookUrl, paypal: paypalWebhookUrl },
        results,
      })
    }
  }

  const [squareSelfTest, paypalSelfTest] = await Promise.all([
    runSquareSelfTest(payload),
    runPayPalSelfTest(),
  ])

  const leftoverStripeVars = detectLeftoverStripeEnvVars()
  const url = new URL(req.url || '', 'http://localhost')
  const tenantIdParam = url.searchParams.get('tenantId')
  const tenantSettings = tenantIdParam
    ? await getTenantPaymentSettings(payload, tenantIdParam)
    : undefined

  return Response.json({
    ok: true,
    ready: squareSelfTest.healthy || paypalSelfTest.healthy,
    rails: {
      square: squareSelfTest,
      paypal: paypalSelfTest,
    },
    leftoverStripeEnvVars: leftoverStripeVars,
    expectedWebhookUrls: {
      square: squareWebhookUrl,
      paypal: paypalWebhookUrl,
      squareOAuthRedirect: `${canonicalUrl}/api/payment-ops/square/callback`,
    },
    ...(tenantSettings
      ? {
          tenantSquareConnected: Boolean(tenantSettings.square?.connected),
          tenantSquareMerchant: tenantSettings.square?.merchantName || null,
        }
      : {}),
  })
}

export type { PaymentProviderId }
