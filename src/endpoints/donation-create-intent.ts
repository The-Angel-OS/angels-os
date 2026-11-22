/**
 * Donation Checkout Endpoint — POST /api/donation-ops/create-intent
 *
 * Starts a Square or PayPal hosted checkout session for one-time donations.
 * Keeps MIN_DONATION_CENTS = 500 + IP/user rate limiting to prevent card-testing abuse.
 */
import type { PayloadHandler } from 'payload'
import { generateCheckoutRef } from '@/lib/payments/config'
import { startHostedCheckout } from '@/lib/payments/registry'
import { checkApiRateLimit, extractRateLimitKey } from '@/utilities/apiRateLimiter'
import { DONATION_JUSTICE_FUND_PERCENT, resolveDonationRecipient } from '@/utilities/donationRouting'
import { getServerSideURL } from '@/utilities/getURL'
import { logError } from '@/utilities/logError'
import { originFromHeaderValues } from '@/utilities/originFromHeaders'

/** Minimum donation: $5.00 (500 cents) */
const MIN_DONATION_CENTS = 500
/** Maximum donation: $10,000.00 (1,000,000 cents) */
const MAX_DONATION_CENTS = 1_000_000

export const donationCreateIntentHandler: PayloadHandler = async (req) => {
  const rateLimitKey = extractRateLimitKey(req)
  const rateLimit = checkApiRateLimit(rateLimitKey, 'stripe')
  if (!rateLimit.allowed) {
    return Response.json(
      { error: 'Too many donation attempts. Please wait a moment before trying again.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await (req as unknown as Request).json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { amount, donorEmail, donorName, message, tenantSlug, provider: requestedProvider } = body

  if (typeof amount !== 'number' || !Number.isInteger(amount)) {
    return Response.json({ error: 'amount must be an integer (cents)' }, { status: 400 })
  }
  if (amount < MIN_DONATION_CENTS) {
    return Response.json(
      { error: `Minimum donation is $${(MIN_DONATION_CENTS / 100).toFixed(2)}` },
      { status: 400 },
    )
  }
  if (amount > MAX_DONATION_CENTS) {
    return Response.json(
      { error: `Maximum donation is $${(MAX_DONATION_CENTS / 100).toFixed(2)}` },
      { status: 400 },
    )
  }

  const headerTenant = req.headers?.get('x-tenant-id') || ''
  const bodySlug =
    typeof tenantSlug === 'string' && tenantSlug && tenantSlug !== 'default' ? tenantSlug : ''
  const slug = headerTenant || bodySlug

  let resolvedTenantId: number | undefined
  let recipientName = 'the Justice Fund'
  let chargeModel: 'platform' | 'direct' = 'platform'
  let applicationFeeCents = 0

  try {
    const recipient = await resolveDonationRecipient(req.payload, slug)
    resolvedTenantId = recipient.tenantId
    recipientName = recipient.recipientName
    if (recipient.chargeModel === 'destination') {
      chargeModel = 'direct'
      applicationFeeCents = Math.round((amount * DONATION_JUSTICE_FUND_PERCENT) / 100)
    }
  } catch (err) {
    void logError({
      level: 'warning',
      source: 'donation-create-intent/resolveTenantAccount',
      message: `Failed to resolve donation recipient for tenant '${slug}': ${err instanceof Error ? err.message : String(err)}`,
      tenantId: resolvedTenantId,
    })
  }

  try {
    const host = req.headers?.get?.('x-forwarded-host') || req.headers?.get?.('host')
    const proto = req.headers?.get?.('x-forwarded-proto')
    const origin = host ? originFromHeaderValues(host, proto) : getServerSideURL()
    const ref = generateCheckoutRef()

    const session = await startHostedCheckout(req.payload, {
      ref,
      provider: typeof requestedProvider === 'string' ? (requestedProvider as 'square' | 'paypal') : undefined,
      kind: 'donation',
      title: `Donation to ${recipientName}`,
      description:
        typeof donorName === 'string' && donorName.trim()
          ? `Gift to ${recipientName} from ${donorName.trim()}`
          : `Gift to ${recipientName}`,
      amountCents: amount,
      currency: 'USD',
      tenantId: resolvedTenantId,
      tenantSlug: slug || undefined,
      tenantName: recipientName,
      recipientName,
      chargeModel,
      applicationFeeCents,
      customerEmail: typeof donorEmail === 'string' ? donorEmail.trim() : undefined,
      customerName: typeof donorName === 'string' ? donorName.trim() : undefined,
      returnUrl: `${origin}/donate?success=true&amount=${amount}&ref=${ref}`,
      cancelUrl: `${origin}/donate?cancelled=true`,
      intentData: {
        donorEmail: typeof donorEmail === 'string' ? donorEmail.trim() : undefined,
        donorName: typeof donorName === 'string' ? donorName.trim() : undefined,
        message: typeof message === 'string' ? message.slice(0, 500) : undefined,
      },
    })

    return Response.json({
      ok: true,
      checkoutUrl: session.checkoutUrl,
      provider: session.provider,
      externalId: session.externalId,
      ref: session.ref,
      recipientName,
      chargeModel,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to start donation checkout'
    void logError({
      source: 'donation-create-intent',
      message: msg,
      details: err instanceof Error ? err.stack : String(err),
      statusCode: 500,
      tenantId: resolvedTenantId,
    })
    return Response.json(
      { error: msg },
      { status: msg.includes('not configured') ? 503 : 500 },
    )
  }
}
