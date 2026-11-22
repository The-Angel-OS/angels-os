/**
 * Membership self-service — the member-facing side of the dues engine.
 *
 * GET  /api/membership-ops/my     → the logged-in member's membership(s) for the host
 *                                    endeavor (plan, status, renewal). Auth required.
 * POST /api/membership-ops/portal → returns management guidance / URL for the member's
 *                                    active Square or PayPal subscription without requiring
 *                                    any Stripe secret key.
 *
 * @see src/endpoints/membership-checkout.ts  @see src/collections/Memberships
 */
import type { PayloadHandler, Where } from 'payload'

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

function inferProvider(doc: Record<string, unknown>): string | null {
  const metaProvider = (doc.metadata as Record<string, unknown> | undefined)?.provider
  if (typeof metaProvider === 'string' && metaProvider) return metaProvider
  const sub = typeof doc.stripeSubscriptionId === 'string' ? doc.stripeSubscriptionId : ''
  if (sub.startsWith('square:')) return 'square'
  if (sub.startsWith('paypal:')) return 'paypal'
  if (doc.stripeCustomerId) return 'legacy'
  return null
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
    provider: inferProvider(d),
    canManage: Boolean(d.stripeSubscriptionId || d.stripeCustomerId),
  }))
  return Response.json({ memberships })
}

export const membershipPortalHandler: PayloadHandler = async (req) => {
  const { error, docs } = await findMyMemberships(req)
  if (error === 'auth required') return Response.json({ error }, { status: 401 })
  if (error) return Response.json({ error }, { status: 400 })

  const activeDoc =
    docs.find(
      (d) =>
        (d.stripeSubscriptionId || d.stripeCustomerId) &&
        (d.status === 'active' || d.status === 'trialing' || d.status === 'past_due'),
    ) || docs.find((d) => d.stripeSubscriptionId || d.stripeCustomerId)

  if (!activeDoc) {
    return Response.json(
      { error: "We couldn't find an active paid membership to manage yet." },
      { status: 404 },
    )
  }

  const provider = inferProvider(activeDoc) || 'square'
  if (provider === 'paypal') {
    return Response.json({
      ok: true,
      provider: 'paypal',
      url: 'https://www.paypal.com/myaccount/autopay/',
      message: 'Manage or cancel your PayPal subscription anytime in PayPal Automatic Payments.',
    })
  }

  if (provider === 'square') {
    return Response.json({
      ok: true,
      provider: 'square',
      message:
        'Your membership is billed through Square. Use the receipt email from Square or contact the organization to update your card or cancel.',
    })
  }

  return Response.json({
    ok: true,
    provider,
    message:
      'Stripe billing has been retired on this platform. Please contact the organization to migrate or cancel a legacy subscription.',
  })
}
