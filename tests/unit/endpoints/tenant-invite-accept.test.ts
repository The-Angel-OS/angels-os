/**
 * Tenant Invite Accept Endpoint — Unit Tests
 *
 * POST /api/tenant-invite/accept
 * Body: { token: string }
 * Auth required. Validates invitation token, activates membership, auto-joins space.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { tenantInviteAcceptHandler } from '@/endpoints/tenant-invite-accept'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

const DEFAULT_MEMBERSHIP = {
  id: 55,
  status: 'pending',
  role: 'member',
  tenant: { id: 10, name: 'Acme Corp' },
  invitationDetails: {
    invitationToken: 'valid-token-abc',
    invitationExpiresAt: FUTURE_DATE,
    invitationEmail: 'alice@example.com',
  },
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makeReq(
  user: Record<string, unknown> | null = { id: 1, email: 'alice@example.com' },
  body: Record<string, unknown> | null = { token: 'valid-token-abc' },
  payloadOverrides: Record<string, unknown> = {},
) {
  const findMock = vi.fn().mockImplementation(({ collection }: { collection: string }) => {
    if (collection === 'tenant-memberships')
      return Promise.resolve({ docs: [DEFAULT_MEMBERSHIP], totalDocs: 1 })
    if (collection === 'contacts')
      return Promise.resolve({ docs: [], totalDocs: 0 })
    if (collection === 'spaces')
      return Promise.resolve({ docs: [{ id: 99, name: 'Main Space' }], totalDocs: 1 })
    if (collection === 'space-memberships')
      return Promise.resolve({ docs: [], totalDocs: 0 })
    return Promise.resolve({ docs: [], totalDocs: 0 })
  })

  const payload = {
    find: findMock,
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({ id: 200 }),
    logger: { info: vi.fn() },
    ...payloadOverrides,
  }

  const nativeReq = new Request('http://localhost/api/tenant-invite/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT_VALID_JSON{{{',
  })

  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('tenantInviteAcceptHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no user', async () => {
    const req = makeReq(null)
    const res = await tenantInviteAcceptHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/must be logged in/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq({ id: 1 }, null)
    const res = await tenantInviteAcceptHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid request body/i)
  })

  it('returns 400 when token is missing', async () => {
    const req = makeReq({ id: 1 }, {})
    const res = await tenantInviteAcceptHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/token is required/i)
  })

  it('returns 404 when token not found', async () => {
    const req = makeReq({ id: 1 }, { token: 'no-such-token' }, {
      find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    })
    const res = await tenantInviteAcceptHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/invitation not found/i)
  })

  it('returns 409 when membership is already active', async () => {
    const req = makeReq({ id: 1 }, { token: 'valid-token-abc' }, {
      find: vi.fn().mockResolvedValue({
        docs: [{ ...DEFAULT_MEMBERSHIP, status: 'active' }],
        totalDocs: 1,
      }),
    })
    const res = await tenantInviteAcceptHandler(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/already been accepted/i)
  })

  it('returns 410 when membership has non-pending, non-active status', async () => {
    const req = makeReq({ id: 1 }, { token: 'valid-token-abc' }, {
      find: vi.fn().mockResolvedValue({
        docs: [{ ...DEFAULT_MEMBERSHIP, status: 'revoked' }],
        totalDocs: 1,
      }),
    })
    const res = await tenantInviteAcceptHandler(req)
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.error).toMatch(/no longer valid/i)
  })

  it('returns 410 when invitation has expired', async () => {
    const pastDate = new Date(Date.now() - 1000).toISOString()
    const req = makeReq({ id: 1 }, { token: 'valid-token-abc' }, {
      find: vi.fn().mockResolvedValue({
        docs: [{
          ...DEFAULT_MEMBERSHIP,
          invitationDetails: { ...DEFAULT_MEMBERSHIP.invitationDetails, invitationExpiresAt: pastDate },
        }],
        totalDocs: 1,
      }),
    })
    const res = await tenantInviteAcceptHandler(req)
    expect(res.status).toBe(410)
    const body = await res.json()
    expect(body.error).toMatch(/expired/i)
  })

  it('returns 200 with correct membership shape on success', async () => {
    const req = makeReq()
    const res = await tenantInviteAcceptHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.membership.id).toBe(55)
    expect(body.membership.tenantId).toBe(10)
    expect(body.membership.tenantName).toBe('Acme Corp')
    expect(body.membership.role).toBe('member')
  })

  it('calls payload.update to activate membership with joinedAt', async () => {
    const updateMock = vi.fn().mockResolvedValue({})
    const req = makeReq({ id: 1 }, { token: 'valid-token-abc' }, {
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'tenant-memberships')
          return Promise.resolve({ docs: [DEFAULT_MEMBERSHIP], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
      update: updateMock,
    })
    const res = await tenantInviteAcceptHandler(req)
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenant-memberships',
        id: 55,
        data: expect.objectContaining({ status: 'active', user: 1 }),
      }),
    )
  })

  it('succeeds even when contact update throws (non-critical path)', async () => {
    let callCount = 0
    const req = makeReq({ id: 1, email: 'alice@example.com' }, { token: 'valid-token-abc' }, {
      find: vi.fn().mockImplementation(({ collection }: { collection: string }) => {
        if (collection === 'tenant-memberships')
          return Promise.resolve({ docs: [DEFAULT_MEMBERSHIP], totalDocs: 1 })
        if (collection === 'contacts') {
          callCount++
          return Promise.reject(new Error('Contact DB error'))
        }
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
      logger: { info: vi.fn() },
    })
    const res = await tenantInviteAcceptHandler(req)
    // Should still succeed despite contact lookup failure
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('returns 500 when payload.find throws at top level', async () => {
    const req = makeReq({ id: 1 }, { token: 'valid-token-abc' }, {
      find: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    })
    const res = await tenantInviteAcceptHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/DB connection lost/)
  })
})
