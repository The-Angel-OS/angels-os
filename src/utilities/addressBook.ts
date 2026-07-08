/**
 * Address Book — the derived "my people" roster.
 *
 * This is NOT the CRM `contacts` collection (that's an outbound invite/leads
 * list keyed on email). This is the set of people the signed-in user actually
 * communicates with, assembled from real relationships:
 *
 *   1. DM channels the user is a member of  → conversation partners (kind:'user')
 *   2. CRM contacts (reachable, no thread yet) → kind:'contact'  [optional]
 *
 * It's the home surface for Nimue ("see my people, tap one, message · call")
 * and the roster the leoBrain loop reasons over when acting on the user's
 * behalf (list_contacts / message_contact). Derived at read time — no schema.
 */
import type { Payload } from 'payload'

export interface AddressBookEntry {
  /** 'user' = has an account + a DM channel; 'contact' = CRM lead, reachable-but-no-thread */
  kind: 'user' | 'contact'
  /** userId (kind:user) or contactId (kind:contact) */
  id: number | string
  name: string
  email: string | null
  avatarUrl: string | null
  /** DM channel slug — present for kind:'user' */
  channelSlug: string | null
  spaceId: number | null
  /** ISO timestamp of the most recent message in the DM, if any */
  lastMessageAt: string | null
  /** What the user can do with this contact from the address book */
  affordances: string[]
}

interface GetAddressBookOpts {
  tenantId: number | string
  userId: number | string
  includeContacts?: boolean
  limit?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function memberId(m: any): string {
  return String(typeof m === 'object' && m !== null ? m.id : m)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function avatarOf(u: any): string | null {
  if (!u || typeof u !== 'object') return null
  if (typeof u.avatarUrl === 'string' && u.avatarUrl) return u.avatarUrl
  if (u.avatar && typeof u.avatar === 'object' && typeof u.avatar.url === 'string') return u.avatar.url
  const social = Array.isArray(u.socialProviders) ? u.socialProviders : []
  const withAvatar = social.find((p: { avatarUrl?: string }) => p?.avatarUrl)
  return withAvatar?.avatarUrl || null
}

/**
 * Build the user's address book for a tenant.
 * Conversation partners (most-recent first) then reachable CRM contacts.
 */
export async function getAddressBook(
  payload: Payload,
  { tenantId, userId, includeContacts = true, limit = 200 }: GetAddressBookOpts,
): Promise<AddressBookEntry[]> {
  const uid = String(userId)

  // ── 1. DM channels the user belongs to ────────────────────────────────
  const dmChannels = await payload.find({
    collection: 'channels',
    where: {
      and: [
        { type: { equals: 'dm' } },
        { tenant: { equals: tenantId } },
        { members: { in: [userId] } },
      ],
    },
    depth: 1, // populate members with user docs
    limit: 100,
    sort: '-updatedAt',
    overrideAccess: true,
  })

  const userEntries: AddressBookEntry[] = []
  const seenUserIds = new Set<string>()
  const seenEmails = new Set<string>()

  await Promise.all(
    dmChannels.docs.map(async (ch) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chAny = ch as any
      const members: unknown[] = Array.isArray(chAny.members) ? chAny.members : []
      const others = members.filter((m) => memberId(m) !== uid)
      if (others.length === 0) return

      const slug = chAny.slug as string
      const spaceId =
        typeof chAny.space === 'object' && chAny.space !== null
          ? Number(chAny.space.id)
          : chAny.space != null
            ? Number(chAny.space)
            : null

      // Most-recent message in this DM (recency + preview signal)
      let lastMessageAt: string | null = null
      try {
        const last = await payload.find({
          collection: 'messages',
          where: { and: [{ channel: { equals: slug } }, { tenant: { equals: tenantId } }] },
          sort: '-createdAt',
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const m = last.docs?.[0] as any
        lastMessageAt = m?.createdAt ? String(m.createdAt) : null
      } catch {
        /* recency is best-effort */
      }

      for (const other of others) {
        const oid = memberId(other)
        if (seenUserIds.has(oid)) continue
        seenUserIds.add(oid)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ou = other as any
        const email = typeof ou === 'object' ? (ou.email ?? null) : null
        const name =
          (typeof ou === 'object' && (ou.name || ou.email)) || `User ${oid}`
        if (email) seenEmails.add(String(email).toLowerCase())
        userEntries.push({
          kind: 'user',
          id: typeof ou === 'object' && ou.id != null ? ou.id : oid,
          name,
          email,
          avatarUrl: avatarOf(ou),
          channelSlug: slug,
          spaceId,
          lastMessageAt,
          affordances: ['message', 'call'],
        })
      }
    }),
  )

  // conversation partners: most-recent first, nulls last
  userEntries.sort((a, b) => {
    if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt.localeCompare(a.lastMessageAt)
    if (a.lastMessageAt) return -1
    if (b.lastMessageAt) return 1
    return a.name.localeCompare(b.name)
  })

  // ── 2. CRM contacts (reachable, no thread yet) ─────────────────────────
  const contactEntries: AddressBookEntry[] = []
  if (includeContacts) {
    try {
      const crm = await payload.find({
        collection: 'contacts',
        where: { tenant: { equals: tenantId } },
        limit: Math.max(0, limit - userEntries.length),
        depth: 0,
        sort: 'name',
        overrideAccess: true,
      })
      for (const c of crm.docs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ca = c as any
        const email = ca.email ? String(ca.email) : null
        if (email && seenEmails.has(email.toLowerCase())) continue // already a conversation partner
        contactEntries.push({
          kind: 'contact',
          id: ca.id,
          name: ca.name || email || `Contact ${ca.id}`,
          email,
          avatarUrl: null,
          channelSlug: null,
          spaceId: null,
          lastMessageAt: null,
          affordances: ['message', 'invite'],
        })
      }
    } catch {
      /* CRM fold-in is best-effort */
    }
  }

  return [...userEntries, ...contactEntries].slice(0, limit)
}

/**
 * Resolve a free-text contact reference (a name, an email, or a numeric userId)
 * against the address book. Returns the matches so callers can disambiguate.
 */
export function resolveContact(
  entries: AddressBookEntry[],
  ref: string,
): AddressBookEntry[] {
  const q = ref.trim().toLowerCase()
  if (!q) return []

  // Numeric → exact userId match
  if (/^\d+$/.test(q)) {
    const byId = entries.filter((e) => String(e.id) === q && e.kind === 'user')
    if (byId.length) return byId
  }

  // Exact email
  const byEmail = entries.filter((e) => e.email && e.email.toLowerCase() === q)
  if (byEmail.length) return byEmail

  // Exact name
  const byExactName = entries.filter((e) => e.name.toLowerCase() === q)
  if (byExactName.length) return byExactName

  // Substring (name or email)
  return entries.filter(
    (e) => e.name.toLowerCase().includes(q) || (e.email && e.email.toLowerCase().includes(q)),
  )
}
