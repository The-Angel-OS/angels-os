/**
 * Auto-activate a pending tenant membership when the user navigates to that
 * tenant's dashboard — navigation IS acceptance.
 *
 * Mirrors the activation logic in tenant-invite-accept.ts but skips the
 * token/expiry check: an authenticated user deliberately navigating to the
 * portal has implicitly accepted the invitation.
 *
 * Called fire-and-forget from the dashboard layout — never blocks rendering.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

export async function autoActivatePendingMembership(
  membershipId: number | string,
  userId: number | string,
  tenantId: number | string,
): Promise<void> {
  try {
    const payload = await getPayload({ config })

    // Re-check status to avoid double-activate race
    const membership = (await payload.findByID({
      collection: 'tenant-memberships',
      id: membershipId,
      depth: 0,
      overrideAccess: true,
    })) as any

    if (!membership || membership.status !== 'pending') return

    await payload.update({
      collection: 'tenant-memberships',
      id: membershipId,
      data: { user: userId, status: 'active', joinedAt: new Date().toISOString() } as any,
      overrideAccess: true,
    })

    const invitationEmail = membership.invitationDetails?.invitationEmail

    // ── Best-effort secondary work (same pattern as tenant-invite-accept) ──
    // SEQUENTIAL only — never parallelize writes on the max=3 Vercel pool.
    if (invitationEmail) {
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
            data: { contactStatus: 'accepted', inviteStatus: 'accepted' } as any,
            overrideAccess: true,
          })
        }
      } catch {
        /* non-critical */
      }
    }

    // Auto-join tenant spaces (sequential) — EXCEPT the AI Bus system space,
    // which ordinary members never get a membership row to (it surfaces in the
    // sidebar via fetchUserSpaces' special-case; read access stays resolver-gated).
    try {
      const spaces = await payload.find({
        collection: 'spaces',
        where: { and: [{ tenant: { equals: tenantId } }, { slug: { not_equals: 'ai-bus' } }] },
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
          existing.docs.map((m: any) => (typeof m.space === 'object' ? m.space?.id : m.space)),
        )
        for (const space of spaces.docs.filter((s) => !joined.has(s.id))) {
          try {
            await payload.create({
              collection: 'space-memberships',
              data: {
                user: Number(userId),
                space: Number(space.id),
                role: 'member',
                status: 'active',
                joinedAt: new Date().toISOString(),
                tenant: Number(tenantId),
              } as any,
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

    // Collapse any duplicate memberships for this person (e.g. an orphaned pending
    // email invite left behind when they joined) — "one person, one membership".
    try {
      const { reconcileDuplicateMemberships } = await import('./reconcileTenantMemberships')
      await reconcileDuplicateMemberships(payload, tenantId)
    } catch {
      /* non-critical — idempotent, can re-run */
    }
  } catch {
    /* never surface to the user — this runs fire-and-forget */
  }
}
