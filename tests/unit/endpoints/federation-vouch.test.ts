/**
 * Federation Vouch Endpoint — Unit Tests
 *
 * POST /api/federation/vouch
 * No user auth. Validates federation signature (minimumTrust: 'full').
 * Records vouch; may auto-promote target to active membership.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockVerifyFederationRequest = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ verified: true, reason: 'ok' }),
)
const mockCreatePeerLookup = vi.hoisted(() => vi.fn().mockReturnValue(() => null))
const mockLogFromVerification = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockValidateVouch = vi.hoisted(() => vi.fn().mockReturnValue({ valid: true }))
const mockCanPromoteToActive = vi.hoisted(() =>
  vi.fn().mockReturnValue({ canPromote: false, reason: 'Awaiting more vouches' }),
)

vi.mock('@/federation/trustGuard', () => ({
  verifyFederationRequest: mockVerifyFederationRequest,
  createPeerLookup: mockCreatePeerLookup,
}))
vi.mock('@/federation/auditLog', () => ({ logFromVerification: mockLogFromVerification }))
vi.mock('@/utilities/federationEngine', () => ({
  validateVouch: mockValidateVouch,
  canPromoteToActive: mockCanPromoteToActive,
}))

import { federationVouchHandler } from '@/endpoints/federation-vouch'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_BODY = {
  voucherFederationId: 'fed-voucher-123',
  voucherDomain: 'voucher.spacesangels.com',
  voucherName: 'Voucher Enterprise',
  targetFederationId: 'fed-target-456',
  reason: 'Trusted partner with verified track record',
}

const DEFAULT_TARGET_ENDEAVOR = {
  id: 10,
  name: 'Target Enterprise',
  federation: {
    federationId: 'fed-target-456',
    ministryStatus: 'probation',
    constitutionVersion: '1.1',
  },
  vouchesReceived: [],
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockImplementation(({ collection }: any) => {
      if (collection === 'endeavors')
        return Promise.resolve({ docs: [DEFAULT_TARGET_ENDEAVOR], totalDocs: 1 })
      return Promise.resolve({ docs: [], totalDocs: 0 })
    }),
    update: vi.fn().mockResolvedValue({}),
    ...overrides,
  }
}

function makeReq(
  body: Record<string, unknown> | null = VALID_BODY,
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request('http://localhost/api/federation/vouch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Federation-Id': 'fed-voucher-123',
      'X-Federation-Signature': 'valid-sig',
      'X-Federation-Key': 'public-key',
      'X-Federation-Timestamp': new Date().toISOString(),
    },
    body: body !== null ? JSON.stringify(body) : 'NOT_VALID_JSON{{{',
  })
  return Object.assign(nativeReq, { payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('federationVouchHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifyFederationRequest.mockResolvedValue({ verified: true, reason: 'ok' })
    mockValidateVouch.mockReturnValue({ valid: true })
    mockCanPromoteToActive.mockReturnValue({ canPromote: false, reason: 'Awaiting more vouches' })
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq(null)
    const res = await federationVouchHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.accepted).toBe(false)
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when required fields are missing', async () => {
    const req = makeReq({ voucherFederationId: 'fed-xyz' }) // missing targetFederationId + reason
    const res = await federationVouchHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.accepted).toBe(false)
    expect(body.error).toMatch(/missing required fields/i)
  })

  it('returns 403 when federation verification fails', async () => {
    mockVerifyFederationRequest.mockResolvedValue({ verified: false, reason: 'Peer not trusted' })
    const req = makeReq()
    const res = await federationVouchHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.accepted).toBe(false)
  })

  it('returns 429 when verification fails due to rate limit', async () => {
    mockVerifyFederationRequest.mockResolvedValue({ verified: false, reason: 'Rate limit exceeded' })
    const req = makeReq()
    const res = await federationVouchHandler(req)
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.accepted).toBe(false)
  })

  it('returns 404 when target endeavor is not found', async () => {
    const req = makeReq(VALID_BODY, {
      find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    })
    const res = await federationVouchHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.accepted).toBe(false)
    expect(body.error).toMatch(/not found/i)
  })

  it('returns 400 when validateVouch rejects the vouch', async () => {
    mockValidateVouch.mockReturnValue({ valid: false, reason: 'Already vouched for this enterprise' })
    const req = makeReq()
    const res = await federationVouchHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.accepted).toBe(false)
    expect(body.error).toMatch(/already vouched/i)
  })

  it('records vouch and returns accepted:true when not yet eligible for promotion', async () => {
    const updateMock = vi.fn().mockResolvedValue({})
    const req = makeReq(VALID_BODY, { update: updateMock })
    const res = await federationVouchHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.accepted).toBe(true)
    expect(body.promoted).toBe(false)
    expect(body.vouchCount).toBe(1)
    expect(updateMock).toHaveBeenCalledOnce()
  })

  it('auto-promotes and calls update twice when canPromoteToActive returns true', async () => {
    mockCanPromoteToActive.mockReturnValue({ canPromote: true })
    const updateMock = vi.fn().mockResolvedValue({})
    const req = makeReq(VALID_BODY, { update: updateMock })
    const res = await federationVouchHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.accepted).toBe(true)
    expect(body.promoted).toBe(true)
    expect(updateMock).toHaveBeenCalledTimes(2)
  })

  it('returns 200 with correct response shape', async () => {
    const req = makeReq()
    const res = await federationVouchHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('accepted')
    expect(body).toHaveProperty('promoted')
    expect(body).toHaveProperty('message')
    expect(body).toHaveProperty('vouchCount')
  })

  it('returns 500 on unexpected error', async () => {
    const req = makeReq(VALID_BODY, {
      find: vi.fn().mockRejectedValue(new Error('DB failure')),
    })
    const res = await federationVouchHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.accepted).toBe(false)
    expect(body.error).toMatch(/internal error/i)
  })
})
