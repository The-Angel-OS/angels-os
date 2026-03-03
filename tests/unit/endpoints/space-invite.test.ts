import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockCreateInvitation = vi.hoisted(() => vi.fn())
const mockIsValidEmail = vi.hoisted(() => vi.fn())
const mockSendInvitationEmail = vi.hoisted(() => vi.fn())
const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))

vi.mock('@/utilities/invitationSystem', () => ({
  createInvitation: mockCreateInvitation,
  isValidEmail: mockIsValidEmail,
}))
vi.mock('@/utilities/sendInvitationEmail', () => ({
  sendInvitationEmail: mockSendInvitationEmail,
}))
vi.mock('@/utilities/apiRateLimiter', () => ({
  applyRateLimit: mockApplyRateLimit,
}))

import { spaceInviteHandler } from '@/endpoints/space-invite'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(
  body: Record<string, unknown> | null,
  user: Record<string, unknown> | null = { id: 5 },
  payloadOverrides: Record<string, unknown> = {},
) {
  const nativeReq = new Request('http://localhost/api/spaces/1/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT VALID JSON{{{',
  })

  const payload = {
    find: vi.fn().mockResolvedValue({ docs: [{ role: 'space_admin' }] }),
    findByID: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'spaces') return Promise.resolve({ id: 1, name: 'Test Space', tenant: { id: 10 } })
      if (collection === 'users') return Promise.resolve({ id: 5, name: 'Alice' })
      if (collection === 'tenants') return Promise.resolve({ id: 10, name: 'Acme Corp' })
      return Promise.resolve(null)
    }),
    ...payloadOverrides,
  }

  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('spaceInviteHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsValidEmail.mockReturnValue(true)
    mockApplyRateLimit.mockReturnValue(null)
    mockCreateInvitation.mockResolvedValue({
      token: 'tok-123',
      expiresAt: '2025-12-31T00:00:00Z',
      inviteUrl: 'https://example.com/invite/tok-123',
    })
    mockSendInvitationEmail.mockResolvedValue(true)
  })

  it('returns 401 when no user is authenticated', async () => {
    const req = makeReq({ email: 'test@example.com', spaceId: 1 }, null)
    const res = await spaceInviteHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq(null)
    const res = await spaceInviteHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when email is invalid', async () => {
    mockIsValidEmail.mockReturnValue(false)
    const req = makeReq({ email: 'not-an-email', spaceId: 1 })
    const res = await spaceInviteHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/valid email address is required/i)
  })

  it('returns 400 when spaceId is missing', async () => {
    const req = makeReq({ email: 'user@example.com' })
    const res = await spaceInviteHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/spaceId is required/i)
  })

  it('returns 403 when requester is not admin or moderator', async () => {
    const req = makeReq(
      { email: 'user@example.com', spaceId: 1 },
      { id: 5 },
      { find: vi.fn().mockResolvedValue({ docs: [] }) },
    )
    const res = await spaceInviteHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/admin or moderator/i)
  })

  it('returns 200 on success with invitation token and inviteUrl', async () => {
    const req = makeReq({ email: 'newmember@example.com', spaceId: 1 })
    const res = await spaceInviteHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.invitation.token).toBe('tok-123')
    expect(body.invitation.inviteUrl).toBe('https://example.com/invite/tok-123')
    expect(body.invitation.expiresAt).toBe('2025-12-31T00:00:00Z')
  })

  it('returns 200 with emailSent=true when sendInvitationEmail resolves true', async () => {
    mockSendInvitationEmail.mockResolvedValue(true)
    const req = makeReq({ email: 'newmember@example.com', spaceId: 1 })
    const res = await spaceInviteHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.emailSent).toBe(true)
  })

  it('calls createInvitation with correct args (email, spaceId, userId, role)', async () => {
    const req = makeReq({ email: 'target@example.com', spaceId: 42, role: 'moderator' }, { id: 5 })
    await spaceInviteHandler(req)
    expect(mockCreateInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'target@example.com',
        spaceId: 42,
        invitedByUserId: 5,
        role: 'moderator',
      }),
    )
  })

  it('defaults role to member when not provided', async () => {
    const req = makeReq({ email: 'target@example.com', spaceId: 1 }, { id: 5 })
    await spaceInviteHandler(req)
    expect(mockCreateInvitation).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'member',
      }),
    )
  })

  it('returns 400 when createInvitation throws an Error', async () => {
    mockCreateInvitation.mockRejectedValueOnce(new Error('Invitation already pending for this email'))
    const req = makeReq({ email: 'duplicate@example.com', spaceId: 1 })
    const res = await spaceInviteHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invitation already pending/i)
  })
})
