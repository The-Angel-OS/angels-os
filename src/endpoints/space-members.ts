/**
 * Space Members Endpoints
 *   DELETE /api/space-ops/members/remove   — remove (status 'left')
 *   GET    /api/space-ops/members/candidates?spaceId=&q=  — portal members not in the space
 *   POST   /api/space-ops/members/add      — add an existing portal member to the space
 *
 * Requester must be space_admin/moderator of the space (or a platform admin).
 */
import type { Payload, PayloadHandler } from 'payload'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

// ── Shared helpers ───────────────────────────────────────────────
async function spaceTenantId(payload: Payload, spaceId: number | string): Promise<number | string | null> {
  try {
    const space = await payload.findByID({ collection: 'spaces', id: spaceId as number, depth: 0, overrideAccess: true })
    const t = (space as { tenant?: unknown })?.tenant
    return t && typeof t === 'object' ? (t as { id: number | string }).id : (t as number | string) ?? null
  } catch {
    return null
  }
}

/** True if the user may manage members of this space (space admin/mod or platform admin). */
async function canManageSpaceMembers(payload: Payload, user: { id: number | string; roles?: unknown }, spaceId: number | string): Promise<boolean> {
  if (checkRole(ADMIN_ROLES, user)) return true
  const m = await payload.find({
    collection: 'space-memberships',
    where: {
      and: [
        { user: { equals: user.id } },
        { space: { equals: spaceId } },
        { status: { equals: 'active' } },
        { role: { in: ['space_admin', 'moderator'] } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (m.docs?.length || 0) > 0
}

export const spaceMembersRemoveHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { membershipId, spaceId } = body

  if (!membershipId || !spaceId) {
    return Response.json({ error: 'membershipId and spaceId are required.' }, { status: 400 })
  }

  // Verify requester has permission
  const requesterMembership = await payload.find({
    collection: 'space-memberships',
    where: {
      and: [
        { user: { equals: user.id } },
        { space: { equals: spaceId } },
        { status: { equals: 'active' } },
        { role: { in: ['space_admin', 'moderator'] } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (requesterMembership.docs.length === 0) {
    return Response.json(
      { error: 'Only admins and moderators can remove members.' },
      { status: 403 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const requesterRole = (requesterMembership.docs[0] as any).role

  // Get target membership
  const targetMembership = await payload.findByID({
    collection: 'space-memberships',
    id: Number(membershipId),
    depth: 0,
    overrideAccess: true,
  })

  if (!targetMembership) {
    return Response.json({ error: 'Membership not found.' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targetRole = (targetMembership as any).role
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targetUserId = typeof (targetMembership as any).user === 'object'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? (targetMembership as any).user.id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    : (targetMembership as any).user

  // Can't remove yourself
  if (targetUserId === user.id) {
    return Response.json({ error: 'You cannot remove yourself.' }, { status: 400 })
  }

  // Moderators can't remove admins
  if (requesterRole === 'moderator' && targetRole === 'space_admin') {
    return Response.json({ error: 'Moderators cannot remove admins.' }, { status: 403 })
  }

  // Can't remove last admin
  if (targetRole === 'space_admin') {
    const adminCount = await payload.count({
      collection: 'space-memberships',
      where: {
        and: [
          { space: { equals: spaceId } },
          { role: { equals: 'space_admin' } },
          { status: { equals: 'active' } },
        ],
      },
      overrideAccess: true,
    })

    if (adminCount.totalDocs <= 1) {
      return Response.json(
        { error: 'Cannot remove the last admin.' },
        { status: 400 },
      )
    }
  }

  // Remove (set status to 'left')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (payload.update as any)({
    collection: 'space-memberships',
    id: Number(membershipId),
    data: { status: 'left' },
    overrideAccess: true,
  })

  return Response.json({ success: true, message: 'Member removed.' })
}

// ── Candidates: portal members not already in the space ──────────
export const spaceMemberCandidatesHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const url = new URL(req.url || '', 'http://localhost')
  const spaceId = url.searchParams.get('spaceId')
  const q = (url.searchParams.get('q') || '').trim().toLowerCase()
  if (!spaceId) return Response.json({ error: 'spaceId is required' }, { status: 400 })

  if (!(await canManageSpaceMembers(payload, user as { id: number }, spaceId))) {
    return Response.json({ error: 'Only admins and moderators can browse members.' }, { status: 403 })
  }

  const tenantId = await spaceTenantId(payload, spaceId)
  if (tenantId == null) return Response.json({ error: 'Space not found' }, { status: 404 })

  // Users already active in the space → exclude.
  const existing = await payload.find({
    collection: 'space-memberships',
    where: { and: [{ space: { equals: spaceId } }, { status: { equals: 'active' } }] },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  const inSpace = new Set(
    (existing.docs as Array<{ user?: unknown }>).map((d) =>
      String(typeof d.user === 'object' && d.user ? (d.user as { id: number | string }).id : d.user),
    ),
  )

  // Portal members = active tenant-memberships for this tenant, hydrated to user.
  const memberships = await payload.find({
    collection: 'tenant-memberships',
    where: { and: [{ tenant: { equals: tenantId } }, { status: { equals: 'active' } }] },
    limit: 500,
    depth: 1,
    overrideAccess: true,
  })

  const seen = new Set<string>()
  const candidates: Array<{ userId: string; name: string; email: string }> = []
  for (const m of memberships.docs as Array<{ user?: unknown }>) {
    const u = typeof m.user === 'object' && m.user ? (m.user as Record<string, unknown>) : null
    const uid = u ? String(u.id) : null
    if (!uid || inSpace.has(uid) || seen.has(uid)) continue
    const name = String(u?.name || u?.email || '')
    const email = String(u?.email || '')
    if (q && !name.toLowerCase().includes(q) && !email.toLowerCase().includes(q)) continue
    seen.add(uid)
    candidates.push({ userId: uid, name: name || email || 'Member', email })
    if (candidates.length >= 25) break
  }

  return Response.json({ candidates })
}

// ── Add an existing portal member to the space ───────────────────
export const spaceMemberAddHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const spaceId = body.spaceId as number | string
  const userId = body.userId as number | string
  const role = (['member', 'moderator', 'guest', 'space_admin'].includes(String(body.role)) ? body.role : 'member') as string
  if (!spaceId || !userId) return Response.json({ error: 'spaceId and userId are required' }, { status: 400 })

  if (!(await canManageSpaceMembers(payload, user as { id: number }, spaceId))) {
    return Response.json({ error: 'Only admins and moderators can add members.' }, { status: 403 })
  }

  const tenantId = await spaceTenantId(payload, spaceId)
  if (tenantId == null) return Response.json({ error: 'Space not found' }, { status: 404 })

  // Idempotent: reactivate an existing membership, else create.
  const existing = await payload.find({
    collection: 'space-memberships',
    where: { and: [{ space: { equals: spaceId } }, { user: { equals: userId } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs?.[0]) {
    const doc = existing.docs[0] as { id: number | string; status?: string }
    if (doc.status === 'active') {
      return Response.json({ success: true, membershipId: doc.id, message: 'Already a member.' })
    }
    await payload.update({
      collection: 'space-memberships',
      id: doc.id,
      data: { status: 'active', role } as never,
      overrideAccess: true,
    })
    return Response.json({ success: true, membershipId: doc.id, message: 'Member re-added.' })
  }

  const created = await payload.create({
    collection: 'space-memberships',
    data: {
      user: userId as number,
      space: spaceId as number,
      role,
      status: 'active',
      joinedAt: new Date().toISOString(),
      tenant: tenantId as number,
    } as never,
    overrideAccess: true,
  })

  return Response.json({ success: true, membershipId: created.id, message: 'Member added.' })
}
