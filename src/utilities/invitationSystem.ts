/**
 * Invitation System — Sprint 3
 *
 * Handles invitation token generation, validation, acceptance,
 * and member management for space memberships.
 *
 * @see src/collections/SpaceMemberships/index.ts — schema
 * @see tests/unit/utilities/invitationSystem.test.ts — tests
 */
import type { Payload, Where } from 'payload'
import crypto from 'crypto'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Valid roles for invitation (can't invite as space_admin) */
export const INVITABLE_ROLES = ['member', 'moderator', 'guest'] as const
export type InvitableRole = (typeof INVITABLE_ROLES)[number]

/** Roles that can invite others */
export const INVITE_CAPABLE_ROLES = ['space_admin', 'moderator'] as const

/** Default invitation expiration in days */
export const DEFAULT_EXPIRY_DAYS = 7

// ---------------------------------------------------------------------------
// Token Generation
// ---------------------------------------------------------------------------

/** Generate a cryptographically random, URL-safe invitation token */
export function generateInvitationToken(): string {
  return crypto.randomUUID()
}

/** Calculate expiration date from now */
export function calculateExpiration(days: number = DEFAULT_EXPIRY_DAYS): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

// ---------------------------------------------------------------------------
// Email Validation
// ---------------------------------------------------------------------------

export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

// ---------------------------------------------------------------------------
// Email Masking (privacy)
// ---------------------------------------------------------------------------

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***@***'
  if (local.length <= 2) return `${local[0]}*@${domain}`
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`
}

// ---------------------------------------------------------------------------
// Invitation URL
// ---------------------------------------------------------------------------

export function generateInviteUrl(token: string, baseUrl: string = ''): string {
  return `${baseUrl}/invite/${token}`
}

// ---------------------------------------------------------------------------
// Invitation Creation (Payload)
// ---------------------------------------------------------------------------

export interface CreateInvitationOptions {
  payload: Payload
  /** Email anchor. Optional only when `phone` is supplied. */
  email?: string
  /** Mobile number (any format; normalized to E.164). Enables sign-in by text. */
  phone?: string
  /** Display name the admin typed, if any. */
  name?: string
  spaceId: number | string
  invitedByUserId: number | string
  role?: InvitableRole
  message?: string
  expiryDays?: number
}

export async function createInvitation(opts: CreateInvitationOptions) {
  const {
    payload,
    email: rawEmail,
    phone: rawPhone,
    name,
    spaceId,
    invitedByUserId,
    role = 'member',
    message,
    expiryDays = DEFAULT_EXPIRY_DAYS,
  } = opts

  const email = (rawEmail || '').trim().toLowerCase()
  const phone = (rawPhone || '').trim()

  // Email OR phone. Requiring email meant you could not invite someone you only
  // know by number, which is most of the people an admin actually wants to add.
  if (!email && !phone) {
    throw new Error('An email address or a mobile number is required.')
  }
  if (email && !isValidEmail(email)) {
    throw new Error('A valid email address is required.')
  }

  if (!INVITABLE_ROLES.includes(role)) {
    throw new Error(`Invalid role "${role}". Valid roles: ${INVITABLE_ROLES.join(', ')}.`)
  }

  const token = generateInvitationToken()
  const expiresAt = calculateExpiration(expiryDays)

  // An invitation names a person, so the person exists from here on. This
  // find-or-creates the shell account and returns a real user id — no more
  // "park it on the inviter and sort it out at accept time".
  const { findOrCreateInvitedUser } = await import('@/utilities/findOrCreateInvitedUser')
  const invited = await findOrCreateInvitedUser(payload, { email, phone, name })
  const existingUserId = invited.userId

  // A freshly minted shell has no memberships to collide with; only re-check
  // when we attached to somebody who was already here.
  if (!invited.created) {
    // Check if already a member
    const existingMembership = await payload.find({
      collection: 'space-memberships',
      where: {
        and: [
          { user: { equals: existingUserId } },
          { space: { equals: spaceId } },
          { status: { in: ['active', 'pending'] } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existingMembership.docs.length > 0) {
      const existing = existingMembership.docs[0]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const status = (existing as any).status
      if (status === 'active') {
        throw new Error('This person is already a member of this space.')
      }
      if (status === 'pending') {
        throw new Error('An invitation has already been sent to this email.')
      }
    }

    // Check for banned user
    const bannedCheck = await payload.find({
      collection: 'space-memberships',
      where: {
        and: [
          { user: { equals: existingUserId } },
          { space: { equals: spaceId } },
          { status: { equals: 'banned' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (bannedCheck.docs.length > 0) {
      throw new Error('This person has been banned from this space.')
    }
  }

  // The pending membership points at the INVITEE. It used to point at the
  // inviter when the invitee had no account — a row asserting that you are a
  // pending member of the space you just invited someone to, waiting for any
  // query that forgets to filter on status.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const membershipData: Record<string, any> = {
    user: existingUserId,
    space: spaceId,
    role,
    status: 'pending',
    invitedBy: invitedByUserId,
    invitationDetails: {
      invitationToken: token,
      invitationExpiresAt: expiresAt.toISOString(),
      ...(email ? { invitationEmail: email } : {}),
      ...(invited.phone ? { invitationPhone: invited.phone } : {}),
      ...(name ? { invitationName: name } : {}),
      invitationMessage: message || undefined,
    },
  }

  // space-memberships are tenant-scoped. On a request path the multi-tenant
  // plugin auto-assigns the tenant from the cookie, but on non-request paths
  // (CRON provisioning) there's no cookie → "field invalid: Assigned Tenant".
  // Derive it from the space so every caller is covered.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sp = (await payload.findByID({ collection: 'spaces', id: spaceId as any, depth: 0, overrideAccess: true })) as any
    const spaceTenantId = sp?.tenant && typeof sp.tenant === 'object' ? sp.tenant.id : sp?.tenant
    if (spaceTenantId != null) membershipData.tenant = spaceTenantId
  } catch {
    /* leave unset — request-context auto-assign may still cover it */
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const membership = await (payload.create as any)({
    collection: 'space-memberships',
    data: membershipData,
    overrideAccess: true,
  })

  // Close the CRM funnel loop: a matching Contact (harvested by capture_lead /
  // web forms) moves lead → invited. Fail-soft — funnel bookkeeping must never
  // block the invite itself.
  try {
    const tenantForContact = membershipData.tenant
    if (tenantForContact != null) {
      // Match on whichever anchor the invite carried — a phone-only invite has
      // no email to match on, and `{ email: { equals: '' } }` silently matches
      // nothing, so the funnel never moved for those.
      const anchors: Where[] = []
      if (email) anchors.push({ email: { equals: email } })
      if (invited.phone) anchors.push({ phone: { equals: invited.phone } })
      const contacts = await payload.find({
        collection: 'contacts',
        where: { and: [{ tenant: { equals: tenantForContact } }, { or: anchors }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const contact = contacts.docs[0] as { id: number; inviteCount?: number } | undefined
      if (contact) {
        await payload.update({
          collection: 'contacts',
          id: contact.id,
          data: {
            contactStatus: 'invited',
            inviteStatus: 'invited',
            lastInvitedAt: new Date().toISOString(),
            inviteCount: (contact.inviteCount ?? 0) + 1,
          } as never,
          overrideAccess: true,
        })
      }
    }
  } catch {
    /* fail-soft */
  }

  return {
    membershipId: membership.id,
    token,
    expiresAt: expiresAt.toISOString(),
    inviteUrl: generateInviteUrl(token),
  }
}

// ---------------------------------------------------------------------------
// Invitation Acceptance (Payload)
// ---------------------------------------------------------------------------

export async function acceptInvitation(
  payload: Payload,
  token: string,
  userId: number | string,
) {
  // Find the pending membership by token
  const memberships = await payload.find({
    collection: 'space-memberships',
    where: {
      'invitationDetails.invitationToken': { equals: token },
    },
    limit: 1,
    depth: 1,
    overrideAccess: true,
  })

  if (memberships.docs.length === 0) {
    throw new Error('Invitation not found.')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const membership = memberships.docs[0] as any

  if (membership.status !== 'pending') {
    if (membership.status === 'active') {
      throw new Error('This invitation has already been accepted.')
    }
    throw new Error('This invitation is no longer valid.')
  }

  const expiresAt = new Date(membership.invitationDetails?.invitationExpiresAt)
  if (isNaN(expiresAt.getTime()) || expiresAt < new Date()) {
    throw new Error('This invitation has expired.')
  }

  // Activate the membership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (payload.update as any)({
    collection: 'space-memberships',
    id: membership.id,
    data: {
      user: userId,
      status: 'active',
      joinedAt: new Date().toISOString(),
    },
    overrideAccess: true,
  })

  // Extract space info
  const space = typeof membership.space === 'object' ? membership.space : null
  const spaceId = space?.id || membership.space

  // Funnel bookkeeping: invited → accepted on the matching Contact. Fail-soft.
  try {
    const inviteEmail = membership.invitationDetails?.invitationEmail
    const tenantId = typeof membership.tenant === 'object' ? membership.tenant?.id : membership.tenant
    if (inviteEmail && tenantId != null) {
      const contacts = await payload.find({
        collection: 'contacts',
        where: { and: [{ tenant: { equals: tenantId } }, { email: { equals: inviteEmail } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const contact = contacts.docs[0] as { id: number } | undefined
      if (contact) {
        await payload.update({
          collection: 'contacts',
          id: contact.id,
          data: { contactStatus: 'accepted', inviteStatus: 'accepted' } as never,
          overrideAccess: true,
        })
      }
    }
  } catch {
    /* fail-soft */
  }

  // ── Arrival ───────────────────────────────────────────────────────────────
  // Accepting used to return JSON and drop the person on the generic Spaces
  // list: they were in, and nothing showed them where. Resolve the actual room
  // and announce them in it, so arriving is not silence for either side.
  const tenantId = typeof membership.tenant === 'object' ? membership.tenant?.id : membership.tenant
  let channelId: number | string | null = null
  let destination = spaceId ? `/dashboard/spaces/${spaceId}` : '/dashboard/spaces'

  try {
    const channels = await payload.find({
      collection: 'channels',
      where: { space: { equals: spaceId } },
      sort: 'createdAt',
      limit: 50,
      depth: 0,
      overrideAccess: true,
    })
    const docs = channels.docs as unknown as Array<{ id: number | string; isDefault?: boolean }>
    const target = docs.find((c) => c.isDefault) ?? docs[0]
    if (target) {
      channelId = target.id
      destination = `/dashboard/spaces/${spaceId}/${channelId}`
    }
  } catch {
    /* fail-soft — the space itself is still a real destination */
  }

  try {
    const user = await payload.findByID({ collection: 'users', id: userId, depth: 0, overrideAccess: true })
    const who = (user as unknown as { name?: string; email?: string })
    const name = who.name || who.email?.split('@')[0] || 'Someone'
    // Messages key on the channel SLUG, and channels carry no slug — so reuse
    // the slug this space is already talking in rather than inventing one that
    // nobody is reading.
    const recent = await payload.find({
      collection: 'messages',
      where: { space: { equals: spaceId } },
      sort: '-createdAt',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const channelSlug =
      (recent.docs as unknown as Array<{ channel?: string }>)[0]?.channel || 'general'
    const invitedBy = typeof membership.invitedBy === 'object' ? membership.invitedBy : null
    const inviterName = invitedBy?.name || invitedBy?.email || null

    await payload.create({
      collection: 'messages',
      data: {
        space: spaceId,
        channel: channelSlug,
        messageType: 'system',
        visibility: 'tenant',
        content: { type: 'text', text: inviterName ? `${name} joined, invited by ${inviterName}.` : `${name} joined.` },
        ...(tenantId != null ? { tenant: tenantId } : {}),
        metadata: { kind: 'member_joined', userId, membershipId: membership.id },
      } as never,
      overrideAccess: true,
    })
  } catch {
    /* fail-soft — a missed hello must never fail the acceptance */
  }

  return {
    membershipId: membership.id,
    spaceId,
    spaceName: space?.name || 'Unknown Space',
    role: membership.role,
    channelId,
    /** Where the client should actually take them. */
    destination,
  }
}
