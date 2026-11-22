/**
 * PayPal & Venmo Payment Rail Provider (Companion Rail)
 *
 * Uses PayPal REST API v2 via native fetch (zero SDK bloat):
 *   - Hosted Checkout via Orders v2 (/v2/checkout/orders) -> PayPal, Venmo, Pay Later, Cards
 *   - Recurring Subscriptions via Billing Subscriptions v1 (/v1/billing/subscriptions)
 *   - Auto-created Catalog Products & Billing Plans cached in SettingService
 *   - Remote cryptographic webhook verification (/v1/notifications/verify-webhook-signature)
 */
import type { Payload } from 'payload'
import {
  getCachedProviderValue,
  getPlatformPayPalEnv,
  setCachedProviderValue,
} from '../config'
import type {
  CheckoutSessionRequest,
  CheckoutSessionResult,
  ParsedWebhookEvent,
  PaymentEnvironment,
  ProviderSelfTestResult,
  VerifiedPaymentResult,
} from '../types'

export const PAYPAL_WEBHOOK_EVENTS = [
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.REFUNDED',
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'PAYMENT.SALE.COMPLETED',
]

export function paypalBaseUrl(env: PaymentEnvironment): string {
  return env === 'production'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com'
}

let cachedToken: { key: string; token: string; expiresAt: number } | null = null

export async function getPayPalAccessToken(
  override?: { clientId?: string; clientSecret?: string; environment?: PaymentEnvironment },
): Promise<{ accessToken: string; environment: PaymentEnvironment }> {
  const cfg = getPlatformPayPalEnv()
  const clientId = override?.clientId || cfg.clientId
  const clientSecret = override?.clientSecret || cfg.clientSecret
  const environment = override?.environment || cfg.environment

  if (!clientId || !clientSecret) {
    throw new Error('PayPal is not configured — PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing.')
  }

  const cacheKey = `${environment}:${clientId}`
  if (cachedToken && cachedToken.key === cacheKey && cachedToken.expiresAt > Date.now() + 60_000) {
    return { accessToken: cachedToken.token, environment }
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(`${paypalBaseUrl(environment)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(12_000),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`PayPal OAuth failed (${res.status}): ${errText.slice(0, 200)}`)
  }

  const data = (await res.json()) as { access_token?: string; expires_in?: number }
  if (!data.access_token) {
    throw new Error('PayPal OAuth response missing access_token')
  }

  cachedToken = {
    key: cacheKey,
    token: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in) || 300) * 1000,
  }
  return { accessToken: data.access_token, environment }
}

async function paypalFetch<T = Record<string, unknown>>(
  path: string,
  init: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
  override?: { clientId?: string; clientSecret?: string; environment?: PaymentEnvironment },
): Promise<{ ok: boolean; status: number; data: T; errorText?: string; environment: PaymentEnvironment }> {
  const { accessToken, environment } = await getPayPalAccessToken(override)
  const res = await fetch(`${paypalBaseUrl(environment)}${path}`, {
    method: init.method || 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...init.headers,
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
    const msg = (data as any)?.message || (data as any)?.error_description || text.slice(0, 240)
    return {
      ok: false,
      status: res.status,
      data,
      errorText: String(msg || `PayPal HTTP ${res.status}`),
      environment,
    }
  }
  return { ok: true, status: res.status, data, environment }
}

async function ensurePayPalProduct(
  payload: Payload,
  env: PaymentEnvironment,
): Promise<string> {
  const cacheKey = `paypal:product:${env}`
  const cached = await getCachedProviderValue<string>(payload, cacheKey)
  if (cached) return cached

  const res = await paypalFetch<{ id?: string }>('/v1/catalogs/products', {
    method: 'POST',
    body: {
      name: 'Angel OS Memberships & Portal Plans',
      description: 'Community memberships, guardian angel subscriptions, and portal hosting plans.',
      type: 'SERVICE',
      category: 'SOFTWARE',
    },
  })

  if (!res.ok || !res.data.id) {
    throw new Error(`PayPal product creation failed: ${res.errorText}`)
  }

  await setCachedProviderValue(payload, cacheKey, res.data.id).catch(() => {})
  return res.data.id
}

async function ensurePayPalBillingPlan(
  payload: Payload,
  opts: {
    env: PaymentEnvironment
    planKey: string
    title: string
    amountCents: number
    interval: 'month' | 'year'
  },
): Promise<string> {
  const cacheKey = `paypal:plan:${opts.env}:${opts.planKey}:${opts.amountCents}:${opts.interval}`
  const cached = await getCachedProviderValue<string>(payload, cacheKey)
  if (cached) return cached

  const productId = await ensurePayPalProduct(payload, opts.env)
  const intervalUnit = opts.interval === 'year' ? 'YEAR' : 'MONTH'
  const res = await paypalFetch<{ id?: string }>('/v1/billing/plans', {
    method: 'POST',
    body: {
      product_id: productId,
      name: opts.title.slice(0, 127),
      description: `${opts.title} recurring subscription`.slice(0, 127),
      status: 'ACTIVE',
      billing_cycles: [
        {
          frequency: { interval_unit: intervalUnit, interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 1,
          total_cycles: 0,
          pricing_scheme: {
            fixed_price: {
              value: (opts.amountCents / 100).toFixed(2),
              currency_code: 'USD',
            },
          },
        },
      ],
      payment_preferences: {
        auto_bill_outstanding: true,
        setup_fee_failure_action: 'CANCEL',
        payment_failure_threshold: 3,
      },
    },
  })

  if (!res.ok || !res.data.id) {
    throw new Error(`PayPal billing plan creation failed: ${res.errorText}`)
  }

  await setCachedProviderValue(payload, cacheKey, res.data.id).catch(() => {})
  return res.data.id
}

export async function createPayPalCheckout(
  payload: Payload,
  req: CheckoutSessionRequest,
): Promise<CheckoutSessionResult> {
  const cfg = getPlatformPayPalEnv()
  const currency = (req.currency || 'USD').toUpperCase()
  const isRecurring =
    req.kind === 'membership' || req.kind === 'portal_plan' || req.kind === 'guardian_angel'

  if (isRecurring) {
    const planId = await ensurePayPalBillingPlan(payload, {
      env: cfg.environment,
      planKey: req.planKey || req.kind,
      title: req.title,
      amountCents: req.amountCents,
      interval: req.interval || 'month',
    })

    const subRes = await paypalFetch<{
      id?: string
      links?: Array<{ rel?: string; href?: string }>
    }>('/v1/billing/subscriptions', {
      method: 'POST',
      body: {
        plan_id: planId,
        custom_id: req.ref,
        ...(req.customerEmail
          ? {
              subscriber: {
                email_address: req.customerEmail,
                ...(req.customerName
                  ? {
                      name: {
                        given_name: req.customerName.split(/\s+/)[0] || req.customerName,
                        surname: req.customerName.split(/\s+/).slice(1).join(' ') || undefined,
                      },
                    }
                  : {}),
              },
            }
          : {}),
        application_context: {
          brand_name: (req.tenantName || 'Angel OS').slice(0, 127),
          locale: 'en-US',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: req.returnUrl,
          cancel_url: req.cancelUrl,
        },
      },
    })

    const approveUrl = subRes.data.links?.find((l) => l.rel === 'approve')?.href
    if (!subRes.ok || !subRes.data.id || !approveUrl) {
      throw new Error(`PayPal subscription failed: ${subRes.errorText || 'Missing approve link'}`)
    }

    return {
      provider: 'paypal',
      environment: cfg.environment,
      checkoutUrl: approveUrl,
      externalId: subRes.data.id,
      ref: req.ref,
    }
  }

  const orderRes = await paypalFetch<{
    id?: string
    links?: Array<{ rel?: string; href?: string }>
  }>('/v2/checkout/orders', {
    method: 'POST',
    body: {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: req.ref,
          custom_id: req.ref,
          description: (req.description || req.title).slice(0, 127),
          amount: {
            currency_code: currency,
            value: (req.amountCents / 100).toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: (req.tenantName || 'Angel OS').slice(0, 127),
        landing_page: 'LOGIN',
        shipping_preference: req.collectShippingAddress ? 'GET_FROM_FILE' : 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: req.returnUrl,
        cancel_url: req.cancelUrl,
      },
    },
  })

  const approveUrl = orderRes.data.links?.find((l) => l.rel === 'approve')?.href
  if (!orderRes.ok || !orderRes.data.id || !approveUrl) {
    throw new Error(`PayPal order creation failed: ${orderRes.errorText || 'Missing approve link'}`)
  }

  return {
    provider: 'paypal',
    environment: cfg.environment,
    checkoutUrl: approveUrl,
    externalId: orderRes.data.id,
    ref: req.ref,
  }
}

export async function captureOrVerifyPayPalCheckout(params: {
  orderId?: string
  subscriptionId?: string
}): Promise<VerifiedPaymentResult> {
  const subId = (params.subscriptionId || '').trim()
  if (subId) {
    const res = await paypalFetch<{
      id?: string
      status?: string
      subscriber?: { email_address?: string; name?: { given_name?: string; surname?: string } }
      billing_info?: { next_billing_time?: string }
    }>(`/v1/billing/subscriptions/${encodeURIComponent(subId)}`)

    if (!res.ok) {
      throw new Error(`PayPal subscription verify failed: ${res.errorText}`)
    }
    const rawStatus = res.data.status || ''
    const active = rawStatus === 'ACTIVE' || rawStatus === 'APPROVED'
    const fullName = [res.data.subscriber?.name?.given_name, res.data.subscriber?.name?.surname]
      .filter(Boolean)
      .join(' ')

    return {
      verified: active,
      provider: 'paypal',
      externalId: subId,
      subscriptionId: subId,
      payerEmail: res.data.subscriber?.email_address,
      payerName: fullName || undefined,
      status: active ? 'active' : 'pending',
      currentPeriodEnd: res.data.billing_info?.next_billing_time,
      rawStatus,
    }
  }

  const orderId = (params.orderId || '').trim()
  if (!orderId) {
    return {
      verified: false,
      provider: 'paypal',
      externalId: '',
      status: 'pending',
    }
  }

  let res = await paypalFetch<{
    id?: string
    status?: string
    payer?: { email_address?: string; name?: { given_name?: string; surname?: string } }
    purchase_units?: Array<{
      payments?: {
        captures?: Array<{
          id?: string
          status?: string
          amount?: { value?: string }
        }>
      }
    }>
  }>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    body: {},
  })

  if (!res.ok && res.status === 422) {
    // Already captured — inspect current order state
    res = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}`)
  }

  if (!res.ok) {
    throw new Error(`PayPal capture failed: ${res.errorText}`)
  }

  const capture = res.data.purchase_units?.[0]?.payments?.captures?.[0]
  const rawStatus = capture?.status || res.data.status || ''
  const completed = rawStatus === 'COMPLETED'
  const valNum = capture?.amount?.value ? Number(capture.amount.value) : NaN
  const amountCents = Number.isFinite(valNum) ? Math.round(valNum * 100) : undefined
  const fullName = [res.data.payer?.name?.given_name, res.data.payer?.name?.surname]
    .filter(Boolean)
    .join(' ')

  return {
    verified: completed,
    provider: 'paypal',
    externalId: orderId,
    transactionId: capture?.id,
    payerEmail: res.data.payer?.email_address,
    payerName: fullName || undefined,
    status: completed ? 'completed' : 'pending',
    amountCents,
    rawStatus,
  }
}

export async function verifyPayPalWebhookSignature(
  rawBody: string,
  headers: Headers,
): Promise<boolean> {
  const cfg = getPlatformPayPalEnv()
  if (!cfg.webhookId) return false

  const authAlgo = headers.get('paypal-auth-algo')
  const certUrl = headers.get('paypal-cert-url')
  const transmissionId = headers.get('paypal-transmission-id')
  const transmissionSig = headers.get('paypal-transmission-sig')
  const transmissionTime = headers.get('paypal-transmission-time')

  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    return false
  }

  let webhookEvent: unknown
  try {
    webhookEvent = JSON.parse(rawBody)
  } catch {
    return false
  }

  const res = await paypalFetch<{ verification_status?: string }>(
    '/v1/notifications/verify-webhook-signature',
    {
      method: 'POST',
      body: {
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: cfg.webhookId,
        webhook_event: webhookEvent,
      },
    },
  )

  return res.ok && res.data.verification_status === 'SUCCESS'
}

export function parsePayPalWebhookEvent(rawBody: string): ParsedWebhookEvent | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = JSON.parse(rawBody) as Record<string, any>
    const eventId = String(payload.id || '')
    const eventType = String(payload.event_type || '')
    if (!eventId || !eventType) return null

    const resource = payload.resource || {}
    const customId = resource.custom_id ? String(resource.custom_id) : undefined
    const valStr = resource.amount?.total || resource.amount?.value
    const amountCents = valStr && Number.isFinite(Number(valStr)) ? Math.round(Number(valStr) * 100) : undefined

    let status: ParsedWebhookEvent['status']
    let subscriptionId: string | undefined
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      status = 'completed'
    } else if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      status = 'refunded'
    } else if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED' || eventType === 'BILLING.SUBSCRIPTION.UPDATED') {
      subscriptionId = resource.id ? String(resource.id) : undefined
      const s = String(resource.status || '')
      status = s === 'ACTIVE' ? 'active' : s === 'CANCELLED' || s === 'EXPIRED' ? 'canceled' : 'past_due'
    } else if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED' || eventType === 'BILLING.SUBSCRIPTION.SUSPENDED') {
      subscriptionId = resource.id ? String(resource.id) : undefined
      status = eventType === 'BILLING.SUBSCRIPTION.CANCELLED' ? 'canceled' : 'past_due'
    } else if (eventType === 'PAYMENT.SALE.COMPLETED') {
      subscriptionId = resource.billing_agreement_id ? String(resource.billing_agreement_id) : undefined
      status = 'active'
    }

    return {
      eventId,
      eventType,
      provider: 'paypal',
      ref: customId,
      externalId: resource.supplementary_data?.related_ids?.order_id || resource.id,
      subscriptionId,
      payerEmail: resource.subscriber?.email_address || resource.payer?.email_address,
      amountCents,
      status,
      currentPeriodEnd: resource.billing_info?.next_billing_time,
    }
  } catch {
    return null
  }
}

export async function registerPayPalWebhook(
  webhookUrl: string,
  override?: { clientId?: string; clientSecret?: string; environment?: PaymentEnvironment },
): Promise<{ webhookId: string; existed: boolean }> {
  const existing = await paypalFetch<{
    webhooks?: Array<{ id?: string; url?: string }>
  }>('/v1/notifications/webhooks', {}, override)

  if (existing.ok) {
    const matched = existing.data.webhooks?.find((w) => w.url === webhookUrl)
    if (matched?.id) {
      return { webhookId: matched.id, existed: true }
    }
  }

  const created = await paypalFetch<{ id?: string }>(
    '/v1/notifications/webhooks',
    {
      method: 'POST',
      body: {
        url: webhookUrl,
        event_types: PAYPAL_WEBHOOK_EVENTS.map((name) => ({ name })),
      },
    },
    override,
  )

  if (!created.ok || !created.data.id) {
    throw new Error(`PayPal webhook registration failed: ${created.errorText}`)
  }

  return { webhookId: created.data.id, existed: false }
}

export async function runPayPalSelfTest(): Promise<ProviderSelfTestResult> {
  const cfg = getPlatformPayPalEnv()
  const errors: string[] = []
  const warnings: string[] = []

  if (!cfg.clientId || !cfg.clientSecret) {
    return {
      provider: 'paypal',
      configured: false,
      healthy: false,
      environment: cfg.environment,
      webhookConfigured: Boolean(cfg.webhookId),
      errors: ['PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set.'],
      warnings: [],
    }
  }

  let detectedMismatch: PaymentEnvironment | undefined
  try {
    await getPayPalAccessToken()
  } catch (err) {
    const opposite: PaymentEnvironment = cfg.environment === 'production' ? 'sandbox' : 'production'
    try {
      await getPayPalAccessToken({
        clientId: cfg.clientId,
        clientSecret: cfg.clientSecret,
        environment: opposite,
      })
      detectedMismatch = opposite
      errors.push(
        `PAYPAL_ENVIRONMENT is "${cfg.environment}", but your credentials belong to PayPal "${opposite}". Set PAYPAL_ENVIRONMENT=${opposite}.`,
      )
    } catch {
      errors.push(err instanceof Error ? err.message : String(err))
    }
  }

  if (!cfg.webhookId) {
    warnings.push(
      'PAYPAL_WEBHOOK_ID is not set — run setup-payments or auto-register webhooks so PayPal subscriptions and async captures sync automatically.',
    )
  }

  return {
    provider: 'paypal',
    configured: true,
    healthy: errors.length === 0,
    environment: cfg.environment,
    ...(detectedMismatch ? { detectedEnvironmentMismatch: detectedMismatch } : {}),
    webhookConfigured: Boolean(cfg.webhookId),
    errors,
    warnings,
  }
}
