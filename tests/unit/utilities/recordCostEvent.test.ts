/**
 * Unit tests for the Operating-Costs ledger writer (recordCostEvent / recordAiUsage).
 * Verifies fail-soft behavior (never throws) and the AI-telemetry → cost-event mapping.
 */
import { describe, it, expect, vi } from 'vitest'
import { recordCostEvent, recordAiUsage } from '@/utilities/recordCostEvent'
import type { AiResponseTelemetry } from '@/utilities/aiUsage'

describe('recordCostEvent', () => {
  it('creates a cost-events row with compacted data', async () => {
    const create = vi.fn(async () => ({ id: 1 }))
    const payload = { create } as any
    await recordCostEvent(payload, {
      tenantId: 5,
      category: 'intelligence',
      source: 'leo-stream',
      provider: 'anthropic',
      costCents: 1.8,
      totalTokens: 2000,
      unit: 'tokens',
    })
    expect(create).toHaveBeenCalledTimes(1)
    const arg = create.mock.calls[0][0]
    expect(arg.collection).toBe('cost-events')
    expect(arg.overrideAccess).toBe(true)
    expect(arg.data.tenant).toBe(5)
    expect(arg.data.category).toBe('intelligence')
    expect(arg.data.costCents).toBe(1.8)
    expect(arg.data.occurredAt).toBeTruthy() // defaulted
    // undefined fields stripped
    expect('model' in arg.data).toBe(false)
  })

  it('never throws when create fails (table missing / transient)', async () => {
    const payload = { create: vi.fn(async () => { throw new Error('relation "cost_events" does not exist') }) } as any
    await expect(
      recordCostEvent(payload, { category: 'storage', source: 'blob-probe', costCents: 12 }),
    ).resolves.toBeUndefined()
  })

  it('stringifies userId', async () => {
    const create = vi.fn(async () => ({ id: 1 }))
    await recordCostEvent({ create } as any, { category: 'other', source: 's', userId: 42 })
    expect(create.mock.calls[0][0].data.userId).toBe('42')
  })
})

describe('recordAiUsage', () => {
  it('maps AI telemetry into an intelligence cost event', async () => {
    const create = vi.fn(async () => ({ id: 1 }))
    const telemetry: AiResponseTelemetry = {
      model: 'anthropic/claude-sonnet-4-6',
      provider: 'anthropic',
      tier: 'medium',
      inputTokens: 1500,
      outputTokens: 500,
      totalTokens: 2000,
      costCents: 1.05,
      costEstimated: true,
      latencyMs: 1234,
      ttftMs: 300,
      finishReason: 'stop',
      toolCallCount: 2,
    }
    await recordAiUsage({ create } as any, {
      telemetry,
      tenantId: 5,
      conversationId: 'conv-1',
      userId: 7,
      messageRef: 99,
    })
    const d = create.mock.calls[0][0].data
    expect(d.category).toBe('intelligence')
    expect(d.source).toBe('leo-stream')
    expect(d.provider).toBe('anthropic')
    expect(d.model).toBe('anthropic/claude-sonnet-4-6')
    expect(d.costCents).toBe(1.05)
    expect(d.quantity).toBe(2000)
    expect(d.unit).toBe('tokens')
    expect(d.messageRef).toBe(99)
    expect(d.conversationId).toBe('conv-1')
    expect(d.userId).toBe('7')
  })

  it('is fail-soft (free local model, no cost)', async () => {
    const create = vi.fn(async () => ({ id: 1 }))
    await recordAiUsage({ create } as any, {
      telemetry: { model: 'ollama/qwen2.5:7b', provider: 'ollama', costCents: 0, totalTokens: 1000 },
      tenantId: 1,
    })
    const d = create.mock.calls[0][0].data
    expect(d.provider).toBe('ollama')
    expect(d.costCents).toBe(0)
    expect(d.category).toBe('intelligence')
  })
})
