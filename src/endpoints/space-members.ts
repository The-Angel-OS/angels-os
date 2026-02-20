/**
 * Space Members Endpoint — DELETE /api/spaces/members/remove
 *
 * Removes a member from a space (sets status to 'left').
 * Requires requester to be space_admin or moderator.
 */
import type { PayloadHandler } from 'payload'

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
