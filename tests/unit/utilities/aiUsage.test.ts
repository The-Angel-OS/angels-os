/**
 * Unit tests for AI response telemetry (cost + provider derivation + builder).
 */
import { describe, it, expect } from 'vitest'
import { providerFromModelId, computeCostCents, buildResponseTelemetry } from '@/utilities/aiUsage'

describe('providerFromModelId', () => {
  it.each([
    ['ollama/qwen2.5:7b', 'ollama'],
    ['groq/openai/gpt-oss-20b', 'groq'],
    ['google/gemini-2.5-flash', 'google'],
    ['anthropic/claude-sonnet-4-6', 'anthropic'],
    ['bare-model', 'gateway'],
  ])('%s → %s', (modelId, provider) => {
    expect(providerFromModelId(modelId)).toBe(provider)
  })
})

describe('computeCostCents', () => {
  it('local models are free', () => {
    expect(computeCostCents('ollama/qwen2.5:7b', 1000, 1000)).toBe(0)
  })

  it('computes from list pricing (sonnet: $3/$15 per Mtok)', () => {
    // 1M in + 1M out → $3 + $15 = $18 → 1800 cents
    expect(computeCostCents('anthropic/claude-sonnet-4-6', 1_000_000, 1_000_000)).toBe(1800)
  })

  it('scales sub-million token counts', () => {
    // 10k in + 5k out on gpt-oss-20b ($0.075/$0.30) →
    // 0.01*0.075 + 0.005*0.30 = 0.00075 + 0.0015 = 0.00225 $ → 0.225 cents
    expect(computeCostCents('groq/openai/gpt-oss-20b', 10_000, 5_000)).toBeCloseTo(0.225, 3)
  })

  it('returns undefined for unpriced models or missing tokens', () => {
    expect(computeCostCents('unknown/model', 100, 100)).toBeUndefined()
    expect(computeCostCents('anthropic/claude-sonnet-4-6', undefined, 100)).toBeUndefined()
  })
})

describe('buildResponseTelemetry', () => {
  it('assembles a full record with totals, cost, provider, and tools', () => {
    const t = buildResponseTelemetry({
      model: 'anthropic/claude-sonnet-4-6',
      tier: 'medium',
      inputTokens: 2000,
      outputTokens: 500,
      finishReason: 'stop',
      toolNames: ['query_products', 'create_booking'],
      latencyMs: 1234,
      ttftMs: 300,
    })
    expect(t.provider).toBe('anthropic')
    expect(t.totalTokens).toBe(2500)
    expect(t.costCents).toBeGreaterThan(0)
    expect(t.costEstimated).toBe(true)
    expect(t.toolCalls).toEqual(['query_products', 'create_booking'])
    expect(t.toolCallCount).toBe(2)
    expect(t.latencyMs).toBe(1234)
    expect(t.ttftMs).toBe(300)
    expect(t.finishReason).toBe('stop')
    expect(t.failedOver).toBeUndefined()
  })

  it('marks failover and a local (free) provider correctly', () => {
    const t = buildResponseTelemetry({
      model: 'ollama/qwen2.5:7b',
      tier: 'low',
      inputTokens: 1500,
      outputTokens: 200,
      failedOver: true,
    })
    expect(t.provider).toBe('ollama')
    expect(t.costCents).toBe(0)
    expect(t.costEstimated).toBeUndefined() // free → not an estimate
    expect(t.failedOver).toBe(true)
    expect(t.toolCalls).toBeUndefined()
  })
})
