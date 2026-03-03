/**
 * Federation Heartbeat Endpoint — Unit Tests
 *
 * POST /api/federation/heartbeat
 * No user auth. Validates Ed25519 signature from federation peers.
 * Updates or creates endeavor records; returns our health status.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockVerifySignature = vi.hoisted(() => vi.fn().mockReturnValue(true))
const mockIsHeartbeatHealthy = vi.hoisted(() => vi.fn().mockReturnValue(true))
const mockGetActiveConstitution = vi.hoisted(() =>
  vi.fn().mockReturnValue({ version: '1.0.0' }),
)

vi.mock('@/federation/protocol', () => ({ verifySignature: mockVerifySignature }))
vi.mock('@/utilities/federationEngine', () => ({ isHeartbeatHealthy: mockIsHeartbeatHealthy }))
vi.mock('@/federation/constitution', () => ({ getActiveConstitution: mockGetActiveConstitution }))

import { federationHeartbeatHandler } from '@/endpoints/federation-heartbeat'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SENDER_FED_ID = 'fed-peer-abc-123'

const VALID_BODY = {
  federationId: SENDER_FED_ID,
  domain: 'peer.spacesangels.com',
  name: 'Peer Enterprise',
  status: 'healthy',
  capabilities: ['products', 'bookings'],
  catalogEntryCount: 42,
}

const DEFAULT_TENANT = {
  id: 99,
  name: 'Our Enterprise',
  setup: { federationId: 'our-fed-id' },
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  const findMock = vi.fn().mockImplementation(({ collection, where }: any) => {
    if (collection === 'endeavors' && where?.['federation.federationId']) {
      return Promise.resolve({ docs: [{ id: 1 }], totalDocs: 1 })
    }
    if (collection === 'tenants') {
      return Promise.resolve({ docs: [DEFAULT_TENANT], totalDocs: 1 })
    }
    return Promise.resolve({ docs: [], totalDocs: 0 })
  })
  return {
    find: findMock,
    update: vi.fn().mockResolvedValue({}),
    create: vi.fn().mockResolvedValue({ id: 100 }),
    ...overrides,
  }
}

function makeReq(
  headerOverrides: Record<string, string> = {},
  body: Record<string, unknown> | null = VALID_BODY,
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const now = new Date().toISOString()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Federation-Id': SENDER_FED_ID,
    'X-Federation-Signature': 'valid-sig-hex',
    'X-Federation-Key': 'public-key-hex',
    'X-Federation-Timestamp': now,
    ...headerOverrides,
  }
  const nativeReq = new Request('http://localhost/api/federation/heartbeat', {
    method: 'POST',
    headers,
    body: body !== null ? JSON.stringify(body) : 'NOT_VALID_JSON{{{',
  })
  return Object.assign(nativeReq, { payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('federationHeartbeatHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockVerifySignature.mockReturnValue(true)
    mockIsHeartbeatHealthy.mockReturnValue(true)
    mockGetActiveConstitution.mockReturnValue({ version: '1.0.0' })
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq({}, null)
    const res = await federationHeartbeatHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.acknowledged).toBe(false)
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 401 when federation auth headers are missing', async () => {
    // Build a request with NO federation headers
    const payload = makePayload()
    const nativeReq = new Request('http://localhost/api/federation/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    })
    const req = Object.assign(nativeReq, { payload }) as any
    const res = await federationHeartbeatHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.acknowledged).toBe(false)
    expect(body.error).toMatch(/missing federation auth headers/i)
  })

  it('returns 401 when timestamp is expired', async () => {
    const expired = new Date(Date.now() - 6 * 60 * 1000).toISOString() // 6 min ago
    const req = makeReq({ 'X-Federation-Timestamp': expired })
    const res = await federationHeartbeatHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.acknowledged).toBe(false)
    expect(body.error).toMatch(/timestamp expired/i)
  })

  it('returns 403 when signature is invalid', async () => {
    mockVerifySignature.mockReturnValue(false)
    const req = makeReq()
    const res = await federationHeartbeatHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.acknowledged).toBe(false)
    expect(body.error).toMatch(/invalid signature/i)
  })

  it('returns 400 when body federationId is missing', async () => {
    const req = makeReq({}, { ...VALID_BODY, federationId: undefined })
    const res = await federationHeartbeatHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.acknowledged).toBe(false)
    expect(body.error).toMatch(/missing federationId/i)
  })

  it('returns 400 when header federationId does not match body', async () => {
    // Header says 'different-id', body says SENDER_FED_ID
    const req = makeReq({ 'X-Federation-Id': 'different-id' }, VALID_BODY)
    const res = await federationHeartbeatHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.acknowledged).toBe(false)
    expect(body.error).toMatch(/mismatch/i)
  })

  it('updates existing endeavor for known peer', async () => {
    const updateMock = vi.fn().mockResolvedValue({})
    const req = makeReq({}, VALID_BODY, { update: updateMock })
    const res = await federationHeartbeatHandler(req)
    expect(res.status).toBe(200)
    expect(updateMock).toHaveBeenCalledOnce()
  })

  it('creates new endeavor for unknown peer', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 200 })
    const req = makeReq({}, VALID_BODY, {
      find: vi.fn().mockImplementation(({ collection }: any) => {
        if (collection === 'tenants')
          return Promise.resolve({ docs: [DEFAULT_TENANT], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 }) // no endeavors found
      }),
      create: createMock,
    })
    const res = await federationHeartbeatHandler(req)
    expect(res.status).toBe(200)
    expect(createMock).toHaveBeenCalledOnce()
  })

  it('returns 200 with correct response shape', async () => {
    const req = makeReq()
    const res = await federationHeartbeatHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.acknowledged).toBe(true)
    expect(body.theirFederationId).toBe('our-fed-id')
    expect(body.constitutionVersion).toBe('1.0.0')
    expect(body.message).toMatch(/peer enterprise/i)
  })

  it('heartbeat recording failure is non-fatal — still returns 200', async () => {
    // update throws inside the non-fatal try/catch block
    const req = makeReq({}, VALID_BODY, {
      update: vi.fn().mockRejectedValue(new Error('DB connection lost')),
    })
    const res = await federationHeartbeatHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.acknowledged).toBe(true)
  })
})
