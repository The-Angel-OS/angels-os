/**
 * Invitation Acceptance Endpoint — POST /api/invite/accept
 *
 * Accepts a pending invitation by token.
 * User must be logged in. Activates the membership.
 *
 * @see src/utilities/invitationSystem.ts — acceptance logic
 */
import type { PayloadHandler } from 'payload'
import { acceptInvitation } from '@/utilities/invitationSystem'

export const inviteAcceptHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required. Please log in first.' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { token } = body

  if (!token || typeof token !== 'string') {
    return Response.json({ error: 'Invitation token is required.' }, { status: 400 })
  }

  try {
    const result = await acceptInvitation(payload, token, user.id)

    return Response.json({
      success: true,
      // Where to take them. Accepting an invitation and being handed a space id
      // is not arriving anywhere — the client follows this.
      destination: result.destination,
      membership: {
        id: result.membershipId,
        spaceId: result.spaceId,
        spaceName: result.spaceName,
        channelId: result.channelId,
        role: result.role,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return Response.json({ error: message }, { status: 400 })
  }
}
