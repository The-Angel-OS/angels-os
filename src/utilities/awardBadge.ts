/**
 * Awarding a badge.
 *
 * There is no completions table and no completion event. A course ends at 100%
 * and `workProgress` already records that, so the award happens where the
 * progress is written — one place, no second thing to keep in sync.
 *
 * The award is an entry in the `badges` array on the user. Append-only, and we
 * CHECK BEFORE INSERT so re-reading the last lesson cannot mint a second copy.
 */
import type { Payload } from 'payload'

export interface AwardedBadge {
  work: string
  name?: string | null
  image?: string | null
  awardedAt?: string | null
  score?: number | null
}

/**
 * Award the Work's badge to a user if it has one and they do not.
 * Returns the badge when it was newly awarded, otherwise null.
 */
export async function awardBadgeForWork(
  payload: Payload,
  userId: number | string,
  workSlug: string,
  score?: number | null,
): Promise<AwardedBadge | null> {
  try {
    const res = await payload.find({
      collection: 'works',
      where: { slug: { equals: workSlug } },
      limit: 1,
      depth: 1, // populate the badge image so we can store its URL
      overrideAccess: true,
    })
    const work = res.docs?.[0] as
      | { badge?: { name?: string | null; image?: { url?: string } | string | null } | null }
      | undefined
    const name = work?.badge?.name?.trim()
    if (!name) return null // this Work awards nothing — not an error

    const user = (await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
      overrideAccess: true,
    })) as { badges?: AwardedBadge[] | null }

    const badges = Array.isArray(user?.badges) ? user.badges : []
    if (badges.some((b) => b?.work === workSlug)) return null // already earned

    const img = work?.badge?.image
    const badge: AwardedBadge = {
      work: workSlug,
      name,
      image: (typeof img === 'object' ? img?.url : img) ?? null,
      awardedAt: new Date().toISOString(),
      ...(typeof score === 'number' ? { score } : {}),
    }

    await payload.update({
      collection: 'users',
      id: userId,
      data: { badges: [...badges, badge] } as never,
      overrideAccess: true,
    })
    return badge
  } catch {
    // A badge is a gift. Failing to hand one over must never fail the progress
    // write that earned it.
    return null
  }
}
