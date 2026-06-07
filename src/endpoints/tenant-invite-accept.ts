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

    const invitationEmail = membership.invitationDetails?.invitationEmail
    const tenantId =
      typeof membership.tenant === 'object' ? membership.tenant?.id : membership.tenant
    const userId = user.id

    // ── Best-effort secondary work — MUST NOT block the response ──────────────
    // The membership is now ACTIVE, so the user is in regardless. Under DB-pool
    // pressure (max=3 Vercel pool) these extra queries can stall ~30s and 504 the
    // whole function — so we fire-and-forget. All of it is idempotent and re-runs
    // harmlessly (the dashboard also reconciles space membership on load).
    void (async () => {
      // Mark the Contact accepted.
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
              data: { contactStatus: 'accepted', inviteStatus: 'accepted' },
              overrideAccess: true,
            })
          }
        } catch {
          /* non-critical */
        }
      }

      // Auto-join tenant spaces — SEQUENTIAL only (never parallelize on the max=3
      // pool; parallel creates deadlock it). Idempotent via the missing-set diff.
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
            const existing = await payload.find({
              collection: 'space-memberships',
              where: { and: [{ user: { equals: userId } }, { space: { in: spaceIds } }] },
              limit: 1000,
              depth: 0,
              overrideAccess: true,
            })
            const joined = new Set(
              existing.docs.map((m: any) => (typeof m.space === 'object' ? m.space?.id : m.space)), // eslint-disable-line @typescript-eslint/no-explicit-any
            )
            const missing = spaces.docs.filter((s) => !joined.has(s.id))
            for (const space of missing) {
              try {
                await payload.create({
                  collection: 'space-memberships',
                  data: {
                    user: userId as number,
                    space: space.id as number,
                    role: 'member',
                    status: 'active',
                    joinedAt: new Date().toISOString(),
                    tenant: tenantId as number,
                  },
                  overrideAccess: true,
                })
              } catch {
                /* keep going */
              }
            }
          }
        } catch {
          /* non-critical */
        }
      }
    })()

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
