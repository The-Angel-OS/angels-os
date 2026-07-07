/**
 * activatePendingInvites — the ignition spark of the invitation growth loop.
 *
 * The loop: you invite mom@gmail.com to your guardian angel's space → a PENDING
 * membership is created keyed to her email → she signs into Nimue with that
 * Google account → her own guardian angel provisions → and every invite waiting
 * on her email lights up automatically, so she's already inside your space the
 * moment she arrives. No token to click, no extra step: getting your angel IS
 * accepting your invitations.
 *
 * Because identity = the Google account (the network's source of truth), a
 * pending invite keyed by email resolves deterministically to the right person
 * on their first login. This is what makes the network self-populate: each invite
 * that requires a Google login mints a new sovereign node.
 *
 * Fail-soft and sequential (never parallelize writes on the max=3 Vercel pool).
 *
 * @see src/utilities/invitationSystem.ts — space invites (pending space-memberships)
 * @see src/utilities/autoActivatePendingMembership.ts — tenant invites (full side-effects)
 * @see src/endpoints/claim-guardian-angel.ts — the onboarding entry that fires this
 */
import type { Payload } from 'payload'
import { autoActivatePendingMembership } from '@/utilities/autoActivatePendingMembership'

export interface ActivateInvitesResult {
  spaceActivated: number
  tenantActivated: number
}

/**
 * Activate every pending invitation addressed to `email` for the given user —
 * both space-level and tenant-level. Idempotent (only touches `pending` rows);
 * safe to call on every login/claim.
 */
export async function activatePendingInvitesForUser(
  payload: Payload,
  userId: number | string,
  email: string,
): Promise<ActivateInvitesResult> {
  const em = (email || '').trim().toLowerCase()
  const result: ActivateInvitesResult = { spaceActivated: 0, tenantActivated: 0 }
  if (!em) return result

  const now = new Date().toISOString()

  // ── Space invites: pending space-memberships keyed to this email ──
  // (created with `user` = the inviter as a placeholder; we reassign to the real
  // person here — same effect as clicking the invite link, minus the click.)
  try {
    const pending = await payload.find({
      collection: 'space-memberships',
      where: {
        and: [
          { 'invitationDetails.invitationEmail': { equals: em } },
          { status: { equals: 'pending' } },
        ],
      },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    for (const m of pending.docs) {
      try {
        await payload.update({
          collection: 'space-memberships',
          id: (m as { id: number | string }).id,
          data: { user: Number(userId), status: 'active', joinedAt: now } as never,
          overrideAccess: true,
        })
        result.spaceActivated++
      } catch {
        /* keep going — one bad row shouldn't block the rest */
      }
    }
  } catch {
    /* non-critical */
  }

  // ── Tenant invites: pending tenant-memberships keyed to this email ──
  // Reuse autoActivatePendingMembership for its full side-effects (activate +
  // contact sync + auto-join tenant spaces + dedup).
  try {
    const pending = await payload.find({
      collection: 'tenant-memberships',
      where: {
        and: [
          { 'invitationDetails.invitationEmail': { equals: em } },
          { status: { equals: 'pending' } },
        ],
      },
      limit: 200,
      depth: 0,
      overrideAccess: true,
    })
    for (const m of pending.docs) {
      const doc = m as { id: number | string; tenant?: number | string | { id: number | string } }
      const tenantId = typeof doc.tenant === 'object' ? doc.tenant?.id : doc.tenant
      if (tenantId == null) continue
      try {
        await autoActivatePendingMembership(doc.id, userId, tenantId)
        result.tenantActivated++
      } catch {
        /* keep going */
      }
    }
  } catch {
    /* non-critical */
  }

  return result
}
