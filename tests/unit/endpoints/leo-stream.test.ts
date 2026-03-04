/**
 * LEO Stream Endpoint — Unit Tests
 *
 * POST /api/leo/stream
 * Auth required. Returns SSE stream for real-time LEO responses via AI SDK or Anthropic.
 * Tests guard clauses, slash commands, and SSE response headers.
 * Full streaming AI paths are integration-level and not covered here.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockApplyRateLimit = vi.hoisted(() => vi.fn().mockReturnValue(null))
const mockIsGatewayAvailable = vi.hoisted(() => vi.fn().mockReturnValue(false))
const mockGetModel = vi.hoisted(() => vi.fn())
const mockGetFallbackModel = vi.hoisted(() => vi.fn())
const mockConvertToolsForAISDK = vi.hoisted(() => vi.fn().mockReturnValue([]))
const mockResolveModelId = vi.hoisted(() => vi.fn().mockReturnValue('claude-sonnet-4-6'))
const mockGetSmartModel = vi.hoisted(() => vi.fn())
const mockCheckCredits = vi.hoisted(() => vi.fn().mockResolvedValue({ hasCredits: true, remaining: 100 }))
const mockStreamText = vi.hoisted(() => vi.fn())
const mockRouteToAgent = vi.hoisted(() => vi.fn().mockResolvedValue(null))
const mockBuildMinimalConstitutionalPrompt = vi.hoisted(() => vi.fn().mockReturnValue('Constitutional prompt'))
const mockBuildCOOPromptSuffix = vi.hoisted(() => vi.fn().mockReturnValue(''))
const mockBuildHealthDigest = vi.hoisted(() => vi.fn().mockReturnValue(''))
const mockBuildWizardSystemPromptSuffix = vi.hoisted(() => vi.fn().mockReturnValue(''))
const mockExtractTextFromContent = vi.hoisted(() => vi.fn().mockReturnValue(''))
const mockWrapTextContent = vi.hoisted(() => vi.fn().mockReturnValue({ root: {} }))
const mockLogError = vi.hoisted(() => vi.fn())
const mockLeoSystemUserEmail = vi.hoisted(() => vi.fn().mockReturnValue('leo@test.local'))
const mockLeoLegacyEmail = vi.hoisted(() => vi.fn().mockReturnValue('leo-legacy@test.local'))
const mockExecuteToolCall = vi.hoisted(() => vi.fn().mockResolvedValue('Tool result'))
const mockHashContext = vi.hoisted(() => vi.fn().mockReturnValue('hash123'))
const mockCalculateStrength = vi.hoisted(() => vi.fn().mockReturnValue(1.0))
const mockCalculateDecayDate = vi.hoisted(() => vi.fn().mockReturnValue(new Date()))
const mockAnthropicConstructor = vi.hoisted(() => vi.fn())

vi.mock('@/utilities/apiRateLimiter', () => ({ applyRateLimit: mockApplyRateLimit }))
vi.mock('@/utilities/ai-gateway', () => ({
  isGatewayAvailable: mockIsGatewayAvailable,
  getModel: mockGetModel,
  getFallbackModel: mockGetFallbackModel,
  convertToolsForAISDK: mockConvertToolsForAISDK,
  resolveModelId: mockResolveModelId,
  getSmartModel: mockGetSmartModel,
  checkCredits: mockCheckCredits,
  MODEL_CATALOG: { sonnet: 'claude-sonnet-4-6' },
  DEFAULT_MODEL: 'claude-sonnet-4-6',
  FALLBACK_MODEL: 'claude-haiku-4-5-20251001',
  TASK_MODEL_MAP: {},
}))
vi.mock('ai', () => ({
  streamText: mockStreamText,
  stepCountIs: vi.fn().mockReturnValue(() => false),
}))
vi.mock('@/utilities/AgentRouter', () => ({ routeToAgent: mockRouteToAgent }))
vi.mock('@/utilities/constitutional-prompt', () => ({
  buildMinimalConstitutionalPrompt: mockBuildMinimalConstitutionalPrompt,
  buildCOOPromptSuffix: mockBuildCOOPromptSuffix,
  buildHealthDigest: mockBuildHealthDigest,
}))
vi.mock('@/utilities/wizardPrompt', () => ({
  buildWizardSystemPromptSuffix: mockBuildWizardSystemPromptSuffix,
}))
vi.mock('@/utilities/messageContent', () => ({
  extractTextFromContent: mockExtractTextFromContent,
  wrapTextContent: mockWrapTextContent,
}))
vi.mock('@/utilities/logError', () => ({ logError: mockLogError }))
vi.mock('@/utilities/leoEmail', () => ({
  leoSystemUserEmail: mockLeoSystemUserEmail,
  leoLegacyEmail: mockLeoLegacyEmail,
}))
vi.mock('@/utilities/leo-data-tools', () => ({
  LEO_TOOLS: [],
  executeToolCall: mockExecuteToolCall,
}))
vi.mock('@/utilities/pheromone-engine', () => ({
  hashContext: mockHashContext,
  calculateStrength: mockCalculateStrength,
  calculateDecayDate: mockCalculateDecayDate,
  PHEROMONE_TRAVERSAL_WEIGHT: 1.5,
}))
vi.mock('@anthropic-ai/sdk', () => ({
  default: mockAnthropicConstructor,
}))
// Mock fs so resolveAnthropicKey() cannot read .env files from disk.
// Without this, the handler finds a real API key in .env and skips the 503 path.
vi.mock('fs', () => ({
  default: { existsSync: vi.fn().mockReturnValue(false), readFileSync: vi.fn() },
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn(),
}))

import { leoStreamHandler } from '@/endpoints/leo-stream'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_BODY = { message: 'What can you help me with?', channelSlug: 'general', spaceId: 3 }

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    find: vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 }),
    findByID: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 1 }),
    update: vi.fn().mockResolvedValue({}),
    secret: 'test-secret',
    ...overrides,
  }
}

function makeReq(
  user: Record<string, unknown> | null = { id: 1, email: 'user@test.com', roles: ['member'] },
  body: Record<string, unknown> | null = VALID_BODY,
  headerOverrides: Record<string, string> = {},
  payloadOverrides: Record<string, unknown> = {},
) {
  const payload = makePayload(payloadOverrides)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-tenant-id': 'clearwater',
    ...headerOverrides,
  }
  const nativeReq = new Request('http://localhost/api/leo/stream', {
    method: 'POST',
    headers,
    body: body !== null ? JSON.stringify(body) : 'INVALID_JSON{{{',
  })
  return Object.assign(nativeReq, { user, payload }) as any
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('leoStreamHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockApplyRateLimit.mockReturnValue(null)
    mockIsGatewayAvailable.mockReturnValue(false)
    mockAnthropicConstructor.mockReturnValue(null) // No anthropic key = 503
    process.env.ANTHROPIC_API_KEY = '' // Clear key so no LLM backend
    process.env.DEFAULT_TENANT_SLUG = 'clearwater'
  })

  it('returns 401 when no user', async () => {
    const req = makeReq(null)
    const res = await leoStreamHandler(req)
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.message).toMatch(/unauthorized/i)
  })

  it('returns 429 when rate limited', async () => {
    mockApplyRateLimit.mockReturnValue(Response.json({ error: 'Too many requests' }, { status: 429 }))
    const req = makeReq()
    const res = await leoStreamHandler(req)
    expect(res.status).toBe(429)
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = makeReq({ id: 1 }, null)
    const res = await leoStreamHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/invalid json/i)
  })

  it('returns 400 when message is missing', async () => {
    const req = makeReq({ id: 1 }, { spaceId: 3 })
    const res = await leoStreamHandler(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.message).toMatch(/missing or empty.*message/i)
  })

  it('returns 400 when message is only whitespace', async () => {
    const req = makeReq({ id: 1 }, { message: '   ' })
    const res = await leoStreamHandler(req)
    expect(res.status).toBe(400)
  })

  it('returns 503 when no LLM backend is configured', async () => {
    // Neither gateway nor Anthropic key configured
    mockIsGatewayAvailable.mockReturnValue(false)
    mockAnthropicConstructor.mockReturnValue(null)
    process.env.ANTHROPIC_API_KEY = ''
    const req = makeReq()
    const res = await leoStreamHandler(req)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.message).toMatch(/streaming unavailable/i)
  })

  it('returns SSE stream for slash command /models', async () => {
    // Provide a fake gateway so we get past the 503 check
    mockIsGatewayAvailable.mockReturnValue(true)
    mockGetModel.mockReturnValue('claude-sonnet-4-20250514')
    const req = makeReq(
      { id: 1, roles: ['super_admin'] },
      { message: '/models' },
    )
    const res = await leoStreamHandler(req)
    // Slash commands should return an SSE response (text/event-stream)
    expect(res.headers.get('Content-Type')).toMatch(/text\/event-stream/)

    // Read the full stream content
    const reader = res.body!.getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }
    const text = new TextDecoder().decode(
      chunks.reduce((a, b) => { const c = new Uint8Array(a.length + b.length); c.set(a); c.set(b, a.length); return c }, new Uint8Array(0))
    )
    expect(text).toContain('event: start')
    expect(text).toContain('event: done')
  })

  it('returns SSE stream for slash command /model list', async () => {
    mockIsGatewayAvailable.mockReturnValue(true)
    mockGetModel.mockReturnValue('claude-sonnet-4-20250514')
    const req = makeReq(
      { id: 1, roles: ['super_admin'] },
      { message: '/model list' },
    )
    const res = await leoStreamHandler(req)
    expect(res.headers.get('Content-Type')).toMatch(/text\/event-stream/)
  })

  it('SSE slash-command stream contains event: delta with text', async () => {
    mockIsGatewayAvailable.mockReturnValue(true)
    mockGetModel.mockReturnValue('claude-sonnet-4-20250514')
    const req = makeReq(
      { id: 1, roles: ['super_admin'] },
      { message: '/models' },
    )
    const res = await leoStreamHandler(req)
    const reader = res.body!.getReader()
    const chunks: Uint8Array[] = []
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) chunks.push(value)
    }
    const text = new TextDecoder().decode(
      chunks.reduce((a, b) => { const c = new Uint8Array(a.length + b.length); c.set(a); c.set(b, a.length); return c }, new Uint8Array(0))
    )
    expect(text).toContain('event: delta')
    expect(text).toContain('Available Models')
  })

  it('SSE response uses correct headers', async () => {
    mockIsGatewayAvailable.mockReturnValue(true)
    const req = makeReq({ id: 1, roles: ['super_admin'] }, { message: '/models' })
    const res = await leoStreamHandler(req)
    expect(res.headers.get('Content-Type')).toMatch(/text\/event-stream/)
    expect(res.headers.get('Cache-Control')).toMatch(/no-cache/)
    expect(res.headers.get('Connection')).toBe('keep-alive')
  })
})
