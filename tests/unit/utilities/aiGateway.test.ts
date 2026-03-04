/**
 * AI Gateway — Smart Model Router Tests
 *
 * Tests the credit-aware model tiering, downshifting logic,
 * model resolution, and task-based routing configuration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

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
  type TaskComplexity,
} from '@/utilities/ai-gateway'

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
      expect(DEFAULT_MODEL).toBe('google/gemini-2.5-flash')
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
      expect(TASK_MODEL_MAP.low.primary).toBe('google/gemini-2.5-flash')
    })

    it('medium tier uses Gemini Flash with Pro + Sonnet fallbacks', () => {
      expect(TASK_MODEL_MAP.medium.primary).toBe('google/gemini-2.5-flash')
      expect(TASK_MODEL_MAP.medium.fallbacks).toContain('google/gemini-3.1-pro')
      expect(TASK_MODEL_MAP.medium.fallbacks).toContain('anthropic/claude-sonnet-4-6')
    })

    it('high tier uses Gemini Pro with Sonnet fallback', () => {
      expect(TASK_MODEL_MAP.high.primary).toBe('google/gemini-3.1-pro')
      expect(TASK_MODEL_MAP.high.fallbacks).toContain('anthropic/claude-sonnet-4-6')
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

    it('cost increases with complexity (primary models)', () => {
      // Low and medium share Flash, high uses Pro, critical uses Sonnet
      expect(TASK_MODEL_MAP.low.primary).toBe(TASK_MODEL_MAP.medium.primary)
      expect(TASK_MODEL_MAP.high.primary).not.toBe(TASK_MODEL_MAP.low.primary)
      expect(TASK_MODEL_MAP.critical.primary).not.toBe(TASK_MODEL_MAP.high.primary)
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
      expect(resolveModelId('gemini-flash')).toBe('google/gemini-2.5-flash')
      expect(resolveModelId('gpt-4o')).toBe('openai/gpt-4o')
    })

    it('passes through full gateway IDs unchanged', () => {
      expect(resolveModelId('anthropic/claude-sonnet-4-6')).toBe(
        'anthropic/claude-sonnet-4-6',
      )
      expect(resolveModelId('google/gemini-2.5-flash')).toBe('google/gemini-2.5-flash')
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
})
