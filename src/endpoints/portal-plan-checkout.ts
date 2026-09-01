/**
 * Portal Plan Checkout — POST /api/plan-ops/checkout
 *
 * The missing half of the paywall. Every plan gate on this platform — custom
 * domain, CRM, the customer assistant, memberships, the 5%→2%→0% platform fee —
 * reads `tenants.portalPlan`, and until now NOTHING wrote that field from a
 * payment. It was set by `provisionPortal` at creation and by `runDemoSite`, and
 * moved thereafter only by an admin editing a dropdown. The upgrade button on
 * /dashboard/plan linked to `spacesangels.com/plans?portal=…&plan=…`, and no
 * route anywhere read those parameters. So the whole plan map was a description
 * of a gate nobody could walk through.
 *
 * This is the walk-through. The PLATFORM is the merchant — spacesangels.com
 * charges for its own product, so there is no Connect account and no destination
 * transfer here, unlike endeavor dues. Modelled directly on
 * guardian-angel-checkout, which is the same shape of transaction.
 *
 * The subscription carries `angelOs_type: 'portal_plan'` and the tenant id, and
 * the platform webhook writes the field when Stripe says the money is real —
 * never here. A checkout session that is created is not a payment; treating it
 * as one is how you hand out a paid plan to anyone who can open a tab and close
 * it. @see applyPortalPlanFromSubscription in stripe-webhooks.ts
 *
 * Inert without STRIPE_SECRET_KEY: a friendly 503, so the funnel exists on a
 * node that has no keys yet.
 *
 * Auth is the domain-ops pattern verbatim: the tenant comes from the request
 * host, never from a parameter, and the caller must manage THAT portal.
 */
import type { PayloadHandler } from 'payload'
import Stripe from 'stripe'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { getUserTenantRoles } from '@/access/getUserTenantRoles'
import { getServerSideURL } from '@/utilities/getURL'
import { logError } from '@/utilities/logError'
import { PLAN_PRICE_CENTS, PLAN_LABEL, planOf, type PortalPlan } from '@/utilities/portalPlan'

const MANAGER_ROLES = new Set(['tenant_admin', 'tenant_manager'])

/**
 * Plans a customer may BUY. `free` is not bought and `demo` is ours to grant —
 * a checkout that could set either would be a way to talk yourself onto a plan
 * rather than pay for one.
 */
export const PURCHASABLE_PLANS = ['site', 'business'] as const
export type PurchasablePlan = (typeof PURCHASABLE_PLANS)[number]

export function isPurchasablePlan(v: unknown): v is PurchasablePlan {
  return typeof v === 'string' && (PURCHASABLE_PLANS as readonly string[]).includes(v)
}

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured')
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
    })
  }
  return _stripe
}

export const portalPlanCheckoutHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const { tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) return Response.json({ error: 'No portal context' }, { status: 400 })

  if (!checkRole(ADMIN_ROLES, user)) {
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
    /* an empty body is a missing plan, handled below */
  }

  const plan = body.plan
  if (!isPurchasablePlan(plan)) {
    return Response.json(
      { error: `Choose a plan: ${PURCHASABLE_PLANS.join(' or ')}.` },
      { status: 400 },
    )
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return Response.json(
      { error: 'Plan changes are not available on this node yet. Ask us and we will move it for you.' },
      { status: 503 },
    )
  }

  try {
    const tenant = (await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      depth: 0,
      overrideAccess: true,
      req,
    })) as unknown as { id: number | string; name?: string; slug?: string; portalPlan?: string | null }

    const currentPlan = planOf(tenant)
    // A demo portal has everything already. Selling it a plan would take
    // features away and charge for the privilege.
    if (currentPlan === 'demo') {
      return Response.json(
        { error: 'This is a demonstration portal — there is nothing to buy. Talk to us when you are ready to make it yours.' },
        { status: 409 },
      )
    }
    if (currentPlan === plan) {
      return Response.json({ error: `This portal is already on ${PLAN_LABEL[plan]}.` }, { status: 409 })
    }

    const u = user as { id: number | string; email?: string; name?: string }
    const email = (u.email || '').trim()
    const baseUrl = getServerSideURL()
    const portalName = tenant.name || tenant.slug || 'your portal'

    // `tenantId` is what the webhook keys on. `portalPlan` is what it writes.
    const meta: Record<string, string> = {
      angelOs_type: 'portal_plan',
      tenantId: String(tenant.id),
      portalPlan: plan,
      planId: `portal_${plan}`,
      planName: PLAN_LABEL[plan],
      memberUserId: String(u.id),
      ...(email ? { memberEmail: email } : {}),
    }

    const session = await getStripe().checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${PLAN_LABEL[plan]} — ${portalName}`,
              description: 'Angel OS portal plan. Per site, per month. Cancel any month.',
            },
            unit_amount: PLAN_PRICE_CENTS[plan as PortalPlan],
            recurring: { interval: 'month' },
          },
        },
      ],
      subscription_data: { metadata: meta },
      ...(email ? { customer_email: email } : {}),
      success_url: `${baseUrl}/dashboard/plan?upgraded=1`,
      cancel_url: `${baseUrl}/dashboard/plan?cancelled=1`,
      metadata: meta,
    })

    return Response.json({ url: session.url, sessionId: session.id })
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
    return Response.json({ error: 'Could not start the plan change. Please try again.' }, { status: 500 })
  }
}
