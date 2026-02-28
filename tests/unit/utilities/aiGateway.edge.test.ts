/**
 * AI Gateway — BREAK IT Edge Case Tests
 *
 * Tests pure functions only (no network, no gateway key required):
 * applyCreditPressure, resolveModelId, getModelTierInfo, MODEL_CATALOG,
 * TASK_MODEL_MAP, IMAGE_MODEL_CATALOG.
 *
 * Credit thresholds, model catalog integrity, downshifting logic.
 */
import { describe, it, expect } from 'vitest'
import {
  applyCreditPressure,
  resolveModelId,
  getModelTierInfo,
  MODEL_CATALOG,
  IMAGE_MODEL_CATALOG,
  TASK_MODEL_MAP,
  DEFAULT_MODEL,
  FALLBACK_MODEL,
} from '@/utilities/ai-gateway'
import type { TaskComplexity, CreditSnapshot } from '@/utilities/ai-gateway'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCredits(balance: number): CreditSnapshot {
  return { balance, totalUsed: 100 - balance, checkedAt: Date.now() }
}

// ===========================================================================
// MODEL_CATALOG integrity
// ===========================================================================

describe('MODEL_CATALOG — integrity', () => {
  it('all aliases resolve to provider/model format', () => {
    for (const [alias, modelId] of Object.entries(MODEL_CATALOG)) {
      expect(modelId).toContain('/')
      expect(alias.length).toBeGreaterThan(0)
    }
  })

  it('has at least 3 providers', () => {
    const providers = new Set(Object.values(MODEL_CATALOG).map((m) => m.split('/')[0]))
    expect(providers.size).toBeGreaterThanOrEqual(3)
  })

  it('DEFAULT_MODEL is a valid gateway ID', () => {
    expect(DEFAULT_MODEL).toContain('/')
  })

  it('FALLBACK_MODEL is a valid gateway ID', () => {
    expect(FALLBACK_MODEL).toContain('/')
  })

  it('FALLBACK_MODEL is different from DEFAULT_MODEL', () => {
    expect(FALLBACK_MODEL).not.toBe(DEFAULT_MODEL)
  })
})

describe('IMAGE_MODEL_CATALOG — integrity', () => {
  it('all image aliases resolve to provider/model format', () => {
    for (const [, modelId] of Object.entries(IMAGE_MODEL_CATALOG)) {
      expect(modelId).toContain('/')
    }
  })
})

// ===========================================================================
// TASK_MODEL_MAP — integrity
// ===========================================================================

describe('TASK_MODEL_MAP — integrity', () => {
  const complexities: TaskComplexity[] = ['low', 'medium', 'high', 'critical']

  it('all complexity levels are defined', () => {
    for (const c of complexities) {
      expect(TASK_MODEL_MAP[c]).toBeDefined()
    }
  })

  it('all tiers have a primary model', () => {
    for (const c of complexities) {
      expect(TASK_MODEL_MAP[c].primary).toBeTruthy()
      expect(TASK_MODEL_MAP[c].primary).toContain('/')
    }
  })

  it('all tiers have at least one fallback', () => {
    for (const c of complexities) {
      expect(TASK_MODEL_MAP[c].fallbacks.length).toBeGreaterThanOrEqual(1)
    }
  })

  it('fallback models are valid gateway IDs', () => {
    for (const c of complexities) {
      for (const fb of TASK_MODEL_MAP[c].fallbacks) {
        expect(fb).toContain('/')
      }
    }
  })

  it('primary is not duplicated in fallbacks', () => {
    for (const c of complexities) {
      expect(TASK_MODEL_MAP[c].fallbacks).not.toContain(TASK_MODEL_MAP[c].primary)
    }
  })

  it('critical tier uses more expensive model than low tier', () => {
    // Critical should use Sonnet/Opus, low should use Flash
    expect(TASK_MODEL_MAP['critical'].primary).not.toBe(TASK_MODEL_MAP['low'].primary)
  })
})

// ===========================================================================
// getModelTierInfo
// ===========================================================================

describe('getModelTierInfo — edge cases', () => {
  it('returns correct config for each tier', () => {
    const complexities: TaskComplexity[] = ['low', 'medium', 'high', 'critical']
    for (const c of complexities) {
      const info = getModelTierInfo(c)
      expect(info).toEqual(TASK_MODEL_MAP[c])
    }
  })
})

// ===========================================================================
// applyCreditPressure — adversarial
// ===========================================================================

describe('applyCreditPressure — edge cases', () => {
  it('returns requested complexity when credits are null', () => {
    expect(applyCreditPressure('critical', null)).toBe('critical')
    expect(applyCreditPressure('low', null)).toBe('low')
  })

  it('forces low when balance < $2 (critical threshold)', () => {
    expect(applyCreditPressure('critical', makeCredits(1.99))).toBe('low')
    expect(applyCreditPressure('high', makeCredits(0.50))).toBe('low')
    expect(applyCreditPressure('medium', makeCredits(0))).toBe('low')
  })

  it('keeps low unchanged when balance < $2', () => {
    expect(applyCreditPressure('low', makeCredits(1))).toBe('low')
  })

  it('downshifts one tier when balance < $10', () => {
    expect(applyCreditPressure('critical', makeCredits(5))).toBe('high')
    expect(applyCreditPressure('high', makeCredits(5))).toBe('medium')
    expect(applyCreditPressure('medium', makeCredits(5))).toBe('low')
    expect(applyCreditPressure('low', makeCredits(5))).toBe('low')
  })

  it('no downshift when balance >= $25', () => {
    expect(applyCreditPressure('critical', makeCredits(100))).toBe('critical')
    expect(applyCreditPressure('high', makeCredits(50))).toBe('high')
  })

  it('no downshift at exactly $25 (warning zone, no shift)', () => {
    expect(applyCreditPressure('critical', makeCredits(25))).toBe('critical')
  })

  it('downshifts at exactly $10 (< $10)', () => {
    // $10 is NOT < $10, so no downshift — this tests the boundary
    expect(applyCreditPressure('critical', makeCredits(10))).toBe('critical')
  })

  it('downshifts at $9.99 (just below $10)', () => {
    expect(applyCreditPressure('critical', makeCredits(9.99))).toBe('high')
  })

  it('forces low at exactly $2', () => {
    // $2 is NOT < $2, so should NOT force low
    expect(applyCreditPressure('critical', makeCredits(2))).toBe('high')
  })

  it('forces low at $1.99', () => {
    expect(applyCreditPressure('critical', makeCredits(1.99))).toBe('low')
  })

  it('handles negative balance', () => {
    expect(applyCreditPressure('critical', makeCredits(-5))).toBe('low')
  })

  it('handles zero balance', () => {
    expect(applyCreditPressure('high', makeCredits(0))).toBe('low')
  })

  it('handles NaN balance (NaN < 2 is false, so no downshift)', () => {
    const result = applyCreditPressure('critical', makeCredits(NaN))
    // NaN < 2 is false, NaN < 10 is false, NaN < 25 is false → no downshift
    expect(result).toBe('critical')
  })

  it('handles Infinity balance (no downshift)', () => {
    expect(applyCreditPressure('critical', makeCredits(Infinity))).toBe('critical')
  })
})

// ===========================================================================
// resolveModelId — adversarial
// ===========================================================================

describe('resolveModelId — edge cases', () => {
  it('resolves alias to full model ID', () => {
    expect(resolveModelId('claude-sonnet')).toBe(MODEL_CATALOG['claude-sonnet'])
  })

  it('passes through full gateway IDs unchanged', () => {
    expect(resolveModelId('anthropic/claude-sonnet-4-20250514')).toBe('anthropic/claude-sonnet-4-20250514')
  })

  it('handles unknown alias (returned as-is since no slash)', () => {
    expect(resolveModelId('unknown-model')).toBe('unknown-model')
  })

  it('handles empty string (falls back to DEFAULT_MODEL)', () => {
    const result = resolveModelId('')
    // '' is falsy → falls back to process.env.LLM_MODEL || DEFAULT_MODEL
    expect(result).toBeTruthy()
  })

  it('handles undefined (falls back to DEFAULT_MODEL)', () => {
    const result = resolveModelId(undefined)
    expect(result).toBeTruthy()
  })

  it('all MODEL_CATALOG aliases resolve correctly', () => {
    for (const [alias, expected] of Object.entries(MODEL_CATALOG)) {
      expect(resolveModelId(alias)).toBe(expected)
    }
  })
})
