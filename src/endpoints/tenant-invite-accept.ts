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
    // Find the pending tenant membership by token. depth:1 resolves the tenant
    // relation (id/slug/domain/name) — all we need; depth:2 was wasteful.
    const memberships = await payload.find({
      collection: 'tenant-memberships',
      where: {
        'invitationDetails.invitationToken': { equals: token },
      },
      limit: 1,
      depth: 1,
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

    // Auto-join user to ALL tenant spaces. 2 read queries to compute the missing
    // set, then SEQUENTIAL creates. NOTE: do NOT parallelize the creates — on the
    // max=3 Vercel pool, parallel creates each grab a connection while their hooks
    // need another, deadlocking the pool for ~30s (504 + cascading timeouts on
    // heartbeat/email). Sequential holds ≤1 connection at a time.
    if (tenantId) {
      try {
        const spaces = await payload.find({
          collection: 'spaces',
          where: { tenant: { equals: tenantId } },
          sort: 'createdAt',
          limit: 100,
          depth: 0,
          overrideAccess: true,
        })
        const spaceIds = spaces.docs.map((s) => s.id)

        if (spaceIds.length > 0) {
          // One query for all existing memberships → diff against the space set.
          const existing = await payload.find({
            collection: 'space-memberships',
            where: {
              and: [{ user: { equals: user.id } }, { space: { in: spaceIds } }],
            },
            limit: 1000,
            depth: 0,
            overrideAccess: true,
          })
          const joined = new Set(
            existing.docs.map((m: any) => (typeof m.space === 'object' ? m.space?.id : m.space)), // eslint-disable-line @typescript-eslint/no-explicit-any
          )
          const missing = spaces.docs.filter((s) => !joined.has(s.id))

          // Create the missing memberships SEQUENTIALLY (pool-safe — see note above).
          for (const space of missing) {
            try {
              await payload.create({
                collection: 'space-memberships',
                data: {
                  user: user.id as number,
                  space: space.id as number,
                  role: 'member',
                  status: 'active',
                  joinedAt: new Date().toISOString(),
                  tenant: tenantId as number,
                },
                overrideAccess: true,
              })
            } catch {
              // Non-critical — keep going; the user already joined the tenant.
            }
          }
          if (missing.length > 0) {
            payload.logger.info(
              `[tenant-invite-accept] ${(user as any).email} auto-joined ${missing.length} space(s) (tenant ${tenantId})`,
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
        // Slug/domain let the client land the user INSIDE the tenant they just
        // joined (their identity is platform-global; this routes them in).
        tenantSlug: tenant?.slug || null,
        tenantDomain: tenant?.domain || null,
        role: membership.role,
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to accept invitation'
    return Response.json({ error: message }, { status: 500 })
  }
}
