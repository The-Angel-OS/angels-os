/**
 * Membership Checkout — POST /api/membership-ops/checkout
 *
 * Starts a recurring membership/dues subscription via Square or PayPal hosted
 * checkout (with instant $0 free-tier activation preserved).
 */
import type { PayloadHandler } from 'payload'
import { generateCheckoutRef } from '@/lib/payments/config'
import { startHostedCheckout } from '@/lib/payments/registry'
import { getBillingMode } from '@/utilities/billingMode'
import { getServerSideURL } from '@/utilities/getURL'
import { logError } from '@/utilities/logError'
import { getMembershipPlan } from '@/utilities/membershipPlans'
import { originFromHeaderValues } from '@/utilities/originFromHeaders'
import { feeCents, getPlatformFeeBps } from '@/utilities/platformFee'

export function buildSubscriptionMetadata(input: {
  tenantId: number | string
  tenantSlug: string
  planId: string
  planName: string
  memberName?: string
  memberEmail?: string
  memberUserId?: number | string | null
}): Record<string, string> {
  return {
    angelOs_type: 'membership',
    tenantId: String(input.tenantId),
    tenantSlug: input.tenantSlug,
    planId: input.planId,
    planName: input.planName,
    ...(input.memberName ? { memberName: input.memberName } : {}),
    ...(input.memberEmail ? { memberEmail: input.memberEmail } : {}),
    ...(input.memberUserId != null ? { memberUserId: String(input.memberUserId) } : {}),
  }
}

export const membershipCheckoutHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* validated below */
  }

  const planId = typeof body.planId === 'string' ? body.planId.trim() : ''
  if (!planId) return Response.json({ error: 'planId is required' }, { status: 400 })

  const headerTenant = req.headers?.get('x-tenant-id') || ''
  const bodySlug =
    typeof body.tenantSlug === 'string' && body.tenantSlug && body.tenantSlug !== 'default'
      ? body.tenantSlug
      : ''
  const slug = headerTenant || bodySlug
  if (!slug) {
    return Response.json(
      { error: 'Could not resolve the endeavor for this membership.' },
      { status: 400 },
    )
  }

  let resolvedTenantId: number | undefined
  try {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenant = tenants.docs?.[0] as any
    if (tenant?.id != null) resolvedTenantId = Number(tenant.id)
    if (!tenant) return Response.json({ error: `No endeavor "${slug}"` }, { status: 404 })

    const billingMode = await getBillingMode(payload, tenant.id)
    const plan = await getMembershipPlan(payload, tenant.id, planId)
    if (!plan) return Response.json({ error: `No membership plan "${planId}"` }, { status: 404 })
    if (plan.active === false) {
      return Response.json({ error: 'That plan is not currently available.' }, { status: 409 })
    }

    const memberEmail =
      typeof body.memberEmail === 'string'
        ? body.memberEmail.trim()
        : ((user as { email?: string } | null)?.email || '')
    const memberName =
      typeof body.memberName === 'string'
        ? body.memberName.trim()
        : ((user as { name?: string } | null)?.name || '')

    const host = req.headers?.get?.('x-forwarded-host') || req.headers?.get?.('host')
    const proto = req.headers?.get?.('x-forwarded-proto')
    const origin = host ? originFromHeaderValues(host, proto) : getServerSideURL()

    // FREE PLAN — instant activation without payment provider round-trip
    if (plan.amountCents === 0) {
      const memberId = (user as { id?: number | string } | null)?.id
      if (memberId == null) {
        return Response.json(
          { error: 'Please sign in to join — a free membership is tied to your account.' },
          { status: 401 },
        )
      }
      const existing = await payload.find({
        collection: 'memberships',
        where: { and: [{ tenant: { equals: tenant.id } }, { member: { equals: memberId } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const data = {
        tenant: Number(tenant.id),
        member: Number(memberId),
        memberEmail: memberEmail || undefined,
        memberName: memberName || undefined,
        planId: plan.id,
        planName: plan.name,
        amountCents: 0,
        interval: plan.interval,
        status: 'active' as const,
        startedAt: new Date().toISOString(),
      }
      if (existing.docs?.[0]) {
        await payload.update({
          collection: 'memberships',
          id: existing.docs[0].id,
          data,
          overrideAccess: true,
          req,
        })
      } else {
        await payload.create({ collection: 'memberships', data, overrideAccess: true, req })
      }
      return Response.json({ url: `${origin}/?membership=success`, free: true })
    }

    const tenantName = tenant.branding?.siteName || tenant.name || slug
    const feeBps = await getPlatformFeeBps(payload, tenant.id)
    const applicationFeeCents =
      billingMode === 'connect' ? feeCents(plan.amountCents, feeBps) : 0

    const ref = generateCheckoutRef()
    const requestedProvider =
      typeof body.provider === 'string' ? (body.provider as 'square' | 'paypal') : undefined

    const session = await startHostedCheckout(payload, {
      ref,
      provider: requestedProvider,
      kind: 'membership',
      title: `${plan.name} — ${tenantName}`,
      description: plan.description || `${plan.name} (${plan.interval}ly membership)`,
      amountCents: plan.amountCents,
      currency: 'USD',
      interval: plan.interval,
      planKey: `m_${tenant.id}_${plan.id}`,
      tenantId: Number(tenant.id),
      tenantSlug: slug,
      tenantName,
      chargeModel: billingMode === 'connect' ? 'direct' : 'platform',
      applicationFeeCents,
      customerEmail: memberEmail || undefined,
      customerName: memberName || undefined,
      returnUrl: `${origin}/?membership=success&ref=${ref}`,
      cancelUrl: `${origin}/?membership=cancelled`,
      intentData: {
        planId: plan.id,
        planName: plan.name,
        interval: plan.interval,
        memberName: memberName || undefined,
        memberEmail: memberEmail || undefined,
        memberUserId: (user as { id?: number | string } | null)?.id,
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
    payload.logger?.error?.(`[membership-checkout] ${msg}`)
    await logError({
      source: 'membership-checkout',
      message: `Membership checkout failed: ${msg}`,
      details: e instanceof Error ? e.stack : String(e),
      statusCode: 500,
      tenantId: resolvedTenantId,
    })
    return Response.json(
      { error: msg },
      { status: msg.includes('not configured') ? 503 : 500 },
    )
  }
}
