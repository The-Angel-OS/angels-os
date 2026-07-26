/**
 * AI Gateway — Smart Model Router Tests
 *
 * Tests the credit-aware model tiering, downshifting logic,
 * model resolution, and task-based routing configuration.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the @ai-sdk/gateway and fs modules BEFORE importing the module under test
// ---------------------------------------------------------------------------

const mockLanguageModel = { modelId: 'mock-model' }
const mockImageModel = { modelId: 'mock-image-model' }
const mockGetCredits = vi.fn()

vi.mock('@ai-sdk/gateway', () => ({
  createGateway: vi.fn(() => ({
    languageModel: vi.fn((id: string) => ({ ...mockLanguageModel, modelId: id })),
    imageModel: vi.fn((id: string) => ({ ...mockImageModel, modelId: id })),
    getCredits: mockGetCredits,
  })),
}))

vi.mock('ai', () => ({
  tool: vi.fn((def: any) => def),
  jsonSchema: vi.fn((s: any) => s),
}))

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => ''),
  },
}))

vi.mock('path', () => ({
  default: {
    resolve: vi.fn((...parts: string[]) => parts.join('/')),
  },
}))

// Now import the module under test
import {
  MODEL_CATALOG,
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  TASK_MODEL_MAP,
  applyCreditPressure,
  resolveModelId,
  getModelTierInfo,
  isGatewayAvailable,
  getConfiguredModelId,
  getModel,
  getFallbackModel,
  getSmartModel,
  getImageModel,
  convertToolsForAISDK,
  invalidateCreditCache,
  checkCredits,
  IMAGE_MODEL_CATALOG,
  DEFAULT_IMAGE_MODEL,
  getEscalatedComplexity,
  parseAgentEscalation,
  DEFAULT_ESCALATION,
  resolveProviderOrder,
  type TaskComplexity,
  type EscalationStrategy,
} from '@/utilities/ai-gateway'

// ---------------------------------------------------------------------------
// The Hydra — intent-aware provider order + the sensitive privacy guard
// ---------------------------------------------------------------------------

describe('resolveProviderOrder — intent pipes', () => {
  const savedOrder = process.env.AI_PROVIDER_ORDER
  beforeEach(() => {
    delete process.env.AI_PROVIDER_ORDER // exercise the default order
  })
  afterAll(() => {
    if (savedOrder === undefined) delete process.env.AI_PROVIDER_ORDER
    else process.env.AI_PROVIDER_ORDER = savedOrder
  })

  it('default intent keeps the base order (nvidia present)', () => {
    const order = resolveProviderOrder()
    expect(order).toContain('nvidia')
    expect(order).toContain('gateway')
  })

  it('SENSITIVE never routes through a data-logging provider (nvidia excluded)', () => {
    const order = resolveProviderOrder('sensitive')
    expect(order).not.toContain('nvidia')
    // ...and prefers the sovereign local provider.
    expect(order[0]).toBe('ollama')
  })

  it('google is the primary cloud brain — present and ahead of the gateway', () => {
    const order = resolveProviderOrder()
    expect(order).toContain('google')
    expect(order.indexOf('google')).toBeLessThan(order.indexOf('gateway'))
  })

  it('SENSITIVE excludes google (an AI Studio key may train on the data)', () => {
    expect(resolveProviderOrder('sensitive')).not.toContain('google')
  })

  it('chitchat pulls the cheap/free providers to the front', () => {
    const order = resolveProviderOrder('chitchat')
    expect(order.indexOf('ollama')).toBeLessThan(order.indexOf('gateway'))
    expect(order.indexOf('groq')).toBeLessThan(order.indexOf('gateway'))
  })

  it('max prefers the frontier gateway first', () => {
    expect(resolveProviderOrder('max')[0]).toBe('gateway')
  })

  it('tool_use prefers the tool-callers (nvidia/gateway) first', () => {
    const order = resolveProviderOrder('tool_use')
    expect(['nvidia', 'gateway']).toContain(order[0])
  })

  it('respects an explicit AI_PROVIDER_ORDER as the base, still guarding sensitive', () => {
    process.env.AI_PROVIDER_ORDER = 'nvidia,gateway'
    expect(resolveProviderOrder('sensitive')).not.toContain('nvidia')
    expect(resolveProviderOrder('default')).toEqual(['nvidia', 'gateway'])
  })
})

// ---------------------------------------------------------------------------
// MODEL_CATALOG — model registry
// ---------------------------------------------------------------------------

describe('AI Gateway', () => {
  describe('MODEL_CATALOG', () => {
    it('contains Anthropic Claude models', () => {
      expect(MODEL_CATALOG['claude-sonnet']).toContain('anthropic/')
      expect(MODEL_CATALOG['claude-opus']).toContain('anthropic/')
      expect(MODEL_CATALOG['claude-haiku']).toContain('anthropic/')
    })

    it('contains Google Gemini models', () => {
      expect(MODEL_CATALOG['gemini-pro']).toContain('google/')
      expect(MODEL_CATALOG['gemini-flash']).toContain('google/')
    })

    it('contains OpenAI models', () => {
      expect(MODEL_CATALOG['gpt-4o']).toContain('openai/')
      expect(MODEL_CATALOG['gpt-4o-mini']).toContain('openai/')
    })

    it('has 7 model entries', () => {
      expect(Object.keys(MODEL_CATALOG)).toHaveLength(7)
    })

    it('all model IDs contain a provider slash', () => {
      for (const [alias, id] of Object.entries(MODEL_CATALOG)) {
        expect(id).toContain('/')
      }
    })
  })

  describe('DEFAULT_MODEL', () => {
    it('uses Gemini Flash (cheapest capable model)', () => {
      // LITE, deliberately. `gemini-2.5-flash` is RETIRED (Google 404s it), and
      // `gemini-flash-latest` is a THINKING model that returns empty content on a
      // small max_tokens — both produce the same symptom on this lane: a stuck
      // "..." that never resolves. Verified against the live key 260726.
      expect(DEFAULT_MODEL).toBe('google/gemini-flash-lite-latest')
    })
  })

  describe('FALLBACK_MODEL', () => {
    it('uses Claude Sonnet as fallback', () => {
      expect(FALLBACK_MODEL).toContain('anthropic/claude-sonnet')
    })
  })

  // ---------------------------------------------------------------------------
  // TASK_MODEL_MAP — tiered routing configuration
  // ---------------------------------------------------------------------------

  describe('TASK_MODEL_MAP', () => {
    it('defines all four complexity tiers', () => {
      expect(TASK_MODEL_MAP).toHaveProperty('low')
      expect(TASK_MODEL_MAP).toHaveProperty('medium')
      expect(TASK_MODEL_MAP).toHaveProperty('high')
      expect(TASK_MODEL_MAP).toHaveProperty('critical')
    })

    it('low tier uses cheapest model (Gemini Flash)', () => {
      expect(TASK_MODEL_MAP.low.primary).toBe('google/gemini-flash-lite-latest')
    })

    // The 4-tier map is now a view over TWO LANES (TIER_TO_LANE): only `low` is
    // mechanical; medium/high/critical are all user-facing and route agentic.
    // These assertions described the older per-tier model list and had been
    // failing against the lane design.
    it('medium tier routes the agentic lane', () => {
      expect(TASK_MODEL_MAP.medium.primary).toBe('anthropic/claude-sonnet-4-6')
      expect(TASK_MODEL_MAP.medium.fallbacks).toContain('google/gemini-3.1-pro')
    })

    it('high tier routes the agentic lane, same as medium and critical', () => {
      expect(TASK_MODEL_MAP.high.primary).toBe('anthropic/claude-sonnet-4-6')
      expect(TASK_MODEL_MAP.high.fallbacks).toContain('google/gemini-3.1-pro')
    })

    it('critical tier uses Claude Sonnet with Opus + Pro fallbacks', () => {
      expect(TASK_MODEL_MAP.critical.primary).toContain('anthropic/claude-sonnet')
      expect(TASK_MODEL_MAP.critical.fallbacks.some((f) => f.includes('claude-opus'))).toBe(true)
    })

    it('every tier has at least one fallback', () => {
      for (const tier of Object.values(TASK_MODEL_MAP)) {
        expect(tier.fallbacks.length).toBeGreaterThanOrEqual(1)
      }
    })

    it('separates the cheap mechanical lane from the user-facing ones', () => {
      // TWO lanes, not four price points: `low` is the cheap mechanical model,
      // everything a person actually talks to shares the agentic one.
      expect(TASK_MODEL_MAP.low.primary).not.toBe(TASK_MODEL_MAP.medium.primary)
      expect(TASK_MODEL_MAP.medium.primary).toBe(TASK_MODEL_MAP.high.primary)
      expect(TASK_MODEL_MAP.high.primary).toBe(TASK_MODEL_MAP.critical.primary)
    })
  })

  // ---------------------------------------------------------------------------
  // applyCreditPressure — credit-aware downshifting
  // ---------------------------------------------------------------------------

  describe('applyCreditPressure', () => {
    it('returns requested tier when credits are null (no monitoring)', () => {
      expect(applyCreditPressure('critical', null)).toBe('critical')
      expect(applyCreditPressure('high', null)).toBe('high')
      expect(applyCreditPressure('medium', null)).toBe('medium')
      expect(applyCreditPressure('low', null)).toBe('low')
    })

    it('returns requested tier when credits are healthy (>$25)', () => {
      const healthy = { balance: 100, totalUsed: 50, checkedAt: Date.now() }
      expect(applyCreditPressure('critical', healthy)).toBe('critical')
      expect(applyCreditPressure('high', healthy)).toBe('high')
      expect(applyCreditPressure('medium', healthy)).toBe('medium')
      expect(applyCreditPressure('low', healthy)).toBe('low')
    })

    it('returns requested tier at warning level ($25) — no downshift', () => {
      const warning = { balance: 25, totalUsed: 75, checkedAt: Date.now() }
      expect(applyCreditPressure('critical', warning)).toBe('critical')
      expect(applyCreditPressure('high', warning)).toBe('high')
    })

    it('warns but does not downshift at exactly $25', () => {
      const atThreshold = { balance: 25, totalUsed: 75, checkedAt: Date.now() }
      // $25 is >= CREDIT_THRESHOLD_WARN so no downshift
      expect(applyCreditPressure('critical', atThreshold)).toBe('critical')
    })

    it('downshifts one level when credits are low ($2-$10)', () => {
      const low = { balance: 8, totalUsed: 92, checkedAt: Date.now() }
      expect(applyCreditPressure('critical', low)).toBe('high')
      expect(applyCreditPressure('high', low)).toBe('medium')
      expect(applyCreditPressure('medium', low)).toBe('low')
      expect(applyCreditPressure('low', low)).toBe('low') // already lowest
    })

    it('forces all to low when credits are critical (<$2)', () => {
      const critical = { balance: 1.5, totalUsed: 98.5, checkedAt: Date.now() }
      expect(applyCreditPressure('critical', critical)).toBe('low')
      expect(applyCreditPressure('high', critical)).toBe('low')
      expect(applyCreditPressure('medium', critical)).toBe('low')
      expect(applyCreditPressure('low', critical)).toBe('low')
    })

    it('forces to low even at $0 balance', () => {
      const zero = { balance: 0, totalUsed: 100, checkedAt: Date.now() }
      expect(applyCreditPressure('critical', zero)).toBe('low')
    })

    it('forces to low with negative balance', () => {
      const negative = { balance: -5, totalUsed: 105, checkedAt: Date.now() }
      expect(applyCreditPressure('critical', negative)).toBe('low')
    })

    it('boundary: $2 is critical (< threshold)', () => {
      const atTwo = { balance: 2, totalUsed: 98, checkedAt: Date.now() }
      // $2 is >= CREDIT_THRESHOLD_CRITICAL(2) but < CREDIT_THRESHOLD_LOW(10)
      // So it should downshift one level, not force to low
      expect(applyCreditPressure('critical', atTwo)).toBe('high')
    })

    it('boundary: $1.99 is critical (forces low)', () => {
      const justUnder = { balance: 1.99, totalUsed: 98.01, checkedAt: Date.now() }
      expect(applyCreditPressure('critical', justUnder)).toBe('low')
    })

    it('boundary: $10 is past low threshold (no downshift)', () => {
      const atTen = { balance: 10, totalUsed: 90, checkedAt: Date.now() }
      // $10 is >= CREDIT_THRESHOLD_LOW(10) but < CREDIT_THRESHOLD_WARN(25)
      // So it hits the warn path but returns requested
      expect(applyCreditPressure('critical', atTen)).toBe('critical')
    })

    it('boundary: $9.99 triggers low-credit downshift', () => {
      const justUnder = { balance: 9.99, totalUsed: 90.01, checkedAt: Date.now() }
      expect(applyCreditPressure('critical', justUnder)).toBe('high')
    })
  })

  // ---------------------------------------------------------------------------
  // resolveModelId — alias + env + full ID resolution
  // ---------------------------------------------------------------------------

  describe('resolveModelId', () => {
    beforeEach(() => {
      delete process.env.LLM_MODEL
    })

    it('resolves alias to full gateway ID', () => {
      expect(resolveModelId('claude-sonnet')).toBe('anthropic/claude-sonnet-4-6')
      expect(resolveModelId('gemini-flash')).toBe('google/gemini-flash-lite-latest')
      expect(resolveModelId('gpt-4o')).toBe('openai/gpt-4o')
    })

    it('passes through full gateway IDs unchanged', () => {
      expect(resolveModelId('anthropic/claude-sonnet-4-6')).toBe(
        'anthropic/claude-sonnet-4-6',
      )
      expect(resolveModelId('google/gemini-flash-lite-latest')).toBe('google/gemini-flash-lite-latest')
    })

    it('returns DEFAULT_MODEL when no argument given', () => {
      expect(resolveModelId()).toBe(DEFAULT_MODEL)
    })

    it('reads LLM_MODEL from env when no argument given', () => {
      process.env.LLM_MODEL = 'openai/gpt-4o'
      expect(resolveModelId()).toBe('openai/gpt-4o')
      delete process.env.LLM_MODEL
    })

    it('prefers explicit argument over env', () => {
      process.env.LLM_MODEL = 'openai/gpt-4o'
      expect(resolveModelId('claude-sonnet')).toBe('anthropic/claude-sonnet-4-6')
      delete process.env.LLM_MODEL
    })

    it('returns unknown strings as-is for gateway validation', () => {
      expect(resolveModelId('some-custom-model')).toBe('some-custom-model')
    })
  })

  // ---------------------------------------------------------------------------
  // getModelTierInfo — tier lookup
  // ---------------------------------------------------------------------------

  describe('getModelTierInfo', () => {
    it('returns primary and fallbacks for each tier', () => {
      const tiers: TaskComplexity[] = ['low', 'medium', 'high', 'critical']
      for (const tier of tiers) {
        const info = getModelTierInfo(tier)
        expect(info).toHaveProperty('primary')
        expect(info).toHaveProperty('fallbacks')
        expect(typeof info.primary).toBe('string')
        expect(Array.isArray(info.fallbacks)).toBe(true)
      }
    })

    it('matches TASK_MODEL_MAP exactly', () => {
      expect(getModelTierInfo('low')).toEqual(TASK_MODEL_MAP.low)
      expect(getModelTierInfo('critical')).toEqual(TASK_MODEL_MAP.critical)
    })
  })

  // ---------------------------------------------------------------------------
  // isGatewayAvailable / getConfiguredModelId
  // ---------------------------------------------------------------------------

  describe('isGatewayAvailable', () => {
    it('returns false when no API key is set', () => {
      delete process.env.AI_GATEWAY_API_KEY
      expect(isGatewayAvailable()).toBe(false)
    })

    it('returns true when API key is set', () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key-123'
      expect(isGatewayAvailable()).toBe(true)
      delete process.env.AI_GATEWAY_API_KEY
    })
  })

  describe('getConfiguredModelId', () => {
    it('returns DEFAULT_MODEL when no env override', () => {
      delete process.env.LLM_MODEL
      expect(getConfiguredModelId()).toBe(DEFAULT_MODEL)
    })
  })

  // ---------------------------------------------------------------------------
  // getModel / getFallbackModel — legacy factory functions
  // ---------------------------------------------------------------------------

  describe('getModel', () => {
    it('returns null when no API key configured', () => {
      delete process.env.AI_GATEWAY_API_KEY
      expect(getModel()).toBeNull()
    })

    it('returns a LanguageModel when API key is set', () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key'
      const model = getModel()
      expect(model).not.toBeNull()
      expect(model).toHaveProperty('modelId')
      delete process.env.AI_GATEWAY_API_KEY
    })

    it('accepts explicit model ID', () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key'
      const model = getModel('claude-sonnet')
      expect(model).not.toBeNull()
      delete process.env.AI_GATEWAY_API_KEY
    })
  })

  describe('getFallbackModel', () => {
    it('returns null when no API key configured', () => {
      delete process.env.AI_GATEWAY_API_KEY
      expect(getFallbackModel()).toBeNull()
    })

    it('returns a model when API key is set', () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key'
      const model = getFallbackModel()
      expect(model).not.toBeNull()
      delete process.env.AI_GATEWAY_API_KEY
    })
  })

  // ---------------------------------------------------------------------------
  // getSmartModel — the core smart routing function
  // ---------------------------------------------------------------------------

  describe('getSmartModel', () => {
    beforeEach(() => {
      invalidateCreditCache()
    })

    it('returns null when no API key configured', async () => {
      delete process.env.AI_GATEWAY_API_KEY
      const result = await getSmartModel('medium')
      expect(result).toBeNull()
    })

    it('returns SmartModelResult with all required fields', async () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key'
      mockGetCredits.mockRejectedValue(new Error('no credits API in test'))

      const result = await getSmartModel('medium')
      expect(result).not.toBeNull()
      expect(result).toHaveProperty('model')
      expect(result).toHaveProperty('providerOptions')
      expect(result).toHaveProperty('modelId')
      expect(result).toHaveProperty('complexity')
      expect(result).toHaveProperty('effectiveComplexity')
      delete process.env.AI_GATEWAY_API_KEY
    })

    it('defaults to medium complexity', async () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key'
      mockGetCredits.mockRejectedValue(new Error('skip'))

      const result = await getSmartModel()
      expect(result?.complexity).toBe('medium')
      delete process.env.AI_GATEWAY_API_KEY
    })

    it('includes gateway fallback models in providerOptions', async () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key'
      mockGetCredits.mockRejectedValue(new Error('skip'))

      const result = await getSmartModel('medium')
      expect(result?.providerOptions).toHaveProperty('gateway')
      expect(result?.providerOptions.gateway).toHaveProperty('models')
      expect(Array.isArray(result?.providerOptions.gateway.models)).toBe(true)
      delete process.env.AI_GATEWAY_API_KEY
    })

    it('includes tracking tags in providerOptions', async () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key'
      mockGetCredits.mockRejectedValue(new Error('skip'))

      const result = await getSmartModel('high', {
        tenantId: 5,
        userId: 42,
        tags: ['leo-chat'],
      })
      expect(result?.providerOptions.gateway.user).toBe('t5-u42')
      expect(result?.providerOptions.gateway.tags).toContain('leo-chat')
      expect(result?.providerOptions.gateway.tags).toContain('tier-high')
      delete process.env.AI_GATEWAY_API_KEY
    })

    it('includes tier tag even without custom tags', async () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key'
      mockGetCredits.mockRejectedValue(new Error('skip'))

      const result = await getSmartModel('low')
      expect(result?.providerOptions.gateway.tags).toContain('tier-low')
      delete process.env.AI_GATEWAY_API_KEY
    })

    it('uses correct primary model for each tier', async () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key'
      mockGetCredits.mockRejectedValue(new Error('skip'))

      const low = await getSmartModel('low')
      expect(low?.modelId).toBe(TASK_MODEL_MAP.low.primary)

      const medium = await getSmartModel('medium')
      expect(medium?.modelId).toBe(TASK_MODEL_MAP.medium.primary)

      const high = await getSmartModel('high')
      expect(high?.modelId).toBe(TASK_MODEL_MAP.high.primary)

      const critical = await getSmartModel('critical')
      expect(critical?.modelId).toBe(TASK_MODEL_MAP.critical.primary)

      delete process.env.AI_GATEWAY_API_KEY
    })

    it('downshifts when credits are low', async () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key'
      mockGetCredits.mockResolvedValue({ balance: '5.00', totalUsed: '95.00' })
      invalidateCreditCache()

      const result = await getSmartModel('critical')
      // $5 < $10 threshold → critical downshifts to high
      expect(result?.effectiveComplexity).toBe('high')
      expect(result?.complexity).toBe('critical')
      delete process.env.AI_GATEWAY_API_KEY
    })

    it('forces low tier when credits are critical', async () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key'
      mockGetCredits.mockResolvedValue({ balance: '1.00', totalUsed: '99.00' })
      invalidateCreditCache()

      const result = await getSmartModel('critical')
      // $1 < $2 threshold → forces low
      expect(result?.effectiveComplexity).toBe('low')
      expect(result?.modelId).toBe(TASK_MODEL_MAP.low.primary)
      delete process.env.AI_GATEWAY_API_KEY
    })
  })

  // ---------------------------------------------------------------------------
  // Image Model
  // ---------------------------------------------------------------------------

  describe('IMAGE_MODEL_CATALOG', () => {
    it('contains image-capable models', () => {
      expect(Object.keys(IMAGE_MODEL_CATALOG).length).toBeGreaterThanOrEqual(3)
    })

    it('all entries have provider/model format', () => {
      for (const id of Object.values(IMAGE_MODEL_CATALOG)) {
        expect(id).toContain('/')
      }
    })
  })

  describe('getImageModel', () => {
    it('returns null when no API key configured', () => {
      delete process.env.AI_GATEWAY_API_KEY
      expect(getImageModel()).toBeNull()
    })

    it('returns a model when API key is set', () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key'
      const model = getImageModel()
      expect(model).not.toBeNull()
      delete process.env.AI_GATEWAY_API_KEY
    })

    it('resolves image model aliases', () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key'
      const model = getImageModel('gemini-flash-image')
      expect(model).not.toBeNull()
      delete process.env.AI_GATEWAY_API_KEY
    })
  })

  // ---------------------------------------------------------------------------
  // convertToolsForAISDK — Anthropic → AI SDK tool conversion
  // ---------------------------------------------------------------------------

  describe('convertToolsForAISDK', () => {
    it('converts Anthropic tools to AI SDK ToolSet', () => {
      const anthropicTools = [
        {
          name: 'search_products',
          description: 'Search for products',
          input_schema: {
            type: 'object' as const,
            properties: {
              query: { type: 'string' },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_order',
          description: 'Get order details',
          input_schema: {
            type: 'object' as const,
            properties: {
              orderId: { type: 'string' },
            },
          },
        },
      ]

      const executor = vi.fn(async () => 'result')
      const ctx = { tenantId: 1 }

      const result = convertToolsForAISDK(anthropicTools as any, executor, ctx)

      expect(Object.keys(result)).toHaveLength(2)
      expect(result).toHaveProperty('search_products')
      expect(result).toHaveProperty('get_order')
    })

    it('creates executable tools that call the dispatcher', async () => {
      const anthropicTools = [
        {
          name: 'test_tool',
          description: 'A test tool',
          input_schema: { type: 'object' as const, properties: {} },
        },
      ]

      const executor = vi.fn(async (_name: string, _input: any, _ctx: any) => 'executed!')
      const ctx = { tenantId: 5 }

      const result = convertToolsForAISDK(anthropicTools as any, executor, ctx)
      const output = await result.test_tool.execute!({ foo: 'bar' }, {} as any)

      expect(executor).toHaveBeenCalledWith('test_tool', { foo: 'bar' }, ctx)
      expect(output).toBe('executed!')
    })

    it('handles empty tool list', () => {
      const result = convertToolsForAISDK([], vi.fn(), {})
      expect(Object.keys(result)).toHaveLength(0)
    })
  })

  // ---------------------------------------------------------------------------
  // invalidateCreditCache
  // ---------------------------------------------------------------------------

  describe('invalidateCreditCache', () => {
    it('does not throw when called', () => {
      expect(() => invalidateCreditCache()).not.toThrow()
    })

    it('can be called multiple times safely', () => {
      invalidateCreditCache()
      invalidateCreditCache()
      invalidateCreditCache()
      // Should not throw
    })
  })

  // ---------------------------------------------------------------------------
  // checkCredits
  // ---------------------------------------------------------------------------

  describe('checkCredits', () => {
    beforeEach(() => {
      invalidateCreditCache()
      mockGetCredits.mockReset()
      delete process.env.AI_GATEWAY_API_KEY
    })

    it('returns null when no API key configured', async () => {
      const result = await checkCredits()
      expect(result).toBeNull()
    })

    it('returns credit snapshot when API key is set', async () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key'
      mockGetCredits.mockResolvedValue({ balance: '50.00', totalUsed: '25.00' })

      const result = await checkCredits()
      expect(result).not.toBeNull()
      expect(result?.balance).toBe(50)
      expect(result?.totalUsed).toBe(25)
      expect(result?.checkedAt).toBeGreaterThan(0)
      delete process.env.AI_GATEWAY_API_KEY
    })

    it('caches results for subsequent calls', async () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key'
      mockGetCredits.mockResolvedValue({ balance: '30.00', totalUsed: '10.00' })

      await checkCredits()
      await checkCredits()
      await checkCredits()

      // Should only call the API once (cached)
      expect(mockGetCredits).toHaveBeenCalledTimes(1)
      delete process.env.AI_GATEWAY_API_KEY
    })

    it('returns stale cache on API error', async () => {
      process.env.AI_GATEWAY_API_KEY = 'test-key'

      // First call succeeds
      mockGetCredits.mockResolvedValueOnce({ balance: '40.00', totalUsed: '20.00' })
      invalidateCreditCache()
      const first = await checkCredits()
      expect(first?.balance).toBe(40)

      // Invalidate and make next call fail
      invalidateCreditCache()
      mockGetCredits.mockRejectedValueOnce(new Error('API down'))
      const second = await checkCredits()
      // Should return null since cache was invalidated and API failed
      // (the function returns _creditCache which was set to null)
      expect(second).toBeNull()

      delete process.env.AI_GATEWAY_API_KEY
    })
  })

  // ---------------------------------------------------------------------------
  // Model Escalation Rhythm — "Deep Think" strategy
  // ---------------------------------------------------------------------------

  describe('DEFAULT_ESCALATION', () => {
    it('has standard 4:1 rhythm configuration', () => {
      expect(DEFAULT_ESCALATION.standardRounds).toBe(4)
      expect(DEFAULT_ESCALATION.standardTier).toBe('medium')
      expect(DEFAULT_ESCALATION.escalationTier).toBe('critical')
      expect(DEFAULT_ESCALATION.enabled).toBe(true)
    })
  })

  describe('getEscalatedComplexity', () => {
    it('returns standard tier for turns 1-4 (default strategy)', () => {
      expect(getEscalatedComplexity(1)).toBe('medium')
      expect(getEscalatedComplexity(2)).toBe('medium')
      expect(getEscalatedComplexity(3)).toBe('medium')
      expect(getEscalatedComplexity(4)).toBe('medium')
    })

    it('returns escalation tier on turn 5 (every 5th turn)', () => {
      expect(getEscalatedComplexity(5)).toBe('critical')
    })

    it('returns standard tier for turns 6-9, escalates again on 10', () => {
      expect(getEscalatedComplexity(6)).toBe('medium')
      expect(getEscalatedComplexity(7)).toBe('medium')
      expect(getEscalatedComplexity(8)).toBe('medium')
      expect(getEscalatedComplexity(9)).toBe('medium')
      expect(getEscalatedComplexity(10)).toBe('critical')
    })

    it('continues the rhythm: 15 = escalation, 20 = escalation', () => {
      expect(getEscalatedComplexity(15)).toBe('critical')
      expect(getEscalatedComplexity(20)).toBe('critical')
    })

    it('returns standard tier for turn 0 or negative', () => {
      expect(getEscalatedComplexity(0)).toBe('medium')
      expect(getEscalatedComplexity(-1)).toBe('medium')
    })

    it('respects disabled strategy', () => {
      const disabled: EscalationStrategy = {
        ...DEFAULT_ESCALATION,
        enabled: false,
      }
      expect(getEscalatedComplexity(5, disabled)).toBe('medium') // Would be critical if enabled
      expect(getEscalatedComplexity(10, disabled)).toBe('medium')
    })

    it('respects custom standard rounds', () => {
      const custom: EscalationStrategy = {
        enabled: true,
        standardRounds: 2,
        standardTier: 'low',
        escalationTier: 'high',
      }
      // Cycle: 2 standard + 1 escalation = 3
      expect(getEscalatedComplexity(1, custom)).toBe('low')
      expect(getEscalatedComplexity(2, custom)).toBe('low')
      expect(getEscalatedComplexity(3, custom)).toBe('high') // Escalation!
      expect(getEscalatedComplexity(4, custom)).toBe('low')
      expect(getEscalatedComplexity(5, custom)).toBe('low')
      expect(getEscalatedComplexity(6, custom)).toBe('high') // Escalation again!
    })

    it('works with standardRounds=1 (every other turn is deep think)', () => {
      const fast: EscalationStrategy = {
        enabled: true,
        standardRounds: 1,
        standardTier: 'medium',
        escalationTier: 'critical',
      }
      // Cycle: 1 standard + 1 escalation = 2
      expect(getEscalatedComplexity(1, fast)).toBe('medium')
      expect(getEscalatedComplexity(2, fast)).toBe('critical')
      expect(getEscalatedComplexity(3, fast)).toBe('medium')
      expect(getEscalatedComplexity(4, fast)).toBe('critical')
    })
  })

  describe('parseAgentEscalation', () => {
    it('returns null for undefined/null input', () => {
      expect(parseAgentEscalation(undefined)).toBeNull()
      expect(parseAgentEscalation(null)).toBeNull()
    })

    it('returns null for empty object', () => {
      expect(parseAgentEscalation({})).toBeNull()
    })

    it('parses full strategy config', () => {
      const result = parseAgentEscalation({
        enabled: true,
        standardRounds: 3,
        standardTier: 'low',
        escalationTier: 'high',
      })
      expect(result).toEqual({
        enabled: true,
        standardRounds: 3,
        standardTier: 'low',
        escalationTier: 'high',
      })
    })

    it('uses defaults for missing fields', () => {
      const result = parseAgentEscalation({ enabled: false })
      expect(result).toEqual({
        enabled: false,
        standardRounds: 4,
        standardTier: 'medium',
        escalationTier: 'critical',
      })
    })

    it('rejects invalid tier values', () => {
      const result = parseAgentEscalation({
        enabled: true,
        standardTier: 'invalid',
        escalationTier: 'also_invalid',
      })
      expect(result?.standardTier).toBe('medium') // Falls back to default
      expect(result?.escalationTier).toBe('critical') // Falls back to default
    })
  })
})
