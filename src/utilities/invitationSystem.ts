/**
 * Invitation System — Sprint 3
 *
 * Handles invitation token generation, validation, acceptance,
 * and member management for space memberships.
 *
 * @see src/collections/SpaceMemberships/index.ts — schema
 * @see tests/unit/utilities/invitationSystem.test.ts — tests
 */
import type { Payload } from 'payload'
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
  email: string
  spaceId: number | string
  invitedByUserId: number | string
  role?: InvitableRole
  message?: string
  expiryDays?: number
}

export async function createInvitation(opts: CreateInvitationOptions) {
  const {
    payload,
    email,
    spaceId,
    invitedByUserId,
    role = 'member',
    message,
    expiryDays = DEFAULT_EXPIRY_DAYS,
  } = opts

  if (!isValidEmail(email)) {
    throw new Error('A valid email address is required.')
  }

  if (!INVITABLE_ROLES.includes(role)) {
    throw new Error(`Invalid role "${role}". Valid roles: ${INVITABLE_ROLES.join(', ')}.`)
  }

  const token = generateInvitationToken()
  const expiresAt = calculateExpiration(expiryDays)

  // Check for existing active membership by email
  // Look up user by email first
  const existingUsers = await payload.find({
    collection: 'users',
    where: { email: { equals: email.trim().toLowerCase() } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  const existingUserId = existingUsers.docs[0]?.id

  if (existingUserId) {
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

  // Create the pending membership with invitation details
  // If the user exists, link to their account; otherwise create with a placeholder
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const membershipData: Record<string, any> = {
    space: spaceId,
    role,
    status: 'pending',
    invitedBy: invitedByUserId,
    invitationDetails: {
      invitationToken: token,
      invitationExpiresAt: expiresAt.toISOString(),
      invitationEmail: email.trim().toLowerCase(),
      invitationMessage: message || undefined,
    },
  }

  if (existingUserId) {
    membershipData.user = existingUserId
  } else {
    // User doesn't exist yet — set user to the inviter temporarily
    // Will be re-assigned when the user registers and accepts
    membershipData.user = invitedByUserId
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
      const contacts = await payload.find({
        collection: 'contacts',
        where: {
          and: [
            { tenant: { equals: tenantForContact } },
            { email: { equals: email.trim().toLowerCase() } },
          ],
        },
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

  return {
    membershipId: membership.id,
    spaceId,
    spaceName: space?.name || 'Unknown Space',
    role: membership.role,
  }
}
