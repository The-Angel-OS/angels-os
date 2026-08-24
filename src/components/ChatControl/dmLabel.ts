/**
 * What a DM is called in YOUR sidebar.
 *
 * DM channels are stored with a symmetric name — "Kenneth Courtney ↔ Tyler
 * Suzanne" — because one row serves both people. Rendering that row's `name`
 * meant everyone read their own name in their own list, twice as wide as it
 * needed to be, and the one piece of information that actually matters (who is
 * this thread with) had to be worked out by elimination.
 *
 * A DM is named after the OTHER person. The members are already on the channel,
 * so this is a lookup, not a migration — and it is symmetric for free: Ken sees
 * "Tyler Suzanne", Tyler sees "Kenneth Courtney", from the same row.
 *
 * Pure, so the fallback ladder is testable without a chat client.
 */

export interface DmMember {
  id: string
  name?: string | null
  email?: string | null
}

export interface DmLabelChannel {
  slug: string
  name?: string | null
  members?: DmMember[]
}

/** The other party in a DM, or undefined for an agent thread / a thread of one. */
export function dmPartner(
  channel: DmLabelChannel,
  selfId: string | number,
): DmMember | undefined {
  return (channel.members || []).find((m) => String(m.id) !== String(selfId))
}

/**
 * Fallback ladder, in order: the other member's name, their email, then the
 * stored channel name, then a generic. The stored name is LAST rather than
 * absent because a legacy row whose members never populated should still read
 * as something rather than "Direct message".
 */
export function dmLabel(channel: DmLabelChannel, selfId: string | number): string {
  if (channel.slug?.endsWith('-leo')) return 'LEO'
  if (channel.slug?.endsWith('-nimue')) return 'Nimue'

  const other = dmPartner(channel, selfId)
  if (other?.name?.trim()) return other.name.trim()
  if (other?.email?.trim()) return other.email.trim()

  // No members resolved. Strip our own side out of the symmetric name if we can
  // recognise it, rather than showing the reader their own name back.
  const stored = channel.name?.trim()
  if (stored) {
    const sides = stored.split('↔').map((s) => s.trim()).filter(Boolean)
    if (sides.length === 2) {
      const self = (channel.members || []).find((m) => String(m.id) === String(selfId))
      const mine = self?.name?.trim() || self?.email?.trim()
      if (mine) {
        const theirs = sides.find((s) => s !== mine)
        if (theirs) return theirs
      }
    }
    return stored
  }

  return 'Direct message'
}
