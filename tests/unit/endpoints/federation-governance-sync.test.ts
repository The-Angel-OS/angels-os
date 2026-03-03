/**
 * Federation Governance Sync Endpoint — Unit Tests
 *
 * GET  /api/federation/governance-sync — Serve governance snapshot to requesting node
 * POST /api/federation/governance-sync — Receive governance snapshot from peer
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockValidateGovernanceSync = vi.hoisted(() => vi.fn())
const mockGetActiveConstitution = vi.hoisted(() =>
  vi.fn().mockReturnValue({ version: '1.0.0', checksum: 'abc123' }),
)

vi.mock('@/utilities/federationEngine', () => ({
  validateGovernanceSync: mockValidateGovernanceSync,
}))
vi.mock('@/federation/constitution', () => ({
  getActiveConstitution: mockGetActiveConstitution,
}))

import {
  federationGovernanceSyncHandler,
  getCachedGovernance,
  setCachedGovernance,
} from '@/endpoints/federation-governance-sync'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FAKE_GOVERNANCE = {
  registryVersion: 5,
  ministries: [{ id: 'min-1', name: 'Peer Ministry', domain: 'peer.example.com', status: 'active' }],
  trustScores: { 'min-1': 90 },
  lastUpdated: '2025-01-15T00:00:00Z',
} as any

// ── Helper ────────────────────────────────────────────────────────────────────

function makeReq(method: string, body?: Record<string, unknown> | null) {
  const payload = {
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    update: vi.fn().mockResolvedValue({}),
  }
  const isBodyMethod = method !== 'GET'
  const nativeReq = new Request('http://localhost/api/federation/governance-sync', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(isBodyMethod && body !== undefined
      ? { body: body === null ? 'NOT_VALID_JSON{{{' : JSON.stringify(body) }
      : {}),
  })
  return Object.assign(nativeReq, { payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('federationGovernanceSyncHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetActiveConstitution.mockReturnValue({ version: '1.0.0', checksum: 'abc123' })
    mockValidateGovernanceSync.mockReturnValue({
      accepted: true,
      localVersion: 4,
      remoteVersion: 5,
    })
    // Reset in-memory cache to null for test isolation
    setCachedGovernance(null as any)
  })

  // ── GET ───────────────────────────────────────────────────────────────────

  it('GET returns 404 when governance cache is empty', async () => {
    const req = makeReq('GET')
    const res = await federationGovernanceSyncHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/no governance data/i)
  })

  it('GET returns 200 with cached governance data when populated', async () => {
    setCachedGovernance(FAKE_GOVERNANCE)
    const req = makeReq('GET')
    const res = await federationGovernanceSyncHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.governance.registryVersion).toBe(5)
    expect(body.governance.ministries).toHaveLength(1)
  })

  // ── POST ──────────────────────────────────────────────────────────────────

  it('POST returns 400 for invalid JSON', async () => {
    const req = makeReq('POST', null)
    const res = await federationGovernanceSyncHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/invalid json/i)
  })

  it('POST returns 400 when governance field is missing', async () => {
    const req = makeReq('POST', { otherField: 'value' })
    const res = await federationGovernanceSyncHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing or invalid governance data/i)
  })

  it('POST returns 400 when registryVersion is not a number', async () => {
    const req = makeReq('POST', { governance: { registryVersion: 'five', ministries: [] } })
    const res = await federationGovernanceSyncHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/missing or invalid governance data/i)
  })

  it('POST returns 409 when validateGovernanceSync rejects the update', async () => {
    mockValidateGovernanceSync.mockReturnValue({
      accepted: false,
      reason: 'Version conflict: remote v3 <= local v5',
      localVersion: 5,
      remoteVersion: 3,
    })
    const req = makeReq('POST', { governance: FAKE_GOVERNANCE })
    const res = await federationGovernanceSyncHandler(req)
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/version conflict/i)
    expect(body.localVersion).toBe(5)
    expect(body.remoteVersion).toBe(3)
  })

  it('POST returns 200 with version transition info when accepted', async () => {
    const req = makeReq('POST', { governance: FAKE_GOVERNANCE })
    const res = await federationGovernanceSyncHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.accepted).toBe(true)
    expect(body.previousVersion).toBe(4)
    expect(body.currentVersion).toBe(5)
    expect(body.message).toMatch(/v4.*v5/)
  })

  it('POST acceptance updates the in-memory governance cache', async () => {
    const req = makeReq('POST', { governance: FAKE_GOVERNANCE })
    await federationGovernanceSyncHandler(req)
    expect(getCachedGovernance()?.registryVersion).toBe(5)
  })

  // ── setCachedGovernance / getCachedGovernance ─────────────────────────────

  it('setCachedGovernance and getCachedGovernance round-trip', () => {
    setCachedGovernance(FAKE_GOVERNANCE)
    expect(getCachedGovernance()).toBe(FAKE_GOVERNANCE)
  })

  // ── Method not allowed ────────────────────────────────────────────────────

  it('returns 405 for unsupported HTTP methods', async () => {
    const req = makeReq('DELETE')
    const res = await federationGovernanceSyncHandler(req)
    expect(res.status).toBe(405)
    const body = await res.json()
    expect(body.error).toMatch(/method not allowed/i)
  })

  it('returns 405 for PATCH method', async () => {
    const req = makeReq('PATCH')
    const res = await federationGovernanceSyncHandler(req)
    expect(res.status).toBe(405)
  })
})
