/**
 * Federation Pulse Endpoint — Unit Tests
 *
 * GET /api/federation/pulse
 * Auth required. Returns live vital signs of the federation organism.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))

import { federationPulseHandler } from '@/endpoints/federation-pulse'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString()

// Healthy node: lastPingAt within 5 minutes
const HEALTHY_NODE = {
  id: 1,
  name: 'Healthy Peer',
  federation: {
    federationId: 'fed-001',
    lastPingAt: new Date(Date.now() - 60 * 1000).toISOString(), // 60s ago
    capacitySnapshot: { maxConcurrent: 5, activeWorkUnits: 2 },
  },
}

// Stale node: lastPingAt > 5 minutes ago
const STALE_NODE = {
  id: 2,
  name: 'Stale Peer',
  federation: {
    federationId: 'fed-002',
    lastPingAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10min ago
  },
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  const findMock = vi.fn().mockImplementation(({ collection }: any) => {
    if (collection === 'endeavors')
      return Promise.resolve({ docs: [HEALTHY_NODE], totalDocs: 1 })
    if (collection === 'pheromones')
      return Promise.resolve({
        docs: [{ id: 1, strength: 70, path: 'clearwater → miami' }],
        totalDocs: 1,
      })
    // work-units and quest-participations
    return Promise.resolve({ docs: [], totalDocs: 5 })
  })
  return { find: findMock, ...overrides }
}

function makeReq(
  user: Record<string, unknown> | null = { id: 1, roles: ['admin'] },
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request('http://localhost/api/federation/pulse', {
    method: 'GET',
  })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('federationPulseHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
  })

  it('returns 401 when no user', async () => {
    const req = makeReq(null)
    const res = await federationPulseHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns rate limit response when rate limited', async () => {
    mockApplyRateLimit.mockReturnValue(
      Response.json({ error: 'Rate limit exceeded' }, { status: 429 }),
    )
    const req = makeReq()
    const res = await federationPulseHandler(req)
    expect(res.status).toBe(429)
  })

  it('returns 200 with correct top-level shape', async () => {
    const req = makeReq()
    const res = await federationPulseHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('timestamp')
    expect(body).toHaveProperty('pulse')
    expect(body).toHaveProperty('nodes')
    expect(body).toHaveProperty('workUnits')
    expect(body).toHaveProperty('quests')
    expect(body).toHaveProperty('pheromones')
    expect(body).toHaveProperty('capacity')
  })

  it('pulse.alive is true when healthy nodes exist', async () => {
    const req = makeReq()
    const res = await federationPulseHandler(req)
    const body = await res.json()
    expect(body.pulse.alive).toBe(true)
    expect(body.nodes.healthy).toBeGreaterThan(0)
  })

  it('pulse.alive is false when no healthy nodes', async () => {
    const req = makeReq({ id: 1 }, {
      find: vi.fn().mockImplementation(({ collection }: any) => {
        if (collection === 'endeavors')
          return Promise.resolve({ docs: [STALE_NODE], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
    })
    const res = await federationPulseHandler(req)
    const body = await res.json()
    expect(body.pulse.alive).toBe(false)
    expect(body.nodes.healthy).toBe(0)
  })

  it('includes pheromone stats when active trails exist', async () => {
    const req = makeReq()
    const res = await federationPulseHandler(req)
    const body = await res.json()
    expect(body.pheromones.activeTrails).toBe(1)
    expect(body.pheromones.avgStrength).toBe(70)
    expect(body.pheromones.strongestPath).toBe('clearwater → miami')
  })

  it('returns 500 on payload.find error', async () => {
    const req = makeReq({ id: 1 }, {
      find: vi.fn().mockRejectedValue(new Error('DB failure')),
    })
    const res = await federationPulseHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toBeDefined()
  })
})
