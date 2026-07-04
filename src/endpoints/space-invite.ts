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
import { sendInvitationEmail } from '@/utilities/sendInvitationEmail'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
import { logError } from '@/utilities/logError'

export const spaceInviteHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json({ error: 'Authentication required' }, { status: 401 })
  }

  const rateLimited = applyRateLimit(req, 'invitations')
  if (rateLimited) return rateLimited

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

  let resolvedTenantId: number | string | undefined
  try {
    const result = await createInvitation({
      payload,
      email: String(email),
      spaceId: Number(spaceId) || String(spaceId),
      invitedByUserId: user.id,
      role: (role as 'member' | 'moderator' | 'guest') || 'member',
      message: message ? String(message) : undefined,
    })

    // Send invitation email
    // Resolve space name and inviter name for the email
    let spaceName = 'a space'
    let inviterName = 'Someone'
    let tenantName: string | undefined
    let spaceTenantId: number | string | undefined

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const space = await payload.findByID({ collection: 'spaces', id: spaceId as any, depth: 0 }) as any
      if (space?.name) spaceName = space.name

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inviter = await payload.findByID({ collection: 'users', id: user.id, depth: 0 }) as any
      if (inviter?.name) inviterName = inviter.name
      else if (inviter?.email) inviterName = inviter.email

      // Try to get tenant name for branding
      if (space?.tenant) {
        spaceTenantId = typeof space.tenant === 'object' ? space.tenant.id : space.tenant
        resolvedTenantId = spaceTenantId
        if (spaceTenantId) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const t = await payload.findByID({ collection: 'tenants', id: spaceTenantId, depth: 0 }) as any
          if (t?.name) tenantName = t.name
        }
      }
    } catch {
      // Non-fatal — use defaults
    }

    const emailSent = await sendInvitationEmail({
      payload,
      tenantId: spaceTenantId,
      recipientEmail: String(email),
      inviterName,
      spaceName,
      inviteUrl: result.inviteUrl,
      role: (role as string) || 'member',
      message: message ? String(message) : undefined,
      tenantName,
    })

    return Response.json({
      success: true,
      emailSent,
      invitation: {
        token: result.token,
        expiresAt: result.expiresAt,
        inviteUrl: result.inviteUrl,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    await logError({
      source: 'space-invite',
      message: `Failed to create space invitation: ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
      statusCode: 400,
      tenantId: resolvedTenantId,
      userId: user.id,
    })
    return Response.json({ error: message }, { status: 400 })
  }
}
