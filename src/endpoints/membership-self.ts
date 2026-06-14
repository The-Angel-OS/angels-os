/**
 * Membership self-service — the member-facing side of the dues engine.
 *
 * GET  /api/membership-ops/my     → the logged-in member's membership(s) for the host
 *                                    endeavor (plan, status, renewal). Auth required.
 * POST /api/membership-ops/portal → a Stripe Billing Portal session so the member can
 *                                    update their card, view invoices, or cancel. Auth
 *                                    required. Destination-charge subscriptions live on
 *                                    the PLATFORM account, so the platform portal manages
 *                                    them.
 *
 * @see src/endpoints/membership-checkout.ts  @see src/collections/Memberships
 */
import type { PayloadHandler, Where } from 'payload'
import Stripe from 'stripe'
import { getServerSideURL } from '@/utilities/getURL'

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured')
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion })
  }
  return _stripe
}

async function resolveTenantId(req: Parameters<PayloadHandler>[0]): Promise<number | string | null> {
  const slug = req.headers?.get('x-tenant-id') || ''
  if (!slug) return null
  const tenants = await req.payload.find({ collection: 'tenants', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })
  const t = tenants.docs?.[0] as { id: number | string } | undefined
  return t?.id ?? null
}

/** Find the host-tenant memberships belonging to the signed-in user (by id or email). */
async function findMyMemberships(req: Parameters<PayloadHandler>[0]) {
  const user = req.user as { id?: number | string; email?: string } | null
  if (!user?.id) return { error: 'auth required' as const, docs: [] }
  const tenantId = await resolveTenantId(req)
  if (!tenantId) return { error: 'tenant could not be resolved' as const, docs: [] }

  const or: Where[] = [{ member: { equals: user.id } }]
  if (user.email) or.push({ memberEmail: { equals: user.email } })

  const res = await req.payload.find({
    collection: 'memberships',
    where: { and: [{ tenant: { equals: tenantId } }, { or }] },
    limit: 20,
    depth: 0,
    sort: '-startedAt',
    overrideAccess: true,
  })
  return { error: null, docs: res.docs as unknown as Record<string, unknown>[] }
}

export const myMembershipsHandler: PayloadHandler = async (req) => {
  const { error, docs } = await findMyMemberships(req)
  if (error === 'auth required') return Response.json({ error }, { status: 401 })
  if (error) return Response.json({ error, memberships: [] }, { status: 400 })

  const memberships = docs.map((d) => ({
    id: d.id,
    planName: d.planName ?? null,
    planId: d.planId ?? null,
    amountCents: d.amountCents ?? null,
    interval: d.interval ?? null,
    status: d.status ?? null,
    currentPeriodEnd: d.currentPeriodEnd ?? null,
    startedAt: d.startedAt ?? null,
    canManage: Boolean(d.stripeCustomerId),
  }))
  return Response.json({ memberships })
}

export const membershipPortalHandler: PayloadHandler = async (req) => {
  const { error, docs } = await findMyMemberships(req)
  if (error === 'auth required') return Response.json({ error }, { status: 401 })
  if (error) return Response.json({ error }, { status: 400 })

  // Prefer an active membership with a Stripe customer; fall back to any with one.
  const withCustomer = docs.find((d) => d.stripeCustomerId && (d.status === 'active' || d.status === 'trialing' || d.status === 'past_due'))
    || docs.find((d) => d.stripeCustomerId)
  const customerId = withCustomer?.stripeCustomerId as string | undefined
  if (!customerId) {
    return Response.json({ error: "We couldn't find a billing account for your membership yet." }, { status: 404 })
  }

  try {
    const baseUrl = getServerSideURL()
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/?membership=managed`,
    })
    return Response.json({ url: session.url })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    req.payload.logger?.error?.(`[membership-portal] ${msg}`)
    if (msg.includes('configuration') || msg.includes('No configuration')) {
      return Response.json({ error: 'Billing portal is not configured yet. Please contact the organization.' }, { status: 503 })
    }
    return Response.json({ error: 'Could not open the billing portal. Please try again.' }, { status: 500 })
  }
}
