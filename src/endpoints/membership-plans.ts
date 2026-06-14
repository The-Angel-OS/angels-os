/**
 * Membership Plans — /api/membership-ops/plans
 *
 * GET  → list the host tenant's membership plans (for the join surface). Public.
 * POST → upsert a plan. super_admin OR ?key=<CRON_SECRET> OR an active member of the
 *        target tenant. Body: { tenantSlug?, plan: { id, name, amountCents, interval,
 *        description?, active? } }  (tenant resolved from host when slug omitted).
 *
 * Plans live in the settings bag (membershipPlans util) — no schema. The Memberships
 * collection records actual subscriptions.
 */
import type { PayloadHandler } from 'payload'
import { getMembershipPlans, upsertMembershipPlan, removeMembershipPlan, type MembershipPlan } from '@/utilities/membershipPlans'

async function resolveTenant(req: Parameters<PayloadHandler>[0], bodySlug?: string) {
  const headerTenant = req.headers?.get('x-tenant-id') || ''
  const slug = headerTenant || (bodySlug && bodySlug !== 'default' ? bodySlug : '')
  if (!slug) return null
  const tenants = await req.payload.find({ collection: 'tenants', where: { slug: { equals: slug } }, limit: 1, depth: 0, overrideAccess: true })
  const t = tenants.docs?.[0] as { id: number | string; slug?: string } | undefined
  return t ? { id: t.id, slug } : null
}

export const membershipPlansHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const method = (req as Request).method?.toUpperCase()
  const url = new URL(req.url || '', 'http://localhost')

  if (method === 'GET') {
    const tenant = await resolveTenant(req, url.searchParams.get('tenant') || undefined)
    if (!tenant) return Response.json({ plans: [] })
    const plans = (await getMembershipPlans(payload, tenant.id)).filter((p) => p.active !== false)
    return Response.json({ plans })
  }

  if (method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 })

  let body: Record<string, unknown> = {}
  try { body = (await (req as unknown as Request).json()) as Record<string, unknown> } catch { /* below */ }

  const tenant = await resolveTenant(req, typeof body.tenantSlug === 'string' ? body.tenantSlug : undefined)
  if (!tenant) return Response.json({ error: 'tenant could not be resolved' }, { status: 400 })

  // Auth: super_admin, ?key, or an active member of THIS tenant.
  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const isSuperAdmin = Boolean(user && ((user as { roles?: string[] }).roles || []).includes('super_admin'))
  const keyOk = Boolean(secret && key === secret)
  let isTenantMember = false
  if (!isSuperAdmin && !keyOk && user) {
    const m = await payload.find({
      collection: 'tenant-memberships',
      where: { and: [{ user: { equals: (user as { id?: number | string }).id } }, { tenant: { equals: tenant.id } }, { status: { equals: 'active' } }] },
      limit: 1, depth: 0, overrideAccess: true,
    })
    isTenantMember = (m.docs?.length ?? 0) > 0
  }
  if (!isSuperAdmin && !keyOk && !isTenantMember) {
    return Response.json({ error: 'super_admin, valid key, or active tenant membership required' }, { status: 403 })
  }

  // Delete?
  if (body.delete && typeof body.delete === 'string') {
    const plans = await removeMembershipPlan(payload, tenant.id, body.delete)
    return Response.json({ ok: true, plans })
  }

  const p = body.plan as Partial<MembershipPlan> | undefined
  if (!p?.id || !p.name || typeof p.amountCents !== 'number' || (p.interval !== 'month' && p.interval !== 'year')) {
    return Response.json({ error: 'plan requires { id, name, amountCents:number, interval:"month"|"year" }' }, { status: 400 })
  }
  const plans = await upsertMembershipPlan(payload, tenant.id, {
    id: String(p.id).toLowerCase().replace(/\s+/g, '-'),
    name: p.name,
    amountCents: Math.round(p.amountCents),
    interval: p.interval,
    description: typeof p.description === 'string' ? p.description : undefined,
    active: p.active !== false,
  })
  return Response.json({ ok: true, plans })
}
