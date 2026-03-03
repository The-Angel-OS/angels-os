import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockSendInvitationEmail = vi.hoisted(() => vi.fn())
const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))
const mockGetServerSideURL = vi.hoisted(() => vi.fn().mockReturnValue('https://app.example.com'))
const mockCalculateExpiration = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/sendInvitationEmail', () => ({
  sendInvitationEmail: mockSendInvitationEmail,
}))
vi.mock('@/utilities/apiRateLimiter', () => ({
  applyRateLimit: mockApplyRateLimit,
}))
vi.mock('@/utilities/getURL', () => ({
  getServerSideURL: mockGetServerSideURL,
}))
vi.mock('@/utilities/invitationSystem', () => ({
  DEFAULT_EXPIRY_DAYS: 7,
  calculateExpiration: mockCalculateExpiration,
  createInvitation: vi.fn(),
  isValidEmail: vi.fn().mockReturnValue(true),
  acceptInvitation: vi.fn(),
}))

import { inviteResendHandler } from '@/endpoints/invite-resend'

// ── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_EXPIRY = new Date('2025-12-31T00:00:00Z')

const DEFAULT_MEMBERSHIP = {
  id: 200,
  status: 'pending',
  role: 'member',
  space: { id: 50, name: 'Dev Space', tenant: { id: 10 } },
  invitationDetails: {
    invitationToken: 'tok-abc',
    invitationEmail: 'newuser@example.com',
    invitationExpiresAt: '2025-06-01T00:00:00Z',
  },
}

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    findByID: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
      if (collection === 'space-memberships') return Promise.resolve(DEFAULT_MEMBERSHIP)
      if (collection === 'users') return Promise.resolve({ id: 10, name: 'Alice' })
      if (collection === 'tenants') return Promise.resolve({ id: 10, name: 'Acme Corp' })
      return Promise.resolve({ id: 1 })
    }),
    find: vi.fn().mockResolvedValue({ docs: [{ role: 'space_admin' }] }),
    update: vi.fn().mockResolvedValue({}),
    logger: { error: vi.fn() },
    ...overrides,
  }
}

function makeReq(
  body: Record<string, unknown> | null,
  user: Record<string, unknown> | null = { id: 10 },
  payloadOverrides: Record<string, unknown> = {},
) {
  const nativeReq = new Request('http://localhost/api/spaces/invite/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT_VALID_JSON{{{',
  })
  return Object.assign(nativeReq, { user, payload: makePayload(payloadOverrides) }) as any
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('inviteResendHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
    mockSendInvitationEmail.mockResolvedValue(true)
    mockGetServerSideURL.mockReturnValue('https://app.example.com')
    mockCalculateExpiration.mockReturnValue(MOCK_EXPIRY)
  })

  it('returns 401 when no user is authenticated', async () => {
    const req = makeReq({ membershipId: 200 }, null)
    const res = await inviteResendHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq(null)
    const res = await inviteResendHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when membershipId is missing', async () => {
    const req = makeReq({})
    const res = await inviteResendHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/membershipId is required/i)
  })

  it('returns 400 when membership status is not pending', async () => {
    const req = makeReq(
      { membershipId: 200 },
      { id: 10 },
      {
        findByID: vi.fn().mockResolvedValue({ ...DEFAULT_MEMBERSHIP, status: 'active' }),
        find: vi.fn().mockResolvedValue({ docs: [{ role: 'space_admin' }] }),
        update: vi.fn().mockResolvedValue({}),
        logger: { error: vi.fn() },
      },
    )
    const res = await inviteResendHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/only pending/i)
  })

  it('returns 400 when membership has no invitation token', async () => {
    const noTokenMembership = {
      ...DEFAULT_MEMBERSHIP,
      invitationDetails: { invitationEmail: 'x@x.com' },
    }
    const req = makeReq(
      { membershipId: 200 },
      { id: 10 },
      {
        findByID: vi.fn().mockResolvedValue(noTokenMembership),
        find: vi.fn().mockResolvedValue({ docs: [{ role: 'space_admin' }] }),
        update: vi.fn().mockResolvedValue({}),
        logger: { error: vi.fn() },
      },
    )
    const res = await inviteResendHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/no invitation token/i)
  })

  it('returns 403 when requester is not admin or moderator', async () => {
    const req = makeReq(
      { membershipId: 200 },
      { id: 10 },
      {
        findByID: vi.fn().mockResolvedValue(DEFAULT_MEMBERSHIP),
        find: vi.fn().mockResolvedValue({ docs: [] }),
        update: vi.fn().mockResolvedValue({}),
        logger: { error: vi.fn() },
      },
    )
    const res = await inviteResendHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toMatch(/admin or moderator/i)
  })

  it('returns 400 when there is no email address on the invitation', async () => {
    const noEmailMembership = {
      ...DEFAULT_MEMBERSHIP,
      invitationDetails: { invitationToken: 'tok-abc' },
    }
    const req = makeReq(
      { membershipId: 200 },
      { id: 10 },
      {
        findByID: vi.fn().mockResolvedValue(noEmailMembership),
        find: vi.fn().mockResolvedValue({ docs: [{ role: 'space_admin' }] }),
        update: vi.fn().mockResolvedValue({}),
        logger: { error: vi.fn() },
      },
    )
    const res = await inviteResendHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/no email address/i)
  })

  it('returns 200 with success and newExpiresAt on success', async () => {
    const req = makeReq({ membershipId: 200 })
    const res = await inviteResendHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.newExpiresAt).toBe(MOCK_EXPIRY.toISOString())
  })

  it('returns 200 with emailSent=true when sendInvitationEmail resolves true', async () => {
    const req = makeReq({ membershipId: 200 })
    const res = await inviteResendHandler(req)
    const body = await res.json()
    expect(body.emailSent).toBe(true)
  })

  it('calls payload.update to extend expiry on the membership', async () => {
    const updateMock = vi.fn().mockResolvedValue({})
    const req = makeReq(
      { membershipId: 200 },
      { id: 10 },
      {
        findByID: vi.fn().mockResolvedValue(DEFAULT_MEMBERSHIP),
        find: vi.fn().mockResolvedValue({ docs: [{ role: 'space_admin' }] }),
        update: updateMock,
        logger: { error: vi.fn() },
      },
    )
    await inviteResendHandler(req)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'space-memberships',
        id: 200,
      }),
    )
  })

  it('calls sendInvitationEmail with the correct invite URL containing the token', async () => {
    const req = makeReq({ membershipId: 200 })
    await inviteResendHandler(req)
    expect(mockSendInvitationEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'newuser@example.com',
        inviteUrl: expect.stringContaining('tok-abc'),
      }),
    )
  })
})
