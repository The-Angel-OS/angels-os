/**
 * Portal Plan Checkout — POST /api/plan-ops/checkout
 *
 * Upgrades a tenant's portalPlan (`creator`, `site`, or `business`) via Square
 * or PayPal hosted subscription checkout.
 */
import type { PayloadHandler } from 'payload'
import { ADMIN_ROLES, checkRole } from '@/access/utilities'
import { generateCheckoutRef } from '@/lib/payments/config'
import { startHostedCheckout } from '@/lib/payments/registry'
import { getServerSideURL } from '@/utilities/getURL'
import { logError } from '@/utilities/logError'
import { originFromHeaderValues } from '@/utilities/originFromHeaders'
import { PLAN_LABEL, PLAN_PRICE_CENTS, planOf, type PortalPlan } from '@/utilities/portalPlan'

const MANAGER_ROLES = new Set(['tenant_admin', 'tenant_manager'])

export const PURCHASABLE_PLANS = ['creator', 'site', 'business'] as const
export type PurchasablePlan = (typeof PURCHASABLE_PLANS)[number]

export function isPurchasablePlan(v: unknown): v is PurchasablePlan {
  return typeof v === 'string' && (PURCHASABLE_PLANS as readonly string[]).includes(v)
}

export const portalPlanCheckoutHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const { resolveTenantFromHeaders } = await import('@/utilities/resolveTenantFromHeaders')
  const { tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) return Response.json({ error: 'No portal context' }, { status: 400 })

  if (!checkRole(ADMIN_ROLES, user)) {
    const { getUserTenantRoles } = await import('@/access/getUserTenantRoles')
    const roles = await getUserTenantRoles(user.id)
    const ok = roles.some((m) => {
      const t = m.tenant as unknown
      const id = t && typeof t === 'object' ? (t as { id: number | string }).id : t
      return (
        String(id) === String(tenantId) &&
        MANAGER_ROLES.has(String(m.role)) &&
        (m as { status?: string }).status === 'active'
      )
    })
    if (!ok) return Response.json({ error: 'Not permitted for this portal' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* empty body validated below */
  }

  const plan = body.plan
  if (!isPurchasablePlan(plan)) {
    return Response.json(
      { error: `Choose a plan: ${PURCHASABLE_PLANS.join(', ')}.` },
      { status: 400 },
    )
  }

  try {
    const tenant = (await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
      req,
    })) as unknown as {
      id: number | string
      name?: string
      slug?: string
      portalPlan?: string | null
    }

    const currentPlan = planOf(tenant)
    if (currentPlan === 'demo') {
      return Response.json(
        {
          error:
            'This is a demonstration portal — there is nothing to buy. Talk to us when you are ready to make it yours.',
        },
        { status: 409 },
      )
    }
    if (currentPlan === plan) {
      return Response.json(
        { error: `This portal is already on ${PLAN_LABEL[plan]}.` },
        { status: 409 },
      )
    }

    const u = user as { id: number | string; email?: string; name?: string }
    const email = (u.email || '').trim()
    const host = req.headers?.get?.('x-forwarded-host') || req.headers?.get?.('host')
    const proto = req.headers?.get?.('x-forwarded-proto')
    const origin = host ? originFromHeaderValues(host, proto) : getServerSideURL()
    const portalName = tenant.name || tenant.slug || 'your portal'
    const ref = generateCheckoutRef()
    const requestedProvider =
      typeof body.provider === 'string' ? (body.provider as 'square' | 'paypal') : undefined

    const session = await startHostedCheckout(payload, {
      ref,
      provider: requestedProvider,
      kind: 'portal_plan',
      title: `${PLAN_LABEL[plan]} — ${portalName}`,
      description: 'Angel OS portal plan. Per site, per month. Cancel any month.',
      amountCents: PLAN_PRICE_CENTS[plan as PortalPlan],
      currency: 'USD',
      interval: 'month',
      planKey: `portal_${plan}`,
      tenantId: Number(tenant.id),
      tenantSlug: tenant.slug,
      tenantName: 'Angel OS Platform',
      chargeModel: 'platform',
      connectedSquare: null,
      customerEmail: email || undefined,
      customerName: u.name || undefined,
      returnUrl: `${origin}/dashboard/admin/settings?tab=plan&upgraded=1&ref=${ref}`,
      cancelUrl: `${origin}/dashboard/admin/settings?tab=plan&cancelled=1`,
      intentData: {
        portalPlan: plan,
        planId: `portal_${plan}`,
        planName: PLAN_LABEL[plan],
        memberUserId: u.id,
        memberEmail: email || undefined,
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
    payload.logger?.error?.(`[portal-plan-checkout] ${msg}`)
    await logError({
      source: 'portal-plan-checkout',
      message: `Portal plan checkout failed: ${msg}`,
      details: e instanceof Error ? e.stack : String(e),
      statusCode: 500,
      tenantId: Number(tenantId),
    }).catch(() => {})
    return Response.json(
      { error: msg },
      { status: msg.includes('not configured') ? 503 : 500 },
    )
  }
}
