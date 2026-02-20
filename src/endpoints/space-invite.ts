/**
 * Space Invitation Endpoint — POST /api/spaces/:id/invite
 *
 * Creates a pending invitation with a unique token.
 * Requires requester to be space_admin or moderator.
 *
 * @see src/utilities/invitationSystem.ts — invitation logic
 */
import type { PayloadHandler } from 'payload'
import { createInvitation, isValidEmail } from '@/utilities/invitationSystem'

export const spaceInviteHandler: PayloadHandler = async (req) => {
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

  const { email, spaceId, role, message } = body

  if (!email || !isValidEmail(String(email))) {
    return Response.json({ error: 'A valid email address is required.' }, { status: 400 })
  }

  if (!spaceId) {
    return Response.json({ error: 'spaceId is required.' }, { status: 400 })
  }

  // Verify requester has permission (admin or moderator of this space)
  const membership = await payload.find({
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

  if (membership.docs.length === 0) {
    return Response.json(
      { error: 'You must be an admin or moderator of this space to invite members.' },
      { status: 403 },
    )
  }

  try {
    const result = await createInvitation({
      payload,
      email: String(email),
      spaceId: Number(spaceId) || spaceId,
      invitedByUserId: user.id,
      role: (role as 'member' | 'moderator' | 'guest') || 'member',
      message: message ? String(message) : undefined,
    })

    return Response.json({
      success: true,
      invitation: {
        token: result.token,
        expiresAt: result.expiresAt,
        inviteUrl: result.inviteUrl,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 400 })
  }
}
