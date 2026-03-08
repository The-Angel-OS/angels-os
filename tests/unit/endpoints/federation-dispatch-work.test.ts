/**
 * Federation Dispatch Work Endpoint — Unit Tests
 *
 * POST /api/federation/dispatch-work
 * Validates work unit, routes to best federation peer,
 * persists record, returns routing decision with workUnitId for polling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRouteWorkUnit = vi.hoisted(() => vi.fn())
const mockParseCapacitySnapshot = vi.hoisted(() => vi.fn().mockReturnValue(null))
const mockDetectBackpressure = vi.hoisted(() => vi.fn().mockReturnValue({ triggered: false }))
const mockShouldShed = vi.hoisted(() => vi.fn().mockReturnValue({ shed: false }))

vi.mock('@/utilities/workload-engine', () => ({
  routeWorkUnit: mockRouteWorkUnit,
  parseCapacitySnapshot: mockParseCapacitySnapshot,
  detectBackpressure: mockDetectBackpressure,
  shouldShed: mockShouldShed,
  DEFAULT_RETRY_POLICY: { maxRetries: 3, backoffMs: 1000, backoffMultiplier: 2 },
  DEFAULT_TIMEOUTS: { lightweight: 5000, standard: 30000, heavy: 120000 },
  WORK_TYPE_MIN_TRUST: {
    computation: 'probationary',
    analysis: 'probationary',
    generation: 'probationary',
    transformation: 'probationary',
    aggregation: 'probationary',
  },
}))

import { federationDispatchWorkHandler } from '@/endpoints/federation-dispatch-work'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_BODY = {
  type: 'computation',
  inputData: { query: 'test' },
}

const DEFAULT_ROUTING_DECISION = {
  localFallback: true,
  selectedWorker: null,
  alternates: [],
  backpressure: undefined,
  routingTimeMs: 5,
}

const DEFAULT_TENANT = {
  id: 1,
  setup: { federationId: 'our-fed-id' },
}

// ── Helper ────────────────────────────────────────────────────────────────────

const DEFAULT_USER = { id: 1, email: 'admin@test.com', roles: ['super_admin'] }

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockImplementation(({ collection }: any) => {
      if (collection === 'tenants')
        return Promise.resolve({ docs: [DEFAULT_TENANT], totalDocs: 1 })
      // endeavors, pheromones — no peers or hints by default
      return Promise.resolve({ docs: [], totalDocs: 0 })
    }),
    create: vi.fn().mockResolvedValue({ id: 999 }),
    auth: vi.fn().mockResolvedValue({ user: DEFAULT_USER }),
    ...overrides,
  }
}

function makeReq(
  body: Record<string, unknown> | null = VALID_BODY,
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request('http://localhost/api/federation/dispatch-work', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT_VALID_JSON{{{',
  })
  return Object.assign(nativeReq, { payload }) as any
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('federationDispatchWorkHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockRouteWorkUnit.mockReturnValue(DEFAULT_ROUTING_DECISION)
    mockParseCapacitySnapshot.mockReturnValue(null) // no valid peer snapshots by default
    mockShouldShed.mockReturnValue({ shed: false })
  })

  it('returns 401 when not authenticated', async () => {
    const req = makeReq(VALID_BODY, { auth: vi.fn().mockResolvedValue({ user: null }) })
    const res = await federationDispatchWorkHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/authentication required/i)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq(null)
    const res = await federationDispatchWorkHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when work type is invalid', async () => {
    const req = makeReq({ type: 'teleportation', inputData: {} })
    const res = await federationDispatchWorkHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/invalid work type/i)
  })

  it('returns 400 when type is missing', async () => {
    const req = makeReq({ inputData: { q: 'test' } })
    const res = await federationDispatchWorkHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/invalid work type/i)
  })

  it('returns 400 when inputData is missing', async () => {
    const req = makeReq({ type: 'computation' })
    const res = await federationDispatchWorkHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/inputData/i)
  })

  it('returns 400 when deadline is not a valid ISO date', async () => {
    const req = makeReq({ ...VALID_BODY, deadline: 'not-a-date' })
    const res = await federationDispatchWorkHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/deadline/i)
  })

  it('returns 400 when priority is invalid', async () => {
    const req = makeReq({ ...VALID_BODY, priority: 'turbo' })
    const res = await federationDispatchWorkHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/invalid priority/i)
  })

  it('returns 503 when backpressure triggers shedding', async () => {
    const backpressure = { triggered: true, reason: 'overloaded' }
    mockRouteWorkUnit.mockReturnValue({ ...DEFAULT_ROUTING_DECISION, backpressure })
    mockShouldShed.mockReturnValue({ shed: true, reason: 'Queue full' })
    const req = makeReq()
    const res = await federationDispatchWorkHandler(req)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/backpressure/i)
  })

  it('returns 500 when persisting work unit fails', async () => {
    const req = makeReq(VALID_BODY, {
      create: vi.fn().mockRejectedValue(new Error('DB write failed')),
    })
    const res = await federationDispatchWorkHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/failed to persist work unit/i)
  })

  it('returns 200 with local fallback when no workers available', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 100 })
    const req = makeReq(VALID_BODY, { create: createMock })
    const res = await federationDispatchWorkHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.routing.localFallback).toBe(true)
    expect(body.routing.selectedWorker).toBeNull()
    expect(createMock).toHaveBeenCalledOnce()
  })

  it('returns 200 with selectedWorker when routing succeeds', async () => {
    const selectedWorker = {
      worker: { nodeId: 'node-5', nodeName: 'Worker Node', domain: 'worker.example.com' },
      totalScore: 85.5,
      capabilityScore: 90,
      trustScore: 80,
      loadScore: 85,
      performanceScore: 88,
      costScore: 75,
      pheromoneBonus: 5,
    }
    mockRouteWorkUnit.mockReturnValue({
      localFallback: false,
      selectedWorker,
      alternates: [],
      backpressure: undefined,
      routingTimeMs: 12,
    })
    const req = makeReq()
    const res = await federationDispatchWorkHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.routing.localFallback).toBe(false)
    expect(body.routing.selectedWorker.nodeId).toBe('node-5')
    expect(body.routing.selectedWorker.nodeName).toBe('Worker Node')
    expect(body.routing.selectedWorker.totalScore).toBe(85.5)
  })

  it('includes workUnitId, recordId, and peersEvaluated in response', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 42 })
    const req = makeReq(VALID_BODY, { create: createMock })
    const res = await federationDispatchWorkHandler(req)
    const body = await res.json()
    expect(body.workUnitId).toMatch(/^WU-\d{8}-[A-Z0-9]{4}$/)
    expect(body.recordId).toBe(42)
    expect(typeof body.peersEvaluated).toBe('number')
    expect(typeof body.duration).toBe('number')
  })

  it('peer query failure is non-fatal — still returns 200', async () => {
    const req = makeReq(VALID_BODY, {
      find: vi.fn().mockImplementation(({ collection }: any) => {
        if (collection === 'tenants')
          return Promise.resolve({ docs: [DEFAULT_TENANT], totalDocs: 1 })
        if (collection === 'endeavors')
          return Promise.reject(new Error('DB failure'))
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
      create: vi.fn().mockResolvedValue({ id: 1 }),
    })
    const res = await federationDispatchWorkHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it('routeWorkUnit is called with constructed work unit fields', async () => {
    const req = makeReq({ ...VALID_BODY, priority: 'high', skillName: 'search_catalog' })
    await federationDispatchWorkHandler(req)
    expect(mockRouteWorkUnit).toHaveBeenCalledOnce()
    const [workUnit] = mockRouteWorkUnit.mock.calls[0]
    expect(workUnit.type).toBe('computation')
    expect(workUnit.priority).toBe('high')
    expect(workUnit.skillName).toBe('search_catalog')
    expect(workUnit.inputData).toEqual({ query: 'test' })
  })

  it('alternateCount reflects number of alternate workers', async () => {
    const alt = {
      worker: { nodeId: 'node-6', nodeName: 'Alt Node', domain: 'alt.example.com' },
      totalScore: 60,
      capabilityScore: 70,
      trustScore: 60,
      loadScore: 60,
      performanceScore: 60,
      costScore: 50,
      pheromoneBonus: 0,
    }
    mockRouteWorkUnit.mockReturnValue({
      ...DEFAULT_ROUTING_DECISION,
      alternates: [alt, alt],
    })
    const req = makeReq()
    const res = await federationDispatchWorkHandler(req)
    const body = await res.json()
    expect(body.routing.alternateCount).toBe(2)
  })
})
