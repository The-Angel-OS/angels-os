/**
 * Federation Skills Endpoints — Unit Tests
 *
 * GET /api/federation/skills       — list available skills
 * POST /api/federation/skills/invoke — invoke a skill (requires trust)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetDefaultSkills = vi.hoisted(() => vi.fn())
const mockVerifyFederationRequest = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ verified: true, reason: 'ok', sourceFederationId: 'peer-001' }),
)
const mockCreatePeerLookup = vi.hoisted(() => vi.fn().mockReturnValue(() => null))
const mockLogFromVerification = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const mockRecordEarning = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))

vi.mock('@/federation/defaultSkills', () => ({ getDefaultSkills: mockGetDefaultSkills }))
vi.mock('@/federation/trustGuard', () => ({
  verifyFederationRequest: mockVerifyFederationRequest,
  createPeerLookup: mockCreatePeerLookup,
}))
vi.mock('@/federation/auditLog', () => ({ logFromVerification: mockLogFromVerification }))
vi.mock('@/utilities/agentWallet', () => ({ recordEarning: mockRecordEarning }))

import {
  federationSkillsListHandler,
  federationSkillsInvokeHandler,
} from '@/endpoints/federation-skills'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ENABLED_SKILL = {
  name: 'search_catalog',
  version: '1.0.0',
  description: 'Search the product catalog',
  enabled: true,
  costCents: 0,
  requiresTrust: 'vouched',
  category: 'catalog',
  rateLimit: { requests: 100, windowMs: 60000 },
  inputSchema: {
    type: 'object',
    properties: { q: { type: 'string' }, limit: { type: 'number' } },
    required: [],
  },
  outputSchema: { type: 'object' },
  safety: {
    canModifyUserData: false,
    sideEffects: [],
    disclosesAIOrigin: false,
    involvesHumanInteraction: false,
  },
}

const DISABLED_SKILL = {
  ...ENABLED_SKILL,
  name: 'admin_action',
  enabled: false,
}

// ── Helper ────────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockImplementation(({ collection }: any) => {
      if (collection === 'tenants') return Promise.resolve({ docs: [{ id: 1 }], totalDocs: 1 })
      if (collection === 'products') return Promise.resolve({ docs: [], totalDocs: 0 })
      return Promise.resolve({ docs: [], totalDocs: 0 })
    }),
    ...overrides,
  }
}

function makeReq(
  body: Record<string, unknown> | null = { skill: 'search_catalog', params: { q: 'shirt' } },
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const nativeReq = new Request('http://localhost/api/federation/skills/invoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== null ? JSON.stringify(body) : 'NOT_VALID_JSON{{{',
  })
  return Object.assign(nativeReq, { payload }) as any
}

// ── Tests: List ────────────────────────────────────────────────────────────────

describe('federationSkillsListHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDefaultSkills.mockResolvedValue([ENABLED_SKILL, DISABLED_SKILL])
  })

  it('returns 200 with only enabled skills', async () => {
    const payload = makePayload()
    const nativeReq = new Request('http://localhost/api/federation/skills', { method: 'GET' })
    const req = Object.assign(nativeReq, { payload }) as any
    const res = await federationSkillsListHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.skills).toHaveLength(1)
    expect(body.skills[0].name).toBe('search_catalog')
  })

  it('includes count in response', async () => {
    const payload = makePayload()
    const nativeReq = new Request('http://localhost/api/federation/skills', { method: 'GET' })
    const req = Object.assign(nativeReq, { payload }) as any
    const res = await federationSkillsListHandler(req)
    const body = await res.json()
    expect(body.count).toBe(1)
    expect(body.enterprise).toBe('Angel OS Instance')
  })

  it('returns empty skills when all are disabled', async () => {
    mockGetDefaultSkills.mockResolvedValue([DISABLED_SKILL])
    const payload = makePayload()
    const nativeReq = new Request('http://localhost/api/federation/skills', { method: 'GET' })
    const req = Object.assign(nativeReq, { payload }) as any
    const res = await federationSkillsListHandler(req)
    const body = await res.json()
    expect(body.skills).toHaveLength(0)
    expect(body.count).toBe(0)
  })
})

// ── Tests: Invoke ──────────────────────────────────────────────────────────────

describe('federationSkillsInvokeHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetDefaultSkills.mockResolvedValue([ENABLED_SKILL])
    mockVerifyFederationRequest.mockResolvedValue({
      verified: true,
      reason: 'ok',
      sourceFederationId: 'peer-001',
    })
    mockLogFromVerification.mockResolvedValue(undefined)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq(null)
    const res = await federationSkillsInvokeHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/invalid json/i)
  })

  it('returns 400 when skill name is missing', async () => {
    const req = makeReq({ params: {} })
    const res = await federationSkillsInvokeHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/missing skill name/i)
  })

  it('returns 404 when skill is not found', async () => {
    const req = makeReq({ skill: 'unknown_skill' })
    const res = await federationSkillsInvokeHandler(req)
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/not found/i)
  })

  it('returns 403 when federation verification fails', async () => {
    mockVerifyFederationRequest.mockResolvedValue({
      verified: false,
      reason: 'Invalid signature',
    })
    const req = makeReq()
    const res = await federationSkillsInvokeHandler(req)
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/invalid signature/i)
  })

  it('returns 429 when rate limit reason is given', async () => {
    mockVerifyFederationRequest.mockResolvedValue({
      verified: false,
      reason: 'Rate limit exceeded',
    })
    const req = makeReq()
    const res = await federationSkillsInvokeHandler(req)
    expect(res.status).toBe(429)
  })

  it('returns 400 when params have unknown fields', async () => {
    const req = makeReq({ skill: 'search_catalog', params: { unknownField: 'bad' } })
    const res = await federationSkillsInvokeHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/invalid skill params/i)
  })

  it('returns 400 when required param type is wrong', async () => {
    // q should be string — pass a number
    const req = makeReq({ skill: 'search_catalog', params: { q: 123 } })
    const res = await federationSkillsInvokeHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/must be a string/i)
  })

  it('returns 200 on successful skill invocation', async () => {
    const req = makeReq({ skill: 'search_catalog', params: { q: 'shirt', limit: 5 } })
    const res = await federationSkillsInvokeHandler(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.result).toBeDefined()
    expect(typeof body.executionTimeMs).toBe('number')
  })

  it('returns 500 when skill execution throws unexpectedly', async () => {
    const req = makeReq({ skill: 'search_catalog', params: {} }, {
      find: vi.fn().mockRejectedValue(new Error('DB failure')),
    })
    const res = await federationSkillsInvokeHandler(req)
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error).toMatch(/skill execution failed/i)
  })
})
