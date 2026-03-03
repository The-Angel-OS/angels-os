/**
 * Federation Heartbeat Cron Endpoint — Unit Tests
 *
 * GET /api/federation/heartbeat-cron
 * CRON_SECRET auth. Outbound heartbeat to all known peers.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetOrCreateFederationKeyPair = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ publicKey: 'pub-key-hex', privateKey: 'priv-key-hex' }),
)
const mockGetActiveConstitution = vi.hoisted(() =>
  vi.fn().mockReturnValue({ version: '1.0.0', checksum: 'abc123' }),
)
const mockSendHeartbeat = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ acknowledged: true }),
)
const mockBuildCapacitySnapshot = vi.hoisted(() => vi.fn().mockReturnValue({}))
const mockGetCachedGovernance = vi.hoisted(() => vi.fn().mockReturnValue(null))
const mockSetCachedGovernanceWithPersist = vi.hoisted(() => vi.fn())
const mockBuildGovernanceSnapshot = vi.hoisted(() =>
  vi.fn().mockReturnValue({ registryVersion: 1 }),
)

vi.mock('@/federation/keyStore', () => ({
  getOrCreateFederationKeyPair: mockGetOrCreateFederationKeyPair,
}))
vi.mock('@/federation/constitution', () => ({ getActiveConstitution: mockGetActiveConstitution }))
vi.mock('@/utilities/federationClient', () => ({ sendHeartbeat: mockSendHeartbeat }))
vi.mock('@/utilities/workload-engine', () => ({ buildCapacitySnapshot: mockBuildCapacitySnapshot }))
vi.mock('@/endpoints/federation-governance-sync', () => ({
  getCachedGovernance: mockGetCachedGovernance,
  setCachedGovernanceWithPersist: mockSetCachedGovernanceWithPersist,
}))
vi.mock('@/utilities/federationEngine', () => ({
  MAX_HEARTBEAT_AGE_SECONDS: 300,
  buildGovernanceSnapshot: mockBuildGovernanceSnapshot,
  buildFederationMesh: vi.fn().mockReturnValue({}),
  getSentinels: vi.fn().mockReturnValue([]),
  electCoordinator: vi.fn().mockReturnValue(null),
}))

import { federationHeartbeatCronHandler } from '@/endpoints/federation-heartbeat-cron'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_TENANT = {
  id: 1,
  name: 'Angel OS Clearwater',
  domain: 'clearwater.spacesangels.com',
  setup: { federationId: 'fed-clearwater-001' },
}

const PEER_WITH_DOMAIN = {
  id: 10,
  name: 'peer.spacesangels.com', // name is used as domain
  createdAt: new Date().toISOString(),
  federation: {
    federationId: 'fed-peer-001',
    lastPingAt: new Date(Date.now() - 60 * 1000).toISOString(),
  },
}

const PEER_NO_DOMAIN = {
  id: 11,
  name: 'Unknown Peer',
  createdAt: new Date().toISOString(),
  federation: {}, // no federationId → peerDomain undefined
}

// ── Helper ────────────────────────────────────────────────────────────────────

const originalEnv = process.env

function makePayload(overrides: Record<string, unknown> = {}) {
  const findMock = vi.fn().mockImplementation(({ collection }: any) => {
    if (collection === 'tenants') return Promise.resolve({ docs: [DEFAULT_TENANT], totalDocs: 1 })
    if (collection === 'endeavors') return Promise.resolve({ docs: [PEER_WITH_DOMAIN], totalDocs: 1 })
    return Promise.resolve({ docs: [], totalDocs: 0 })
  })
  return { find: findMock, ...overrides }
}

function makeReq(
  headers: Record<string, string> = {},
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request('http://localhost/api/federation/heartbeat-cron', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...headers },
  })
  return Object.assign(nativeReq, { payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('federationHeartbeatCronHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env = { ...originalEnv }
    mockGetActiveConstitution.mockReturnValue({ version: '1.0.0', checksum: 'abc123' })
    mockGetOrCreateFederationKeyPair.mockResolvedValue({ publicKey: 'pub-key-hex', privateKey: 'priv-key-hex' })
    mockSendHeartbeat.mockResolvedValue({ acknowledged: true })
    mockBuildCapacitySnapshot.mockReturnValue({})
    mockBuildGovernanceSnapshot.mockReturnValue({ registryVersion: 1 })
    mockGetCachedGovernance.mockReturnValue(null)
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('returns 401 when CRON_SECRET is set but auth header is wrong', async () => {
    process.env.CRON_SECRET = 'my-secret'
    const req = makeReq({ Authorization: 'Bearer wrong-secret' })
    const res = await federationHeartbeatCronHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/unauthorized/i)
  })

  it('proceeds when CRON_SECRET is set and auth header is correct', async () => {
    process.env.CRON_SECRET = 'my-secret'
    const req = makeReq({ Authorization: 'Bearer my-secret' })
    const res = await federationHeartbeatCronHandler(req)
    expect(res.status).toBe(200)
  })

  it('skips auth when CRON_SECRET is not set', async () => {
    delete process.env.CRON_SECRET
    const req = makeReq() // no auth header
    const res = await federationHeartbeatCronHandler(req)
    expect(res.status).toBe(200)
  })

  it('returns error when no tenant is configured', async () => {
    const req = makeReq({}, {
      find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    })
    const res = await federationHeartbeatCronHandler(req)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/no tenant/i)
  })

  it('returns not-federated message when tenant has no federationId', async () => {
    const req = makeReq({}, {
      find: vi.fn().mockResolvedValue({
        docs: [{ id: 1, name: 'Tenant', setup: {} }], // no federationId
        totalDocs: 1,
      }),
    })
    const res = await federationHeartbeatCronHandler(req)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.message).toMatch(/not yet federated/i)
    expect(body.peersContacted).toBe(0)
  })

  it('returns no-peers message when no peers found', async () => {
    const req = makeReq({}, {
      find: vi.fn().mockImplementation(({ collection }: any) => {
        if (collection === 'tenants') return Promise.resolve({ docs: [DEFAULT_TENANT], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 }) // no peers
      }),
    })
    const res = await federationHeartbeatCronHandler(req)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.message).toMatch(/no federation peers/i)
    expect(body.peersContacted).toBe(0)
  })

  it('calls sendHeartbeat for peers with known domains', async () => {
    const req = makeReq()
    await federationHeartbeatCronHandler(req)
    expect(mockSendHeartbeat).toHaveBeenCalledOnce()
    expect(mockSendHeartbeat).toHaveBeenCalledWith(
      'peer.spacesangels.com',
      expect.objectContaining({ federationId: 'fed-clearwater-001' }),
      expect.any(Object),
      expect.any(Object),
    )
  })

  it('marks peers without known domains as failed', async () => {
    const req = makeReq({}, {
      find: vi.fn().mockImplementation(({ collection }: any) => {
        if (collection === 'tenants') return Promise.resolve({ docs: [DEFAULT_TENANT], totalDocs: 1 })
        if (collection === 'endeavors') return Promise.resolve({ docs: [PEER_NO_DOMAIN], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await federationHeartbeatCronHandler(req)
    const body = await res.json()
    expect(body.results[0].success).toBe(false)
    expect(body.results[0].error).toMatch(/no domain/i)
    expect(mockSendHeartbeat).not.toHaveBeenCalled()
  })

  it('returns 200 with results, governance, and duration', async () => {
    const req = makeReq()
    const res = await federationHeartbeatCronHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.peersContacted).toBeGreaterThanOrEqual(0)
    expect(body.governance).toMatchObject({ synced: true, version: 1 })
    expect(typeof body.duration).toBe('number')
  })

  it('returns 500 on unexpected error', async () => {
    const req = makeReq({}, {
      find: vi.fn().mockRejectedValue(new Error('DB failure')),
    })
    const res = await federationHeartbeatCronHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toBeDefined()
  })
})
