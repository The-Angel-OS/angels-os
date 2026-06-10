/**
 * DM Roster — the data behind "see every portal member as a virtual DM."
 *
 * Every member of your tenant (plus LEO) should appear under Direct Messages
 * whether or not a channel exists yet. The channel is created lazily on first
 * use; the roster is the always-present marker list. Each entry carries the
 * DETERMINISTIC dm slug (so the UI knows the channel id before it exists) and a
 * `hasChannel` flag (so existing convos sort to the top). Presence is overlaid
 * client-side by userId (usePresence), so this stays a cheap, cacheable shape.
 *
 * Federation-wide DMs will extend this with a second `scope: 'federation'` band
 * underneath — same entry shape, resolved across peers.
 *
 * The slug convention MUST mirror dmChannels.findOrCreateDM exactly, or the UI
 * would point at a different channel than the one creation makes:
 *   - user↔user: dm-{[idA,idB] sorted lexicographically}.join('-')
 *   - user↔LEO:  dm-{selfId}-leo
 */

export interface DmRosterMember {
  /** The other party's id, or the literal 'leo' for the LEO assistant. */
  userId: number | string | 'leo'
  name: string | null
  email: string | null
  isLeo: boolean
  /** Deterministic DM channel slug (exists before the channel does). */
  dmSlug: string
  /** Whether a DM channel already exists for this pair. */
  hasChannel: boolean
}

/** Deterministic DM slug — mirrors dmChannels.findOrCreateDM. */
export function dmSlugFor(selfId: number | string, otherId: number | string | 'leo'): string {
  const parts =
    otherId === 'leo'
      ? [String(selfId), 'leo']
      : [String(selfId), String(otherId)].sort()
  return `dm-${parts.join('-')}`
}

export interface RawMember {
  userId: number | string
  name?: string | null
  email?: string | null
}

/**
 * Build the roster: LEO first, then members alpha by name/email, existing-channel
 * convos floated to the top within each band. Self is excluded.
 */
export function buildDmRoster(
  selfId: number | string,
  members: RawMember[],
  existingSlugs: Set<string>,
): DmRosterMember[] {
  const leoSlug = dmSlugFor(selfId, 'leo')
  const leo: DmRosterMember = {
    userId: 'leo',
    name: 'LEO',
    email: null,
    isLeo: true,
    dmSlug: leoSlug,
    hasChannel: existingSlugs.has(leoSlug),
  }

  const seen = new Set<string>()
  const people: DmRosterMember[] = []
  for (const m of members) {
    if (String(m.userId) === String(selfId)) continue // never DM yourself
    const key = String(m.userId)
    if (seen.has(key)) continue
    seen.add(key)
    const dmSlug = dmSlugFor(selfId, m.userId)
    people.push({
      userId: m.userId,
      name: m.name ?? null,
      email: m.email ?? null,
      isLeo: false,
      dmSlug,
      hasChannel: existingSlugs.has(dmSlug),
    })
  }

  people.sort((a, b) => {
    // Existing convos first, then alphabetical by display label.
    if (a.hasChannel !== b.hasChannel) return a.hasChannel ? -1 : 1
    const al = (a.name || a.email || '').toLowerCase()
    const bl = (b.name || b.email || '').toLowerCase()
    return al.localeCompare(bl)
  })

  return [leo, ...people]
}
