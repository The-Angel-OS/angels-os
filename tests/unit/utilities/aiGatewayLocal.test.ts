/**
 * AI Gateway — local-model (Ollama / OpenAI-compatible) routing tests.
 *
 * Verifies getSmartModel's env-gated local-model integration: opt-in tier
 * routing, credit-exhaustion fallback, no-gateway-key fallback, auth header
 * wiring, and — critically — that everything is INERT when OLLAMA_BASE_URL is
 * unset (cloud gateway behavior unchanged).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetCredits = vi.fn()
const mockChatModel = vi.fn((id: string) => ({ provider: 'ollama', modelId: id }))
const mockCreateOpenAICompatible = vi.fn((_opts: unknown) => ({ chatModel: mockChatModel }))

vi.mock('@ai-sdk/gateway', () => ({
  createGateway: vi.fn(() => ({
    languageModel: vi.fn((id: string) => ({ modelId: id })),
    imageModel: vi.fn((id: string) => ({ modelId: id })),
    getCredits: mockGetCredits,
  })),
}))
vi.mock('@ai-sdk/openai-compatible', () => ({
  createOpenAICompatible: (opts: unknown) => mockCreateOpenAICompatible(opts),
}))
vi.mock('ai', () => ({ tool: vi.fn((d: unknown) => d), jsonSchema: vi.fn((s: unknown) => s) }))
vi.mock('fs', () => ({ default: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => '') } }))
vi.mock('path', () => ({ default: { resolve: vi.fn((...p: string[]) => p.join('/')) } }))

import { getSmartModel, invalidateCreditCache, invalidateLocalHealthCache } from '@/utilities/ai-gateway'

const LOCAL_ENV_KEYS = [
  'AI_GATEWAY_API_KEY',
  'OLLAMA_BASE_URL',
  'OLLAMA_MODEL',
  'OLLAMA_PRIMARY_TIERS',
  'OLLAMA_API_KEY',
  'CF_ACCESS_CLIENT_ID',
  'CF_ACCESS_CLIENT_SECRET',
  'GROQ_API_KEY',
  'GROQ_MODEL',
  'GROQ_PRIMARY_TIERS',
  'AI_PROVIDER_ORDER',
]

beforeEach(() => {
  vi.clearAllMocks()
  invalidateCreditCache()
  invalidateLocalHealthCache()
  for (const k of LOCAL_ENV_KEYS) delete process.env[k]
  process.env.AI_GATEWAY_API_KEY = 'test-gateway-key'
  mockGetCredits.mockResolvedValue({ balance: '100', totalUsed: '0' })
  // Local endpoint healthy by default (GET /models → 200)
  global.fetch = vi.fn().mockResolvedValue({ ok: true }) as unknown as typeof fetch
})

describe('getSmartModel — local model OFF (default)', () => {
  it('uses the cloud gateway and never touches the local provider', async () => {
    const result = await getSmartModel('medium')
    expect(result).not.toBeNull()
    expect(result!.modelId.startsWith('ollama/')).toBe(false)
    expect(mockCreateOpenAICompatible).not.toHaveBeenCalled()
  })
})

describe('getSmartModel — local model ON', () => {
  it('routes opted-in tiers (OLLAMA_PRIMARY_TIERS) to the local model', async () => {
    process.env.OLLAMA_BASE_URL = 'https://ollama.kendev.co/v1'
    process.env.OLLAMA_PRIMARY_TIERS = 'low'
    const result = await getSmartModel('low')
    expect(result!.modelId).toBe('ollama/qwen2.5:7b-instruct')
    expect(mockCreateOpenAICompatible).toHaveBeenCalledOnce()
  })

  it('does NOT route a non-opted tier to local when credits are healthy', async () => {
    process.env.OLLAMA_BASE_URL = 'https://ollama.kendev.co/v1'
    process.env.OLLAMA_PRIMARY_TIERS = 'low'
    const result = await getSmartModel('high')
    expect(result!.modelId.startsWith('ollama/')).toBe(false)
  })

  it('fails over to cloud when the local endpoint is unreachable', async () => {
    process.env.OLLAMA_BASE_URL = 'https://ollama.kendev.co/v1'
    process.env.OLLAMA_PRIMARY_TIERS = 'low'
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch
    const result = await getSmartModel('low')
    // local opted-in but down → cloud gateway, not ollama
    expect(result!.modelId.startsWith('ollama/')).toBe(false)
  })

  it('uses local without a health probe when it is the only provider (no gateway key)', async () => {
    delete process.env.AI_GATEWAY_API_KEY
    process.env.OLLAMA_BASE_URL = 'https://ollama.kendev.co/v1'
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch
    const result = await getSmartModel('medium')
    // no cloud fallback exists, so local is used regardless of the probe
    expect(result!.modelId.startsWith('ollama/')).toBe(true)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('falls back to local when cloud credits are critically exhausted (any tier)', async () => {
    process.env.OLLAMA_BASE_URL = 'https://ollama.kendev.co/v1'
    mockGetCredits.mockResolvedValue({ balance: '1', totalUsed: '999' }) // < $2 critical
    const result = await getSmartModel('high')
    expect(result!.modelId.startsWith('ollama/')).toBe(true)
  })

  it('uses local as the sole provider when no gateway key is configured', async () => {
    delete process.env.AI_GATEWAY_API_KEY
    process.env.OLLAMA_BASE_URL = 'https://ollama.kendev.co/v1'
    const result = await getSmartModel('medium')
    expect(result!.modelId.startsWith('ollama/')).toBe(true)
  })

  it('returns null when there is neither a gateway key nor a local model', async () => {
    delete process.env.AI_GATEWAY_API_KEY
    const result = await getSmartModel('medium')
    expect(result).toBeNull()
  })

  it('honors a custom OLLAMA_MODEL', async () => {
    process.env.OLLAMA_BASE_URL = 'https://ollama.kendev.co/v1'
    process.env.OLLAMA_PRIMARY_TIERS = 'low'
    process.env.OLLAMA_MODEL = 'llama3.1:8b'
    const result = await getSmartModel('low')
    expect(result!.modelId).toBe('ollama/llama3.1:8b')
  })

  it('passes the bearer key and Cloudflare Access service-token headers through', async () => {
    process.env.OLLAMA_BASE_URL = 'https://ollama.kendev.co/v1'
    process.env.OLLAMA_PRIMARY_TIERS = 'low'
    process.env.OLLAMA_API_KEY = 'bearer-token'
    process.env.CF_ACCESS_CLIENT_ID = 'cf-id'
    process.env.CF_ACCESS_CLIENT_SECRET = 'cf-secret'
    await getSmartModel('low')
    const opts = mockCreateOpenAICompatible.mock.calls[0][0] as {
      baseURL: string
      apiKey?: string
      headers?: Record<string, string>
    }
    expect(opts.baseURL).toBe('https://ollama.kendev.co/v1')
    expect(opts.apiKey).toBe('bearer-token')
    expect(opts.headers?.['CF-Access-Client-Id']).toBe('cf-id')
    expect(opts.headers?.['CF-Access-Client-Secret']).toBe('cf-secret')
  })
})

describe('getSmartModel — Groq (fast/cheap cloud interim)', () => {
  it('routes default tiers (low/medium) to Groq gpt-oss-20b when GROQ_API_KEY is set', async () => {
    process.env.GROQ_API_KEY = 'groq-key'
    const result = await getSmartModel('low')
    expect(result!.modelId).toBe('groq/openai/gpt-oss-20b')
    const opts = mockCreateOpenAICompatible.mock.calls[0][0] as { baseURL: string }
    expect(opts.baseURL).toBe('https://api.groq.com/openai/v1')
  })

  it('does NOT route high tier to Groq by default → cloud gateway', async () => {
    process.env.GROQ_API_KEY = 'groq-key'
    const result = await getSmartModel('high')
    expect(result!.modelId.startsWith('groq/')).toBe(false)
    expect(result!.modelId.startsWith('ollama/')).toBe(false)
  })

  it('routes high tier to Groq gpt-oss-120b when explicitly opted in', async () => {
    process.env.GROQ_API_KEY = 'groq-key'
    process.env.GROQ_PRIMARY_TIERS = 'low,medium,high'
    const result = await getSmartModel('high')
    expect(result!.modelId).toBe('groq/openai/gpt-oss-120b')
  })

  it('falls back to Groq (free) when cloud credits are exhausted and no local model', async () => {
    process.env.GROQ_API_KEY = 'groq-key'
    mockGetCredits.mockResolvedValue({ balance: '1', totalUsed: '999' })
    const result = await getSmartModel('high')
    expect(result!.modelId.startsWith('groq/')).toBe(true)
  })

  it('prefers a healthy local model over Groq (order: local → Groq → gateway)', async () => {
    process.env.OLLAMA_BASE_URL = 'https://ollama.kendev.co/v1'
    process.env.OLLAMA_PRIMARY_TIERS = 'low'
    process.env.GROQ_API_KEY = 'groq-key'
    const result = await getSmartModel('low')
    expect(result!.modelId.startsWith('ollama/')).toBe(true)
  })

  it('honors a GROQ_MODEL override', async () => {
    process.env.GROQ_API_KEY = 'groq-key'
    process.env.GROQ_MODEL = 'llama-3.1-8b-instant'
    const result = await getSmartModel('low')
    expect(result!.modelId).toBe('groq/llama-3.1-8b-instant')
  })

  it('uses Groq when there is no gateway key', async () => {
    delete process.env.AI_GATEWAY_API_KEY
    process.env.GROQ_API_KEY = 'groq-key'
    const result = await getSmartModel('medium')
    expect(result!.modelId.startsWith('groq/')).toBe(true)
  })
})

describe('getSmartModel — configurable provider order (AI_PROVIDER_ORDER)', () => {
  it('respects a reordered preference (groq before local)', async () => {
    process.env.AI_PROVIDER_ORDER = 'groq,ollama,gateway'
    process.env.OLLAMA_BASE_URL = 'https://ollama.kendev.co/v1'
    process.env.OLLAMA_PRIMARY_TIERS = 'low'
    process.env.GROQ_API_KEY = 'groq-key'
    const result = await getSmartModel('low')
    // both available for 'low', but groq is first in the order now
    expect(result!.modelId.startsWith('groq/')).toBe(true)
  })

  it('a single-provider order forces that provider', async () => {
    process.env.AI_PROVIDER_ORDER = 'gateway'
    process.env.OLLAMA_BASE_URL = 'https://ollama.kendev.co/v1'
    process.env.OLLAMA_PRIMARY_TIERS = 'low'
    process.env.GROQ_API_KEY = 'groq-key'
    const result = await getSmartModel('low')
    expect(result!.modelId.startsWith('groq/')).toBe(false)
    expect(result!.modelId.startsWith('ollama/')).toBe(false)
  })

  it('ignores unknown provider names and falls back to the default order', async () => {
    process.env.AI_PROVIDER_ORDER = 'bogus,,nonsense'
    process.env.GROQ_API_KEY = 'groq-key'
    const result = await getSmartModel('low')
    // default order applies → groq handles low
    expect(result!.modelId.startsWith('groq/')).toBe(true)
  })
})
