import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockAcceptInvitation = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/invitationSystem', () => ({
  acceptInvitation: mockAcceptInvitation,
  createInvitation: vi.fn(),
  isValidEmail: vi.fn().mockReturnValue(true),
}))

import { inviteAcceptHandler } from '@/endpoints/invite-accept'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeReq(
  body: Record<string, unknown> | null,
  user: Record<string, unknown> | null = { id: 7 },
) {
  const nativeReq = new Request('http://localhost/api/invite/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT VALID JSON{{{',
  })
  return Object.assign(nativeReq, { user, payload: {} }) as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('inviteAcceptHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAcceptInvitation.mockResolvedValue({
      membershipId: 55,
      spaceId: 100,
      spaceName: 'Dev Angels',
      role: 'member',
    })
  })

  it('returns 401 when no user is authenticated', async () => {
    const req = makeReq({ token: 'abc' }, null)
    const res = await inviteAcceptHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq(null)
    const res = await inviteAcceptHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when token is missing', async () => {
    const req = makeReq({})
    const res = await inviteAcceptHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/token is required/i)
  })

  it('returns 400 when token is not a string', async () => {
    const req = makeReq({ token: 42 })
    const res = await inviteAcceptHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/token is required/i)
  })

  it('returns 400 when acceptInvitation throws', async () => {
    mockAcceptInvitation.mockRejectedValueOnce(new Error('Invitation expired or already used'))
    const req = makeReq({ token: 'expired-token' })
    const res = await inviteAcceptHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invitation expired/i)
  })

  it('returns 200 with membership details on success', async () => {
    const req = makeReq({ token: 'valid-invite-token' })
    const res = await inviteAcceptHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.membership.id).toBe(55)
    expect(body.membership.spaceId).toBe(100)
    expect(body.membership.spaceName).toBe('Dev Angels')
    expect(body.membership.role).toBe('member')
  })

  it('calls acceptInvitation with the token and user id', async () => {
    const req = makeReq({ token: 'the-token' }, { id: 99 })
    await inviteAcceptHandler(req)
    expect(mockAcceptInvitation).toHaveBeenCalledWith(
      expect.anything(), // payload
      'the-token',
      99,
    )
  })
})
