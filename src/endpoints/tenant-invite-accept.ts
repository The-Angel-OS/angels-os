/**
 * Tenant Invite Accept Endpoint
 *
 * POST /api/tenant-invite/accept
 * Body: { token: string }
 *
 * Validates the invitation token from TenantMemberships,
 * activates the membership, and updates the corresponding Contact record.
 */
import type { PayloadHandler } from 'payload'

export const tenantInviteAcceptHandler: PayloadHandler = async (req) => {
  const { payload, user } = req

  if (!user) {
    return Response.json(
      { error: 'You must be logged in to accept an invitation.' },
      { status: 401 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { token } = body
  if (!token || typeof token !== 'string') {
    return Response.json({ error: 'Token is required' }, { status: 400 })
  }

  try {
    // Find the pending tenant membership by token
    const memberships = await payload.find({
      collection: 'tenant-memberships',
      where: {
        'invitationDetails.invitationToken': { equals: token },
      },
      limit: 1,
      depth: 2,
      overrideAccess: true,
    })

    if (memberships.docs.length === 0) {
      return Response.json({ error: 'Invitation not found.' }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const membership = memberships.docs[0] as any

    if (membership.status !== 'pending') {
      if (membership.status === 'active') {
        return Response.json(
          { error: 'This invitation has already been accepted.' },
          { status: 409 },
        )
      }
      return Response.json(
        { error: 'This invitation is no longer valid.' },
        { status: 410 },
      )
    }

    // Check expiration
    const expiresAt = new Date(membership.invitationDetails?.invitationExpiresAt)
    if (isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
      return Response.json({ error: 'This invitation has expired.' }, { status: 410 })
    }

    // Activate the membership
    await payload.update({
      collection: 'tenant-memberships',
      id: membership.id,
      data: {
        user: user.id,
        status: 'active',
        joinedAt: new Date().toISOString(),
      },
      overrideAccess: true,
    })

    // Update corresponding Contact record if one exists
    const invitationEmail = membership.invitationDetails?.invitationEmail
    const tenantId =
      typeof membership.tenant === 'object' ? membership.tenant?.id : membership.tenant

    if (invitationEmail && tenantId) {
      try {
        const contacts = await payload.find({
          collection: 'contacts',
          where: {
            and: [
              { email: { equals: invitationEmail.toLowerCase() } },
              { tenant: { equals: tenantId } },
            ],
          },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        if (contacts.docs.length > 0) {
          await payload.update({
            collection: 'contacts',
            id: contacts.docs[0]!.id,
            data: {
              contactStatus: 'accepted',
              inviteStatus: 'accepted',
            },
            overrideAccess: true,
          })
        }
      } catch {
        // Non-critical — contact update failure shouldn't block acceptance
      }
    }

    // Auto-join user to the tenant's main space
    if (tenantId) {
      try {
        const spaces = await payload.find({
          collection: 'spaces',
          where: { tenant: { equals: tenantId } },
          sort: 'createdAt',
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })

        if (spaces.totalDocs > 0) {
          const mainSpace = spaces.docs[0]

          // Check if already a member (idempotent)
          const existingMembership = await payload.find({
            collection: 'space-memberships',
            where: {
              user: { equals: user.id },
              space: { equals: mainSpace.id },
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })

          if (existingMembership.totalDocs === 0) {
            await payload.create({
              collection: 'space-memberships',
              data: {
                user: user.id as number,
                space: mainSpace.id as number,
                role: 'member',
                status: 'active',
                joinedAt: new Date().toISOString(),
                tenant: tenantId as number,
              },
              overrideAccess: true,
            })
            payload.logger.info(
              `[tenant-invite-accept] User ${(user as any).email} auto-joined space "${mainSpace.name}" (tenant ${tenantId})`,
            )
          }
        }
      } catch {
        // Non-critical — user joined the tenant even if space auto-join fails
      }
    }

    // Extract tenant info for response
    const tenant = typeof membership.tenant === 'object' ? membership.tenant : null

    return Response.json({
      success: true,
      membership: {
        id: membership.id,
        tenantId: tenant?.id || membership.tenant,
        tenantName: tenant?.name || 'Unknown',
        role: membership.role,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to accept invitation'
    return Response.json({ error: message }, { status: 500 })
  }
}
