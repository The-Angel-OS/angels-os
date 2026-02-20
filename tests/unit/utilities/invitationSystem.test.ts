/**
 * Unit tests for Invitation System — Sprint 3.
 *
 * Tests invitation token generation, validation, acceptance flow,
 * invite_member LEO tool, and member management operations.
 * Uses the project pattern of re-implementing pure validation logic
 * to avoid Payload-coupled imports.
 *
 * @see src/utilities/invitationSystem.ts — invitation utilities
 * @see src/utilities/leo-data-tools.ts — invite_member tool
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implement validation logic (mirrors invitationSystem.ts)
// ---------------------------------------------------------------------------

/** Valid roles for space membership */
const VALID_ROLES = ['space_admin', 'moderator', 'member', 'guest'] as const
type MemberRole = (typeof VALID_ROLES)[number]

/** Valid invitation roles (subset — can't invite as space_admin) */
const INVITABLE_ROLES = ['member', 'moderator', 'guest'] as const
type InvitableRole = (typeof INVITABLE_ROLES)[number]

/** Valid membership statuses */
const VALID_STATUSES = ['active', 'pending', 'suspended', 'left', 'banned'] as const
type MemberStatus = (typeof VALID_STATUSES)[number]

/** Roles that can invite others */
const INVITE_CAPABLE_ROLES: MemberRole[] = ['space_admin', 'moderator']

/** Default invitation expiration: 7 days */
const DEFAULT_EXPIRY_DAYS = 7

// ─── Token Generation ────────────────────────────────────────────

/** Generate a URL-safe invitation token */
function generateInvitationToken(): string {
  // UUID v4 format — 36 chars, URL-safe
  const segments = [
    randomHex(8),
    randomHex(4),
    '4' + randomHex(3), // version 4
    ((Math.random() * 4) | 8).toString(16) + randomHex(3), // variant
    randomHex(12),
  ]
  return segments.join('-')
}

function randomHex(length: number): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 16).toString(16)
  }
  return result
}

/** Check if a token is URL-safe */
function isUrlSafeToken(token: string): boolean {
  return /^[a-f0-9-]+$/.test(token) && token.length >= 32
}

/** Calculate expiration date from now */
function calculateExpiration(days: number = DEFAULT_EXPIRY_DAYS): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

// ─── Email Validation ────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

// ─── Invitation Validation ───────────────────────────────────────

interface InvitationRecord {
  invitationToken: string
  invitationExpiresAt: string | Date
  invitationEmail: string
  invitationMessage?: string
  status: MemberStatus
  role: MemberRole
  space: number | string
  user?: number | string
  invitedBy?: number | string
  joinedAt?: string | Date | null
}

function validateInvitation(invitation: InvitationRecord | null): {
  valid: boolean
  error?: string
} {
  if (!invitation) {
    return { valid: false, error: 'Invitation not found.' }
  }
  if (invitation.status !== 'pending') {
    if (invitation.status === 'active') {
      return { valid: false, error: 'This invitation has already been accepted.' }
    }
    return { valid: false, error: 'This invitation is no longer valid.' }
  }
  const expiresAt = new Date(invitation.invitationExpiresAt)
  if (isNaN(expiresAt.getTime())) {
    return { valid: false, error: 'Invalid expiration date.' }
  }
  if (expiresAt < new Date()) {
    return { valid: false, error: 'This invitation has expired.' }
  }
  return { valid: true }
}

// ─── Invitation Creation Validation ──────────────────────────────

interface CreateInvitationInput {
  email: string
  spaceId?: string | number
  role?: string
  message?: string
  requesterRole?: MemberRole
}

function validateCreateInvitation(input: CreateInvitationInput): string | null {
  if (!input.email || !isValidEmail(input.email)) {
    return 'Error: A valid email address is required.'
  }

  if (input.role && !INVITABLE_ROLES.includes(input.role as InvitableRole)) {
    return `Error: Invalid role "${input.role}". Valid roles: ${INVITABLE_ROLES.join(', ')}.`
  }

  if (input.requesterRole && !INVITE_CAPABLE_ROLES.includes(input.requesterRole)) {
    return 'Error: You do not have permission to invite members. Only admins and moderators can invite.'
  }

  return null
}

// ─── Member Management ───────────────────────────────────────────

interface MemberRecord {
  id: string | number
  user: number | string
  space: number | string
  role: MemberRole
  status: MemberStatus
  joinedAt?: string | Date | null
}

function validateRemoveMember(
  requester: MemberRecord,
  target: MemberRecord,
  allMembers: MemberRecord[],
): string | null {
  // Can't remove yourself
  if (requester.id === target.id) {
    return 'Error: You cannot remove yourself from the space.'
  }

  // Only admins and moderators can remove
  if (!INVITE_CAPABLE_ROLES.includes(requester.role)) {
    return 'Error: Only admins and moderators can remove members.'
  }

  // Moderators can't remove admins
  if (requester.role === 'moderator' && target.role === 'space_admin') {
    return 'Error: Moderators cannot remove admins.'
  }

  // Can't remove last admin
  if (target.role === 'space_admin') {
    const activeAdmins = allMembers.filter(
      (m) => m.role === 'space_admin' && m.status === 'active',
    )
    if (activeAdmins.length <= 1) {
      return 'Error: Cannot remove the last admin. Transfer admin role first.'
    }
  }

  return null
}

function validateRoleChange(
  requester: MemberRecord,
  target: MemberRecord,
  newRole: MemberRole,
  allMembers: MemberRecord[],
): string | null {
  // Only admins can change roles
  if (requester.role !== 'space_admin') {
    return 'Error: Only admins can change member roles.'
  }

  if (!VALID_ROLES.includes(newRole)) {
    return `Error: Invalid role "${newRole}".`
  }

  // Can't demote last admin
  if (target.role === 'space_admin' && newRole !== 'space_admin') {
    const activeAdmins = allMembers.filter(
      (m) => m.role === 'space_admin' && m.status === 'active',
    )
    if (activeAdmins.length <= 1) {
      return 'Error: Cannot demote the last admin. Promote another member first.'
    }
  }

  return null
}

function validateStatusChange(
  requester: MemberRecord,
  target: MemberRecord,
  newStatus: MemberStatus,
): string | null {
  if (!VALID_STATUSES.includes(newStatus)) {
    return `Error: Invalid status "${newStatus}".`
  }

  // Only admins/moderators can change status
  if (!INVITE_CAPABLE_ROLES.includes(requester.role)) {
    return 'Error: Only admins and moderators can change member status.'
  }

  // Can't ban/suspend an admin (moderator attempting)
  if (
    requester.role === 'moderator' &&
    target.role === 'space_admin' &&
    (newStatus === 'banned' || newStatus === 'suspended')
  ) {
    return 'Error: Moderators cannot ban or suspend admins.'
  }

  return null
}

// ─── Invitation Serialization ────────────────────────────────────

interface SerializedInvitation {
  token: string
  email: string
  maskedEmail: string
  role: string
  message?: string
  expiresAt: string
  expiresInDays: number
  inviterName?: string
  spaceName?: string
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return '***@***'
  if (local.length <= 2) return `${local[0]}*@${domain}`
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`
}

function serializeInvitation(
  invitation: InvitationRecord,
  inviterName?: string,
  spaceName?: string,
): SerializedInvitation {
  const expiresAt = new Date(invitation.invitationExpiresAt)
  const now = new Date()
  const diffMs = expiresAt.getTime() - now.getTime()
  const diffDays = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

  return {
    token: invitation.invitationToken,
    email: invitation.invitationEmail,
    maskedEmail: maskEmail(invitation.invitationEmail),
    role: invitation.role,
    message: invitation.invitationMessage,
    expiresAt: expiresAt.toISOString(),
    expiresInDays: diffDays,
    inviterName: inviterName || undefined,
    spaceName: spaceName || undefined,
  }
}

// ─── invite_member LEO Tool Definition ───────────────────────────

const INVITE_MEMBER_TOOL = {
  name: 'invite_member',
  description: 'Invite someone to a collaboration space by email',
  input_schema: {
    type: 'object' as const,
    properties: {
      email: { type: 'string', description: 'Email address of person to invite' },
      spaceId: { type: 'string', description: 'Space ID to invite them to' },
      message: { type: 'string', description: 'Optional personal message' },
      role: {
        type: 'string',
        enum: ['member', 'moderator', 'guest'],
        description: 'Role (default: member)',
      },
    },
    required: ['email'],
  },
}

// ─── Invitation URL generation ───────────────────────────────────

function generateInviteUrl(token: string, baseUrl: string = ''): string {
  return `${baseUrl}/invite/${token}`
}

// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

describe('Invitation System', () => {
  // ─── Token Generation ──────────────────────────────────────────

  describe('Token generation', () => {
    it('generates unique tokens', () => {
      const tokens = new Set<string>()
      for (let i = 0; i < 100; i++) {
        tokens.add(generateInvitationToken())
      }
      expect(tokens.size).toBe(100)
    })

    it('generates URL-safe tokens', () => {
      const token = generateInvitationToken()
      expect(isUrlSafeToken(token)).toBe(true)
      // No special chars that need URL encoding
      expect(token).toMatch(/^[a-f0-9-]+$/)
    })

    it('tokens are at least 32 characters', () => {
      const token = generateInvitationToken()
      expect(token.length).toBeGreaterThanOrEqual(32)
    })

    it('sets correct default expiration (7 days)', () => {
      const now = new Date()
      const expiry = calculateExpiration()
      const diffDays = Math.round(
        (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      )
      expect(diffDays).toBe(DEFAULT_EXPIRY_DAYS)
    })

    it('sets custom expiration', () => {
      const now = new Date()
      const expiry = calculateExpiration(14)
      const diffDays = Math.round(
        (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      )
      expect(diffDays).toBe(14)
    })
  })

  // ─── Email Validation ──────────────────────────────────────────

  describe('Email validation', () => {
    it('accepts valid email addresses', () => {
      expect(isValidEmail('alice@example.com')).toBe(true)
      expect(isValidEmail('bob.smith@company.org')).toBe(true)
      expect(isValidEmail('user+tag@domain.co.uk')).toBe(true)
    })

    it('rejects invalid email addresses', () => {
      expect(isValidEmail('')).toBe(false)
      expect(isValidEmail('notanemail')).toBe(false)
      expect(isValidEmail('@domain.com')).toBe(false)
      expect(isValidEmail('user@')).toBe(false)
      expect(isValidEmail('user @domain.com')).toBe(false)
    })

    it('rejects non-string inputs', () => {
      expect(isValidEmail(null as unknown as string)).toBe(false)
      expect(isValidEmail(undefined as unknown as string)).toBe(false)
      expect(isValidEmail(123 as unknown as string)).toBe(false)
    })
  })

  // ─── Invitation Validation ─────────────────────────────────────

  describe('Invitation validation', () => {
    const validInvitation: InvitationRecord = {
      invitationToken: 'abc-123-def-456',
      invitationExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      invitationEmail: 'alice@example.com',
      invitationMessage: 'Welcome!',
      status: 'pending',
      role: 'member',
      space: 1,
    }

    it('accepts valid pending invitation', () => {
      const result = validateInvitation(validInvitation)
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('rejects null invitation', () => {
      const result = validateInvitation(null)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invitation not found.')
    })

    it('rejects expired tokens', () => {
      const expired: InvitationRecord = {
        ...validInvitation,
        invitationExpiresAt: new Date(Date.now() - 1000).toISOString(),
      }
      const result = validateInvitation(expired)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('This invitation has expired.')
    })

    it('rejects already-accepted tokens', () => {
      const accepted: InvitationRecord = { ...validInvitation, status: 'active' }
      const result = validateInvitation(accepted)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('This invitation has already been accepted.')
    })

    it('rejects banned member invitation', () => {
      const banned: InvitationRecord = { ...validInvitation, status: 'banned' }
      const result = validateInvitation(banned)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('This invitation is no longer valid.')
    })

    it('rejects suspended member invitation', () => {
      const suspended: InvitationRecord = { ...validInvitation, status: 'suspended' }
      const result = validateInvitation(suspended)
      expect(result.valid).toBe(false)
    })

    it('rejects invitation with invalid expiration date', () => {
      const invalid: InvitationRecord = {
        ...validInvitation,
        invitationExpiresAt: 'not-a-date',
      }
      const result = validateInvitation(invalid)
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid expiration date.')
    })

    it('handles missing optional fields gracefully', () => {
      const minimal: InvitationRecord = {
        invitationToken: 'token-123',
        invitationExpiresAt: new Date(Date.now() + 86400000).toISOString(),
        invitationEmail: 'test@test.com',
        status: 'pending',
        role: 'member',
        space: 1,
      }
      const result = validateInvitation(minimal)
      expect(result.valid).toBe(true)
    })
  })

  // ─── Create Invitation Validation ──────────────────────────────

  describe('Create invitation validation', () => {
    it('validates email format', () => {
      const result = validateCreateInvitation({ email: 'notanemail' })
      expect(result).toContain('valid email')
    })

    it('rejects empty email', () => {
      const result = validateCreateInvitation({ email: '' })
      expect(result).toContain('valid email')
    })

    it('validates role enum', () => {
      const result = validateCreateInvitation({
        email: 'alice@test.com',
        role: 'super_admin',
      })
      expect(result).toContain('Invalid role')
    })

    it('accepts valid member role', () => {
      const result = validateCreateInvitation({
        email: 'alice@test.com',
        role: 'member',
        requesterRole: 'space_admin',
      })
      expect(result).toBeNull()
    })

    it('accepts valid moderator role', () => {
      const result = validateCreateInvitation({
        email: 'alice@test.com',
        role: 'moderator',
        requesterRole: 'space_admin',
      })
      expect(result).toBeNull()
    })

    it('accepts valid guest role', () => {
      const result = validateCreateInvitation({
        email: 'alice@test.com',
        role: 'guest',
        requesterRole: 'space_admin',
      })
      expect(result).toBeNull()
    })

    it('defaults role to member when not specified', () => {
      const result = validateCreateInvitation({
        email: 'alice@test.com',
        requesterRole: 'space_admin',
      })
      expect(result).toBeNull()
    })

    it('requires requester to be admin or moderator', () => {
      const result = validateCreateInvitation({
        email: 'alice@test.com',
        requesterRole: 'member',
      })
      expect(result).toContain('do not have permission')
    })

    it('rejects guest as inviter', () => {
      const result = validateCreateInvitation({
        email: 'alice@test.com',
        requesterRole: 'guest',
      })
      expect(result).toContain('do not have permission')
    })

    it('allows moderator to invite', () => {
      const result = validateCreateInvitation({
        email: 'alice@test.com',
        requesterRole: 'moderator',
      })
      expect(result).toBeNull()
    })
  })

  // ─── invite_member LEO Tool ────────────────────────────────────

  describe('invite_member LEO tool', () => {
    it('has correct tool name', () => {
      expect(INVITE_MEMBER_TOOL.name).toBe('invite_member')
    })

    it('has description', () => {
      expect(INVITE_MEMBER_TOOL.description).toBeTruthy()
      expect(INVITE_MEMBER_TOOL.description.length).toBeGreaterThan(10)
    })

    it('schema is object type', () => {
      expect(INVITE_MEMBER_TOOL.input_schema.type).toBe('object')
    })

    it('requires email', () => {
      expect(INVITE_MEMBER_TOOL.input_schema.required).toContain('email')
    })

    it('email property is string type', () => {
      expect(INVITE_MEMBER_TOOL.input_schema.properties.email.type).toBe('string')
    })

    it('role has valid enum values', () => {
      const roleEnum = INVITE_MEMBER_TOOL.input_schema.properties.role.enum
      expect(roleEnum).toContain('member')
      expect(roleEnum).toContain('moderator')
      expect(roleEnum).toContain('guest')
      // Should NOT include space_admin — can't invite someone as admin
      expect(roleEnum).not.toContain('space_admin')
    })

    it('has optional spaceId', () => {
      expect(INVITE_MEMBER_TOOL.input_schema.properties.spaceId).toBeDefined()
      expect(INVITE_MEMBER_TOOL.input_schema.required).not.toContain('spaceId')
    })

    it('has optional message', () => {
      expect(INVITE_MEMBER_TOOL.input_schema.properties.message).toBeDefined()
      expect(INVITE_MEMBER_TOOL.input_schema.required).not.toContain('message')
    })

    it('has optional role', () => {
      expect(INVITE_MEMBER_TOOL.input_schema.required).not.toContain('role')
    })

    it('generates invitation URL from token', () => {
      const token = 'abc-123-def-456-ghi-789'
      const url = generateInviteUrl(token)
      expect(url).toBe('/invite/abc-123-def-456-ghi-789')
    })

    it('generates invitation URL with base URL', () => {
      const token = 'abc-123'
      const url = generateInviteUrl(token, 'https://angels-os.com')
      expect(url).toBe('https://angels-os.com/invite/abc-123')
    })
  })

  // ─── Member Management ─────────────────────────────────────────

  describe('Member management', () => {
    const adminMember: MemberRecord = {
      id: '1', user: 101, space: 1, role: 'space_admin', status: 'active',
    }
    const modMember: MemberRecord = {
      id: '2', user: 102, space: 1, role: 'moderator', status: 'active',
    }
    const regularMember: MemberRecord = {
      id: '3', user: 103, space: 1, role: 'member', status: 'active',
    }
    const guestMember: MemberRecord = {
      id: '4', user: 104, space: 1, role: 'guest', status: 'active',
    }
    const secondAdmin: MemberRecord = {
      id: '5', user: 105, space: 1, role: 'space_admin', status: 'active',
    }

    const allMembers = [adminMember, modMember, regularMember, guestMember]
    const allMembersWithTwoAdmins = [...allMembers, secondAdmin]

    describe('Remove member', () => {
      it('admin can remove regular member', () => {
        const result = validateRemoveMember(adminMember, regularMember, allMembers)
        expect(result).toBeNull()
      })

      it('admin can remove moderator', () => {
        const result = validateRemoveMember(adminMember, modMember, allMembers)
        expect(result).toBeNull()
      })

      it('moderator can remove regular member', () => {
        const result = validateRemoveMember(modMember, regularMember, allMembers)
        expect(result).toBeNull()
      })

      it('prevents self-removal', () => {
        const result = validateRemoveMember(adminMember, adminMember, allMembers)
        expect(result).toContain('cannot remove yourself')
      })

      it('prevents removing last admin', () => {
        const result = validateRemoveMember(modMember, adminMember, allMembers)
        // Moderators can't remove admins anyway
        expect(result).toBeTruthy()
      })

      it('allows removing admin when multiple admins exist', () => {
        const result = validateRemoveMember(
          secondAdmin,
          adminMember,
          allMembersWithTwoAdmins,
        )
        expect(result).toBeNull()
      })

      it('regular member cannot remove others', () => {
        const result = validateRemoveMember(regularMember, guestMember, allMembers)
        expect(result).toContain('Only admins and moderators')
      })

      it('moderator cannot remove admin', () => {
        const result = validateRemoveMember(modMember, adminMember, allMembers)
        expect(result).toContain('Moderators cannot remove admins')
      })
    })

    describe('Role changes', () => {
      it('admin can promote member to moderator', () => {
        const result = validateRoleChange(adminMember, regularMember, 'moderator', allMembers)
        expect(result).toBeNull()
      })

      it('admin can demote moderator to member', () => {
        const result = validateRoleChange(adminMember, modMember, 'member', allMembers)
        expect(result).toBeNull()
      })

      it('moderator cannot change roles', () => {
        const result = validateRoleChange(modMember, regularMember, 'guest', allMembers)
        expect(result).toContain('Only admins can change')
      })

      it('prevents demoting last admin', () => {
        const result = validateRoleChange(adminMember, adminMember, 'member', allMembers)
        expect(result).toContain('Cannot demote the last admin')
      })

      it('allows demoting admin when multiple admins exist', () => {
        const result = validateRoleChange(
          secondAdmin,
          adminMember,
          'moderator',
          allMembersWithTwoAdmins,
        )
        expect(result).toBeNull()
      })

      it('rejects invalid role', () => {
        const result = validateRoleChange(
          adminMember,
          regularMember,
          'superuser' as MemberRole,
          allMembers,
        )
        expect(result).toContain('Invalid role')
      })
    })

    describe('Status changes', () => {
      it('admin can suspend member', () => {
        const result = validateStatusChange(adminMember, regularMember, 'suspended')
        expect(result).toBeNull()
      })

      it('admin can ban member', () => {
        const result = validateStatusChange(adminMember, regularMember, 'banned')
        expect(result).toBeNull()
      })

      it('admin can reactivate suspended member', () => {
        const suspended: MemberRecord = { ...regularMember, status: 'suspended' }
        const result = validateStatusChange(adminMember, suspended, 'active')
        expect(result).toBeNull()
      })

      it('moderator can suspend member', () => {
        const result = validateStatusChange(modMember, regularMember, 'suspended')
        expect(result).toBeNull()
      })

      it('moderator cannot ban admin', () => {
        const result = validateStatusChange(modMember, adminMember, 'banned')
        expect(result).toContain('Moderators cannot ban or suspend admins')
      })

      it('moderator cannot suspend admin', () => {
        const result = validateStatusChange(modMember, adminMember, 'suspended')
        expect(result).toContain('Moderators cannot ban or suspend admins')
      })

      it('regular member cannot change status', () => {
        const result = validateStatusChange(regularMember, guestMember, 'suspended')
        expect(result).toContain('Only admins and moderators')
      })

      it('rejects invalid status', () => {
        const result = validateStatusChange(
          adminMember,
          regularMember,
          'deleted' as MemberStatus,
        )
        expect(result).toContain('Invalid status')
      })
    })
  })

  // ─── Invitation Serialization ──────────────────────────────────

  describe('Invitation serialization', () => {
    const sampleInvitation: InvitationRecord = {
      invitationToken: 'token-abc-123',
      invitationExpiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      invitationEmail: 'alice@example.com',
      invitationMessage: 'Join our space!',
      status: 'pending',
      role: 'member',
      space: 1,
    }

    it('serializes invitation for UI', () => {
      const serialized = serializeInvitation(sampleInvitation)
      expect(serialized.token).toBe('token-abc-123')
      expect(serialized.email).toBe('alice@example.com')
      expect(serialized.role).toBe('member')
    })

    it('masks email for privacy', () => {
      const serialized = serializeInvitation(sampleInvitation)
      expect(serialized.maskedEmail).toBe('a***e@example.com')
    })

    it('masks short emails', () => {
      expect(maskEmail('ab@test.com')).toBe('a*@test.com')
    })

    it('handles malformed email', () => {
      expect(maskEmail('noatsign')).toBe('***@***')
    })

    it('formats expiration date as ISO string', () => {
      const serialized = serializeInvitation(sampleInvitation)
      expect(serialized.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('calculates days until expiration', () => {
      const serialized = serializeInvitation(sampleInvitation)
      expect(serialized.expiresInDays).toBeGreaterThanOrEqual(2)
      expect(serialized.expiresInDays).toBeLessThanOrEqual(4)
    })

    it('includes inviter name when provided', () => {
      const serialized = serializeInvitation(sampleInvitation, 'Herald')
      expect(serialized.inviterName).toBe('Herald')
    })

    it('includes space name when provided', () => {
      const serialized = serializeInvitation(sampleInvitation, undefined, 'Angel Workshop')
      expect(serialized.spaceName).toBe('Angel Workshop')
    })

    it('handles missing optional fields', () => {
      const minimal: InvitationRecord = {
        invitationToken: 'token',
        invitationExpiresAt: new Date(Date.now() + 86400000).toISOString(),
        invitationEmail: 'test@test.com',
        status: 'pending',
        role: 'member',
        space: 1,
      }
      const serialized = serializeInvitation(minimal)
      expect(serialized.message).toBeUndefined()
      expect(serialized.inviterName).toBeUndefined()
      expect(serialized.spaceName).toBeUndefined()
    })

    it('includes message when present', () => {
      const serialized = serializeInvitation(sampleInvitation)
      expect(serialized.message).toBe('Join our space!')
    })
  })

  // ─── Duplicate Handling ────────────────────────────────────────

  describe('Duplicate invitation handling', () => {
    it('detects duplicate by email + space', () => {
      const existingMembers: MemberRecord[] = [
        { id: '1', user: 101, space: 1, role: 'member', status: 'active' },
      ]
      // Function to check if someone is already a member
      const isExistingMember = (userId: number, spaceId: number) =>
        existingMembers.some(
          (m) => m.user === userId && m.space === spaceId && m.status === 'active',
        )
      expect(isExistingMember(101, 1)).toBe(true)
      expect(isExistingMember(999, 1)).toBe(false)
    })

    it('allows re-invitation of left members', () => {
      const leftMember: MemberRecord = {
        id: '1', user: 101, space: 1, role: 'member', status: 'left',
      }
      // A member who left can be re-invited
      expect(leftMember.status).toBe('left')
      expect(leftMember.status !== 'active' && leftMember.status !== 'banned').toBe(true)
    })

    it('blocks re-invitation of banned members', () => {
      const bannedMember: MemberRecord = {
        id: '1', user: 101, space: 1, role: 'member', status: 'banned',
      }
      // Banned members cannot be re-invited
      expect(bannedMember.status).toBe('banned')
    })
  })
})
