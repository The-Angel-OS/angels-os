/**
 * Set Membership — POST /api/provision-ops/set-membership
 *
 * The factory primitive for granting a user tenant-scoped access: find-or-create
 * the user by email, then find-or-create an ACTIVE tenant-membership at the given
 * role. Idempotent. This is what was missing when provision-portal logged
 * "admin link skipped (no acting user)" — now any portal owner (Ronald on harpazo,
 * the HaulPro owner next) can be linked in one scriptable call, no admin UI.
 *
 * Platform super_admin lives on Users.roles and is intentionally NOT touched here —
 * membership is the TENANT-level grant. An existing user's platform roles are left
 * exactly as they are; only on first create do we seed a base (non-super) role, so
 * a brand-new portal owner is scoped to just their tenant (the isolation default).
 *
 * Auth: super_admin session OR ?key=<CRON_SECRET>.
 * Body: { email, tenantSlug, name?, role? = 'tenant_admin', status? = 'active' }
 */
import type { PayloadHandler } from 'payload'

const VALID_ROLES = ['tenant_admin', 'tenant_manager', 'tenant_member'] as const

export const setMembershipHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(
    user && ((user as { roles?: string[] }).roles || []).includes('super_admin'),
  )
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* empty body → validation below */
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const tenantSlug = typeof body.tenantSlug === 'string' ? body.tenantSlug.trim() : ''
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : email
  const role = (typeof body.role === 'string' ? body.role : 'tenant_admin') as (typeof VALID_ROLES)[number]
  const status = typeof body.status === 'string' ? body.status : 'active'

  if (!email) return Response.json({ error: 'email is required' }, { status: 400 })
  if (!tenantSlug) return Response.json({ error: 'tenantSlug is required' }, { status: 400 })
  if (!VALID_ROLES.includes(role)) {
    return Response.json({ error: `role must be one of ${VALID_ROLES.join(', ')}` }, { status: 400 })
  }

  try {
    // 1. Resolve the tenant.
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const tenant = tenants.docs?.[0] as { id: number | string } | undefined
    if (!tenant) {
      return Response.json({ error: `No tenant with slug "${tenantSlug}"` }, { status: 404 })
    }

    // 2. Find-or-create the user. Existing users keep their platform roles untouched;
    //    new users get a base non-super role so they're scoped to this tenant only.
    const existingUsers = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    let userId: number | string
    let userCreated = false
    const existingUser = existingUsers.docs?.[0] as { id: number | string } | undefined
    if (existingUser) {
      userId = existingUser.id
    } else {
      // Placeholder password — real owners log in via OAuth (email match). Sourced
      // from env so it's not hard-coded; falls back to a non-trivial default.
      const password = process.env.FOUNDER_PASSWORD || `Welcome!${secret?.slice(0, 8) || 'angel123'}`
      const created = await payload.create({
        collection: 'users',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { email, name, password, roles: ['customer'], tenants: [{ tenant: tenant.id as number }] } as any,
        req,
        overrideAccess: true,
        draft: false,
      })
      userId = created.id
      userCreated = true
    }

    // 3. Find-or-create the membership (idempotent on user+tenant).
    const existingMemberships = await payload.find({
      collection: 'tenant-memberships',
      where: { and: [{ user: { equals: userId } }, { tenant: { equals: tenant.id } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const existingMembership = existingMemberships.docs?.[0] as { id: number | string } | undefined

    let membershipId: number | string
    let membershipCreated = false
    if (existingMembership) {
      // Keep it current — role/status may have changed.
      await payload.update({
        collection: 'tenant-memberships',
        id: existingMembership.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { role, status, propagationTrigger: 'manual' } as any,
        req,
        overrideAccess: true,
      })
      membershipId = existingMembership.id
    } else {
      const created = await payload.create({
        collection: 'tenant-memberships',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: { user: userId, tenant: tenant.id, role, status, propagationTrigger: 'manual', joinedAt: new Date().toISOString() } as any,
        req,
        overrideAccess: true,
      })
      membershipId = created.id
      membershipCreated = true
    }

    return Response.json({
      ok: true,
      tenant: { id: tenant.id, slug: tenantSlug },
      user: { id: userId, email, created: userCreated },
      membership: { id: membershipId, role, status, created: membershipCreated },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[set-membership] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
