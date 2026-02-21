/**
 * Invitation Resend Endpoint — POST /api/spaces/invite/resend
 *
 * Finds a pending invitation by membership ID, extends the expiry,
 * and re-sends the invitation email.
 *
 * Requires the requester to be a space_admin or moderator of the space.
 */
import type { PayloadHandler } from 'payload'
import { sendInvitationEmail } from '@/utilities/sendInvitationEmail'
import { DEFAULT_EXPIRY_DAYS, calculateExpiration } from '@/utilities/invitationSystem'

export const inviteResendHandler: PayloadHandler = async (req) => {
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

  const { membershipId } = body

  if (!membershipId) {
    return Response.json({ error: 'membershipId is required.' }, { status: 400 })
  }

  try {
    // Fetch the invitation (space-membership with pending status)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const membership = (await payload.findByID({
      collection: 'space-memberships',
      id: membershipId as string | number,
      depth: 2,
      overrideAccess: true,
    })) as any

    if (!membership) {
      return Response.json({ error: 'Invitation not found.' }, { status: 404 })
    }

    if (membership.status !== 'pending') {
      return Response.json(
        { error: 'Only pending invitations can be resent.' },
        { status: 400 },
      )
    }

    if (!membership.invitationDetails?.invitationToken) {
      return Response.json(
        { error: 'This membership has no invitation token.' },
        { status: 400 },
      )
    }

    // Verify requester has permission (admin or moderator of this space)
    const spaceId =
      typeof membership.space === 'object' ? membership.space?.id : membership.space

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
        { error: 'You must be an admin or moderator of this space to resend invitations.' },
        { status: 403 },
      )
    }

    // Extend expiry
    const newExpiry = calculateExpiration(DEFAULT_EXPIRY_DAYS)

    await payload.update({
      collection: 'space-memberships',
      id: membershipId as string | number,
      data: {
        invitationDetails: {
          ...membership.invitationDetails,
          invitationExpiresAt: newExpiry.toISOString(),
        },
      } as any,
      overrideAccess: true,
    })

    // Resolve names for the email
    const recipientEmail = membership.invitationDetails?.invitationEmail
    if (!recipientEmail) {
      return Response.json(
        { error: 'No email address on this invitation.' },
        { status: 400 },
      )
    }

    const spaceName =
      typeof membership.space === 'object' ? membership.space?.name || 'a space' : 'a space'

    let inviterName = 'Someone'
    try {
      const inviter = await payload.findByID({
        collection: 'users',
        id: user.id,
        depth: 0,
      }) as any
      if (inviter?.name) inviterName = inviter.name
      else if (inviter?.email) inviterName = inviter.email
    } catch {
      // Non-fatal
    }

    let tenantName: string | undefined
    try {
      const space =
        typeof membership.space === 'object'
          ? membership.space
          : await payload.findByID({ collection: 'spaces', id: spaceId, depth: 0 }) as any
      if (space?.tenant) {
        const tId = typeof space.tenant === 'object' ? space.tenant.id : space.tenant
        if (tId) {
          const t = await payload.findByID({ collection: 'tenants', id: tId, depth: 0 }) as any
          if (t?.name) tenantName = t.name
        }
      }
    } catch {
      // Non-fatal
    }

    const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
    const inviteUrl = `${baseUrl}/invite/accept?token=${membership.invitationDetails.invitationToken}`

    const emailSent = await sendInvitationEmail({
      payload,
      recipientEmail,
      inviterName,
      spaceName,
      inviteUrl,
      role: membership.role || 'member',
      tenantName,
    })

    return Response.json({
      success: true,
      emailSent,
      newExpiresAt: newExpiry.toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    payload.logger.error(err, 'Error resending invitation')
    return Response.json({ error: message }, { status: 500 })
  }
}
