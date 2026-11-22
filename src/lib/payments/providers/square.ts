/**
 * Square Payment Rail Provider (Primary)
 *
 * Uses Square REST API v2 via native fetch (zero SDK bloat):
 *   - Hosted Checkout via Payment Links (/v2/online-checkout/payment-links)
 *   - Multi-tenant Direct Charges via Square OAuth + app_fee_money
 *   - Auto-discovered Location IDs & Catalog Subscription Plans cached in SettingService
 *   - HMAC-SHA256 Webhook verification & idempotent webhook auto-registration
 */
import crypto from 'node:crypto'
import type { Payload } from 'payload'
import {
  getCachedProviderValue,
  getPlatformSquareEnv,
  saveConnectedSquareAccount,
  setCachedProviderValue,
} from '../config'
import type {
  CheckoutSessionRequest,
  CheckoutSessionResult,
  DecryptedSquareCredentials,
  ParsedWebhookEvent,
  PaymentEnvironment,
  ProviderSelfTestResult,
  VerifiedPaymentResult,
} from '../types'

const SQUARE_VERSION = '2025-10-16'

export const SQUARE_WEBHOOK_EVENTS = [
  'payment.completed',
  'payment.updated',
  'subscription.created',
  'subscription.updated',
  'invoice.payment_made',
  'refund.created',
]

export function squareBaseUrl(env: PaymentEnvironment): string {
  return env === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com'
}

async function squareFetch<T = Record<string, unknown>>(
  env: PaymentEnvironment,
  accessToken: string,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; data: T; errorText?: string }> {
  const res = await fetch(`${squareBaseUrl(env)}${path}`, {
    method: init.method || 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    signal: AbortSignal.timeout(15_000),
  })
  const text = await res.text()
  let data = {} as T
  try {
    data = (text ? JSON.parse(text) : {}) as T
  } catch {
    data = {} as T
  }
  if (!res.ok) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errors = (data as any)?.errors
    const detail = Array.isArray(errors) && errors[0]?.detail ? String(errors[0].detail) : text.slice(0, 240)
    return { ok: false, status: res.status, data, errorText: detail || `Square HTTP ${res.status}` }
  }
  return { ok: true, status: res.status, data }
}

/**
 * Discover and cache the first active card-processing Square Location ID.
 */
export async function resolveSquareLocationId(
  payload: Payload,
  accessToken: string,
  env: PaymentEnvironment,
  preferredLocationId?: string,
): Promise<{ locationId: string; locationName?: string }> {
  if (preferredLocationId?.trim()) {
    return { locationId: preferredLocationId.trim() }
  }

  const tokenHash = crypto.createHash('sha256').update(accessToken).digest('hex').slice(0, 12)
  const cacheKey = `square:location:${env}:${tokenHash}`
  const cached = await getCachedProviderValue<{ id: string; name?: string }>(payload, cacheKey)
  if (cached?.id) {
    return { locationId: cached.id, locationName: cached.name }
  }

  const res = await squareFetch<{
    locations?: Array<{
      id?: string
      name?: string
      status?: string
      capabilities?: string[]
    }>
  }>(env, accessToken, '/v2/locations')

  if (!res.ok) {
    throw new Error(`Square location lookup failed: ${res.errorText}`)
  }

  const locs = res.data.locations || []
  const chosen =
    locs.find((l) => l.status === 'ACTIVE' && l.capabilities?.includes('CREDIT_CARD_PROCESSING')) ||
    locs.find((l) => l.status === 'ACTIVE') ||
    locs[0]

  if (!chosen?.id) {
    throw new Error('No Square business locations found on this account.')
  }

  await setCachedProviderValue(payload, cacheKey, { id: chosen.id, name: chosen.name }).catch(() => {})
  return { locationId: chosen.id, locationName: chosen.name }
}

/**
 * Refresh a connected merchant's Square OAuth token when within 5 days of expiry.
 */
export async function refreshSquareOAuthTokenIfNeeded(
  payload: Payload,
  tenantId: number | string,
  creds: DecryptedSquareCredentials,
): Promise<DecryptedSquareCredentials> {
  if (!creds.refreshToken || !creds.expiresAt) return creds
  const expiresMs = Date.parse(creds.expiresAt)
  if (!Number.isFinite(expiresMs) || expiresMs - Date.now() > 5 * 86_400_000) {
    return creds
  }

  const envCfg = getPlatformSquareEnv()
  if (!envCfg.applicationId || !envCfg.applicationSecret) return creds

  const res = await fetch(`${squareBaseUrl(creds.environment)}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: envCfg.applicationId,
      client_secret: envCfg.applicationSecret,
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken,
    }),
    signal: AbortSignal.timeout(12_000),
  })

  if (!res.ok) return creds
  const data = (await res.json()) as {
    access_token?: string
    refresh_token?: string
    expires_at?: string
  }
  if (!data.access_token) return creds

  const refreshed: DecryptedSquareCredentials = {
    ...creds,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || creds.refreshToken,
    expiresAt: data.expires_at || creds.expiresAt,
  }
  await saveConnectedSquareAccount(payload, tenantId, refreshed).catch(() => {})
  return refreshed
}

async function ensureSquareSubscriptionPlanVariation(
  payload: Payload,
  opts: {
    accessToken: string
    env: PaymentEnvironment
    locationId: string
    planKey: string
    title: string
    amountCents: number
    interval: 'month' | 'year'
  },
): Promise<string> {
  const cacheKey = `square:subplan:${opts.env}:${opts.locationId}:${opts.planKey}:${opts.amountCents}:${opts.interval}`
  const cached = await getCachedProviderValue<string>(payload, cacheKey)
  if (cached) return cached

  const cadence = opts.interval === 'year' ? 'ANNUAL' : 'MONTHLY'
  const idempotencyKey = crypto.randomUUID()
  const res = await squareFetch<{
    catalog_object?: {
      id?: string
      subscription_plan_data?: {
        subscription_plan_variations?: Array<{ id?: string }>
      }
    }
    id_mappings?: Array<{ client_object_id?: string; object_id?: string }>
  }>(opts.env, opts.accessToken, '/v2/catalog/object', {
    method: 'POST',
    body: {
      idempotency_key: idempotencyKey,
      object: {
        type: 'SUBSCRIPTION_PLAN',
        id: `#plan_${opts.planKey}`,
        present_at_location_ids: [opts.locationId],
        subscription_plan_data: {
          name: opts.title.slice(0, 250),
          subscription_plan_variations: [
            {
              type: 'SUBSCRIPTION_PLAN_VARIATION',
              id: `#var_${opts.planKey}`,
              present_at_location_ids: [opts.locationId],
              subscription_plan_variation_data: {
                name: `${opts.title} (${cadence.toLowerCase()})`.slice(0, 250),
                phases: [
                  {
                    cadence,
                    ordinal: 0,
                    pricing: {
                      type: 'STATIC',
                      price_money: {
                        amount: opts.amountCents,
                        currency: 'USD',
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    },
  })

  if (!res.ok) {
    throw new Error(`Square subscription plan creation failed: ${res.errorText}`)
  }

  const mappedVarId =
    res.data.id_mappings?.find((m) => m.client_object_id === `#var_${opts.planKey}`)?.object_id ||
    res.data.catalog_object?.subscription_plan_data?.subscription_plan_variations?.[0]?.id

  if (!mappedVarId) {
    throw new Error('Square did not return a subscription plan variation ID.')
  }

  await setCachedProviderValue(payload, cacheKey, mappedVarId).catch(() => {})
  return mappedVarId
}

export async function createSquareCheckout(
  payload: Payload,
  req: CheckoutSessionRequest,
): Promise<CheckoutSessionResult> {
  const envCfg = getPlatformSquareEnv()
  const usingConnected = Boolean(req.connectedSquare?.accessToken && req.connectedSquare?.locationId)
  const accessToken = usingConnected ? req.connectedSquare!.accessToken : envCfg.accessToken
  const env = usingConnected ? req.connectedSquare!.environment : envCfg.environment

  if (!accessToken) {
    throw new Error('Square is not configured — SQUARE_ACCESS_TOKEN is missing.')
  }

  const { locationId } = await resolveSquareLocationId(
    payload,
    accessToken,
    env,
    usingConnected ? req.connectedSquare!.locationId : envCfg.locationId,
  )

  const currency = (req.currency || 'USD').toUpperCase()
  const isRecurring =
    req.kind === 'membership' || req.kind === 'portal_plan' || req.kind === 'guardian_angel'

  const idempotencyKey = `sq_${req.ref}_${Date.now()}`
  let linkBody: Record<string, unknown>

  if (isRecurring) {
    const variationId = await ensureSquareSubscriptionPlanVariation(payload, {
      accessToken,
      env,
      locationId,
      planKey: req.planKey || req.kind,
      title: req.title,
      amountCents: req.amountCents,
      interval: req.interval || 'month',
    })

    linkBody = {
      idempotency_key: idempotencyKey,
      quick_pay: {
        name: req.title.slice(0, 255),
        price_money: { amount: req.amountCents, currency },
        location_id: locationId,
      },
      checkout_options: {
        subscription_plan_id: variationId,
        redirect_url: req.returnUrl,
      },
      payment_note: `ref:${req.ref}`,
      ...(req.customerEmail ? { pre_populated_data: { buyer_email: req.customerEmail } } : {}),
    }
  } else {
    linkBody = {
      idempotency_key: idempotencyKey,
      order: {
        location_id: locationId,
        reference_id: req.ref,
        line_items: [
          {
            name: req.title.slice(0, 500),
            quantity: '1',
            base_price_money: {
              amount: req.amountCents,
              currency,
            },
            ...(req.description ? { note: req.description.slice(0, 500) } : {}),
          },
        ],
      },
      checkout_options: {
        redirect_url: req.returnUrl,
        ...(req.collectShippingAddress ? { ask_for_shipping_address: true } : {}),
        ...(usingConnected && req.applicationFeeCents && req.applicationFeeCents > 0
          ? {
              app_fee_money: {
                amount: req.applicationFeeCents,
                currency,
              },
            }
          : {}),
      },
      ...(req.customerEmail ? { pre_populated_data: { buyer_email: req.customerEmail } } : {}),
    }
  }

  const res = await squareFetch<{
    payment_link?: {
      id?: string
      url?: string
      long_url?: string
      order_id?: string
    }
  }>(env, accessToken, '/v2/online-checkout/payment-links', {
    method: 'POST',
    body: linkBody,
  })

  if (!res.ok || !res.data.payment_link?.url) {
    throw new Error(`Square checkout link failed: ${res.errorText || 'No checkout URL returned'}`)
  }

  return {
    provider: 'square',
    environment: env,
    checkoutUrl: res.data.payment_link.url,
    externalId: res.data.payment_link.order_id || res.data.payment_link.id || req.ref,
    ref: req.ref,
  }
}

export async function verifySquareCheckout(
  payload: Payload,
  params: {
    orderId?: string
    transactionId?: string
    connectedSquare?: DecryptedSquareCredentials | null
  },
): Promise<VerifiedPaymentResult> {
  const envCfg = getPlatformSquareEnv()
  const usingConnected = Boolean(params.connectedSquare?.accessToken)
  const accessToken = usingConnected ? params.connectedSquare!.accessToken : envCfg.accessToken
  const env = usingConnected ? params.connectedSquare!.environment : envCfg.environment

  if (!accessToken) {
    throw new Error('Square access token not configured')
  }

  const orderId = (params.orderId || params.transactionId || '').trim()
  if (!orderId) {
    return {
      verified: false,
      provider: 'square',
      externalId: '',
      status: 'pending',
    }
  }

  const orderRes = await squareFetch<{
    order?: {
      id?: string
      location_id?: string
      customer_id?: string
      state?: string
      total_money?: { amount?: number }
      tenders?: Array<{ id?: string; payment_id?: string }>
    }
  }>(env, accessToken, `/v2/orders/${encodeURIComponent(orderId)}`)

  let paymentId = orderRes.data.order?.tenders?.[0]?.payment_id
  let customerId = orderRes.data.order?.customer_id
  let amountCents = orderRes.data.order?.total_money?.amount
  let rawStatus = orderRes.data.order?.state || ''
  let payerEmail: string | undefined

  if (paymentId) {
    const payRes = await squareFetch<{
      payment?: {
        id?: string
        status?: string
        amount_money?: { amount?: number }
        customer_id?: string
        buyer_email_address?: string
      }
    }>(env, accessToken, `/v2/payments/${encodeURIComponent(paymentId)}`)

    if (payRes.ok && payRes.data.payment) {
      rawStatus = payRes.data.payment.status || rawStatus
      amountCents = payRes.data.payment.amount_money?.amount ?? amountCents
      customerId = payRes.data.payment.customer_id || customerId
      payerEmail = payRes.data.payment.buyer_email_address
    }
  } else if (!orderRes.ok) {
    // Caller may have passed a raw payment ID directly
    const payRes = await squareFetch<{
      payment?: {
        id?: string
        status?: string
        amount_money?: { amount?: number }
        customer_id?: string
        buyer_email_address?: string
      }
    }>(env, accessToken, `/v2/payments/${encodeURIComponent(orderId)}`)
    if (payRes.ok && payRes.data.payment) {
      paymentId = payRes.data.payment.id
      rawStatus = payRes.data.payment.status || ''
      amountCents = payRes.data.payment.amount_money?.amount
      customerId = payRes.data.payment.customer_id
      payerEmail = payRes.data.payment.buyer_email_address
    }
  }

  const completed = rawStatus === 'COMPLETED' || rawStatus === 'APPROVED'

  // Check if Square already created a subscription for this customer/location
  let subscriptionId: string | undefined
  let currentPeriodEnd: string | undefined
  if (completed && customerId && orderRes.data.order?.location_id) {
    const subSearch = await squareFetch<{
      subscriptions?: Array<{
        id?: string
        status?: string
        charged_through_date?: string
      }>
    }>(env, accessToken, '/v2/subscriptions/search', {
      method: 'POST',
      body: {
        query: {
          filter: {
            customer_ids: [customerId],
            location_ids: [orderRes.data.order.location_id],
          },
        },
        limit: 5,
      },
    })
    const activeSub =
      subSearch.data.subscriptions?.find((s) => s.status === 'ACTIVE') ||
      subSearch.data.subscriptions?.[0]
    if (activeSub?.id) {
      subscriptionId = activeSub.id
      if (activeSub.charged_through_date) {
        currentPeriodEnd = `${activeSub.charged_through_date}T23:59:59.000Z`
      }
    }
  }

  if (!payerEmail && customerId) {
    const custRes = await squareFetch<{ customer?: { email_address?: string } }>(
      env,
      accessToken,
      `/v2/customers/${encodeURIComponent(customerId)}`,
    )
    payerEmail = custRes.data.customer?.email_address
  }

  return {
    verified: completed,
    provider: 'square',
    externalId: orderId,
    transactionId: paymentId,
    subscriptionId: subscriptionId || (completed ? `order:${orderId}` : undefined),
    customerId,
    payerEmail,
    status: completed ? 'completed' : 'pending',
    amountCents,
    currentPeriodEnd,
    rawStatus,
  }
}

export function verifySquareWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookUrl: string,
  signatureKey: string,
): boolean {
  if (!signatureHeader || !signatureKey) return false
  const expected = crypto
    .createHmac('sha256', signatureKey)
    .update(webhookUrl + rawBody)
    .digest('base64')
  const a = Uint8Array.from(Buffer.from(signatureHeader))
  const b = Uint8Array.from(Buffer.from(expected))
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export function parseSquareWebhookEvent(rawBody: string): ParsedWebhookEvent | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = JSON.parse(rawBody) as Record<string, any>
    const eventId = String(payload.event_id || '')
    const eventType = String(payload.type || '')
    if (!eventId || !eventType) return null

    const obj = payload.data?.object || {}
    const payment = obj.payment
    const subscription = obj.subscription
    const invoice = obj.invoice
    const refund = obj.refund

    let ref: string | undefined
    const note = String(payment?.note || '')
    const refMatch = note.match(/ref:([a-f0-9]{16,40})/i)
    if (refMatch) ref = refMatch[1]
    if (!ref && payment?.reference_id) ref = String(payment.reference_id)

    let status: ParsedWebhookEvent['status']
    if (eventType === 'payment.completed' || eventType === 'payment.updated') {
      if (payment?.status === 'COMPLETED') status = 'completed'
      else if (payment?.status === 'FAILED' || payment?.status === 'CANCELED') status = 'failed'
    } else if (eventType === 'subscription.created' || eventType === 'subscription.updated') {
      const s = String(subscription?.status || '')
      if (s === 'ACTIVE') status = 'active'
      else if (s === 'CANCELED' || s === 'DEACTIVATED') status = 'canceled'
      else if (s === 'PAUSED') status = 'past_due'
    } else if (eventType === 'invoice.payment_made') {
      status = 'active'
    } else if (eventType === 'refund.created') {
      status = 'refunded'
    }

    return {
      eventId,
      eventType,
      provider: 'square',
      ref,
      externalId: payment?.order_id || payment?.id || invoice?.order_id || refund?.payment_id,
      subscriptionId: subscription?.id || invoice?.subscription_id,
      customerId: payment?.customer_id || subscription?.customer_id,
      payerEmail: payment?.buyer_email_address,
      amountCents: payment?.amount_money?.amount,
      status,
      currentPeriodEnd: subscription?.charged_through_date
        ? `${subscription.charged_through_date}T23:59:59.000Z`
        : undefined,
    }
  } catch {
    return null
  }
}

export async function registerSquareWebhook(
  webhookUrl: string,
  override?: { accessToken?: string; environment?: PaymentEnvironment },
): Promise<{ subscriptionId: string; signatureKey: string; existed: boolean }> {
  const cfg = getPlatformSquareEnv()
  const accessToken = override?.accessToken || cfg.accessToken
  const env = override?.environment || cfg.environment
  if (!accessToken) throw new Error('SQUARE_ACCESS_TOKEN is missing')

  const existing = await squareFetch<{
    subscriptions?: Array<{ id?: string; notification_url?: string; signature_key?: string; enabled?: boolean }>
  }>(env, accessToken, '/v2/webhooks/subscriptions')

  if (existing.ok) {
    const matched = existing.data.subscriptions?.find(
      (s) => s.notification_url === webhookUrl && s.enabled !== false,
    )
    if (matched?.id) {
      return {
        subscriptionId: matched.id,
        signatureKey: matched.signature_key || cfg.webhookSignatureKey,
        existed: true,
      }
    }
  }

  const created = await squareFetch<{
    subscription?: { id?: string; signature_key?: string }
  }>(env, accessToken, '/v2/webhooks/subscriptions', {
    method: 'POST',
    body: {
      idempotency_key: crypto.randomUUID(),
      subscription: {
        name: 'Angel OS Dual-Rail Payments',
        enabled: true,
        event_types: SQUARE_WEBHOOK_EVENTS,
        notification_url: webhookUrl,
        api_version: SQUARE_VERSION,
      },
    },
  })

  if (!created.ok || !created.data.subscription?.id) {
    throw new Error(`Square webhook registration failed: ${created.errorText}`)
  }

  return {
    subscriptionId: created.data.subscription.id,
    signatureKey: created.data.subscription.signature_key || '',
    existed: false,
  }
}

export async function runSquareSelfTest(payload: Payload): Promise<ProviderSelfTestResult> {
  const cfg = getPlatformSquareEnv()
  const errors: string[] = []
  const warnings: string[] = []

  if (!cfg.accessToken) {
    return {
      provider: 'square',
      configured: false,
      healthy: false,
      environment: cfg.environment,
      webhookConfigured: Boolean(cfg.webhookSignatureKey),
      errors: ['SQUARE_ACCESS_TOKEN is not set.'],
      warnings: [],
    }
  }

  const meRes = await squareFetch<{ merchant?: { id?: string; business_name?: string } }>(
    cfg.environment,
    cfg.accessToken,
    '/v2/merchants/me',
  )

  let detectedMismatch: PaymentEnvironment | undefined
  if (!meRes.ok && meRes.status === 401) {
    const opposite: PaymentEnvironment = cfg.environment === 'production' ? 'sandbox' : 'production'
    const oppProbe = await squareFetch(opposite, cfg.accessToken, '/v2/merchants/me')
    if (oppProbe.ok) {
      detectedMismatch = opposite
      errors.push(
        `SQUARE_ENVIRONMENT is "${cfg.environment}", but this Access Token belongs to Square "${opposite}". Set SQUARE_ENVIRONMENT=${opposite}.`,
      )
    } else {
      errors.push(`Square token rejected (401): ${meRes.errorText}`)
    }
  } else if (!meRes.ok) {
    errors.push(`Square API check failed: ${meRes.errorText}`)
  }

  let locationId = cfg.locationId
  let locationName: string | undefined
  if (meRes.ok) {
    try {
      const loc = await resolveSquareLocationId(payload, cfg.accessToken, cfg.environment, cfg.locationId)
      locationId = loc.locationId
      locationName = loc.locationName
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  if (!cfg.webhookSignatureKey) {
    warnings.push(
      'SQUARE_WEBHOOK_SIGNATURE_KEY is not set — run setup-payments or auto-register webhooks so renewals and async payments sync automatically.',
    )
  }
  if (!cfg.applicationId || !cfg.applicationSecret) {
    warnings.push(
      'SQUARE_APPLICATION_ID / SQUARE_APPLICATION_SECRET are unset — multi-tenant Endeavor OAuth is disabled until set (platform checkout still works).',
    )
  }

  return {
    provider: 'square',
    configured: true,
    healthy: errors.length === 0,
    environment: cfg.environment,
    ...(detectedMismatch ? { detectedEnvironmentMismatch: detectedMismatch } : {}),
    merchantOrAppName: meRes.data.merchant?.business_name || locationName,
    locationId: locationId || undefined,
    webhookConfigured: Boolean(cfg.webhookSignatureKey),
    errors,
    warnings,
  }
}
