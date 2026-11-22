/**
 * Guardian Angel Checkout — POST /api/provision-ops/guardian-angel-checkout
 *
 * Starts the paid Guardian Angel subscription on Square or PayPal hosted checkout.
 */
import type { PayloadHandler } from 'payload'
import { generateCheckoutRef } from '@/lib/payments/config'
import { startHostedCheckout } from '@/lib/payments/registry'
import { getServerSideURL } from '@/utilities/getURL'
import {
  GUARDIAN_ANGEL_PLAN_ID,
  GUARDIAN_ANGEL_PLAN_NAME,
  guardianAngelPriceCents,
  resolveGuardianTenant,
} from '@/utilities/guardianEntitlement'
import { logError } from '@/utilities/logError'
import { originFromHeaderValues } from '@/utilities/originFromHeaders'

export const guardianAngelCheckoutHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'sign-in required' }, { status: 401 })

  const u = user as { id: number | string; email?: string; name?: string }
  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    body = {}
  }

  try {
    const guardianTenant = await resolveGuardianTenant(payload, u.id)
    const guardianTenantId = guardianTenant?.id
    if (guardianTenantId == null) {
      return Response.json({ error: 'Claim your guardian angel before subscribing.' }, { status: 404 })
    }

    const priceCents = guardianAngelPriceCents()
    const host = req.headers?.get?.('x-forwarded-host') || req.headers?.get?.('host')
    const proto = req.headers?.get?.('x-forwarded-proto')
    const origin = host ? originFromHeaderValues(host, proto) : getServerSideURL()
    const memberEmail = (u.email || '').trim()
    const memberName = (u.name || '').trim()
    const ref = generateCheckoutRef()
    const requestedProvider =
      typeof body.provider === 'string' ? (body.provider as 'square' | 'paypal') : undefined

    const session = await startHostedCheckout(payload, {
      ref,
      provider: requestedProvider,
      kind: 'guardian_angel',
      title: GUARDIAN_ANGEL_PLAN_NAME,
      description: 'Personal Guardian Angel AI subscription (monthly).',
      amountCents: priceCents,
      currency: 'USD',
      interval: 'month',
      planKey: GUARDIAN_ANGEL_PLAN_ID,
      tenantId: Number(guardianTenantId),
      tenantSlug: guardianTenant?.slug,
      tenantName: 'Angel OS Platform',
      chargeModel: 'platform',
      connectedSquare: null,
      customerEmail: memberEmail || undefined,
      customerName: memberName || undefined,
      returnUrl: `${origin}/?guardian=success&ref=${ref}`,
      cancelUrl: `${origin}/?guardian=cancelled`,
      intentData: {
        planId: GUARDIAN_ANGEL_PLAN_ID,
        planName: GUARDIAN_ANGEL_PLAN_NAME,
        interval: 'month',
        memberUserId: u.id,
        memberEmail: memberEmail || undefined,
        memberName: memberName || undefined,
      },
    })

    return Response.json({
      ok: true,
      url: session.checkoutUrl,
      checkoutUrl: session.checkoutUrl,
      provider: session.provider,
      externalId: session.externalId,
      ref: session.ref,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[guardian-angel-checkout] ${msg}`)
    await logError({
      source: 'guardian-angel-checkout',
      message: `Guardian Angel checkout failed: ${msg}`,
      details: e instanceof Error ? e.stack : String(e),
      statusCode: 500,
      userId: u.id,
    }).catch(() => {})
    return Response.json(
      { error: msg },
      { status: msg.includes('not configured') ? 503 : 500 },
    )
  }
}
