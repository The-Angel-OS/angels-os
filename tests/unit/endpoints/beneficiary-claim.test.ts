/**
 * Beneficiary Claim Endpoint — Unit Tests
 *
 * POST /api/beneficiary/claim
 * Auth required. Validates claimToken and links user as verified beneficiary.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// logError lazy-imports @payload-config (boots Payload against a live DB) —
// unmocked, error-path tests hang to the 30s timeout instead of asserting.
vi.mock('@/utilities/logError', () => ({
  logError: vi.fn(async () => {}),
  logCaughtError: vi.fn(async () => {}),
}))

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))

import { beneficiaryClaimHandler } from '@/endpoints/beneficiary-claim'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_BENEFICIARY = {
  claimToken: 'valid-token-xyz',
  name: 'Alice Smith',
  role: 'Heir',
  verificationStatus: 'pending',
}

const DEFAULT_ENDEAVOR = {
  id: 77,
  name: 'Acme Foundation',
  beneficiaries: [DEFAULT_BENEFICIARY],
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makeReq(
  user: Record<string, unknown> | null = { id: 1 },
  body: Record<string, unknown> | null = { claimToken: 'valid-token-xyz' },
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = {
    find: vi.fn().mockResolvedValue({ docs: [DEFAULT_ENDEAVOR], totalDocs: 1 }),
    update: vi.fn().mockResolvedValue({}),
    ...payloadOverrides,
  }
  const nativeReq = new Request('http://localhost/api/beneficiary/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT_VALID_JSON{{{',
  })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('beneficiaryClaimHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
  })

  it('returns 401 when no user', async () => {
    const req = makeReq(null)
    const res = await beneficiaryClaimHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq({ id: 1 }, null)
    const res = await beneficiaryClaimHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when claimToken is missing', async () => {
    const req = makeReq({ id: 1 }, {})
    const res = await beneficiaryClaimHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/claimToken is required/i)
  })

  it('returns 404 when no endeavor has the claim token', async () => {
    const req = makeReq({ id: 1 }, { claimToken: 'no-such-token' }, {
      find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    })
    const res = await beneficiaryClaimHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toMatch(/invalid or expired claim token/i)
  })

  it('returns 409 when beneficiary is already verified', async () => {
    const req = makeReq({ id: 1 }, { claimToken: 'valid-token-xyz' }, {
      find: vi.fn().mockResolvedValue({
        docs: [{
          ...DEFAULT_ENDEAVOR,
          beneficiaries: [{ ...DEFAULT_BENEFICIARY, verificationStatus: 'verified' }],
        }],
        totalDocs: 1,
      }),
    })
    const res = await beneficiaryClaimHandler(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/already been verified/i)
  })

  it('returns 409 when beneficiary designation has been declined', async () => {
    const req = makeReq({ id: 1 }, { claimToken: 'valid-token-xyz' }, {
      find: vi.fn().mockResolvedValue({
        docs: [{
          ...DEFAULT_ENDEAVOR,
          beneficiaries: [{ ...DEFAULT_BENEFICIARY, verificationStatus: 'declined' }],
        }],
        totalDocs: 1,
      }),
    })
    const res = await beneficiaryClaimHandler(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/declined/i)
  })

  it('returns 200 with correct shape on successful claim', async () => {
    const req = makeReq()
    const res = await beneficiaryClaimHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.endeavorName).toBe('Acme Foundation')
    expect(body.beneficiaryName).toBe('Alice Smith')
    expect(body.role).toBe('Heir')
  })

  it('includes beneficiary name in welcome message', async () => {
    const req = makeReq()
    const res = await beneficiaryClaimHandler(req)
    const body = await res.json()
    expect(body.message).toMatch(/alice smith/i)
    expect(body.message).toMatch(/acme foundation/i)
  })

  it('calls payload.update with verified status and linkedUser', async () => {
    const updateMock = vi.fn().mockResolvedValue({})
    const req = makeReq({ id: 42 }, { claimToken: 'valid-token-xyz' }, { update: updateMock })
    await beneficiaryClaimHandler(req)
    expect(updateMock).toHaveBeenCalledOnce()
    const call = updateMock.mock.calls[0][0]
    expect(call.collection).toBe('endeavors')
    expect(call.id).toBe(77)
    const updated = call.data.beneficiaries[0]
    expect(updated.verificationStatus).toBe('verified')
    expect(updated.linkedUser).toBe(42)
    expect(updated.verifiedAt).toBeDefined()
  })

  it('returns 500 when payload.find throws', async () => {
    const req = makeReq({ id: 1 }, { claimToken: 'valid-token-xyz' }, {
      find: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    })
    const res = await beneficiaryClaimHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/failed to process claim/i)
  })
})
