/**
 * Unit tests for buildByokModel — over-budget tenants serve via their OWN key.
 * Creating an AI SDK model makes no network call, so we can assert selection.
 */
import { describe, it, expect } from 'vitest'
import { buildByokModel } from '@/utilities/ai-gateway'

describe('buildByokModel', () => {
  it('returns null when no usable key', async () => {
    expect(await buildByokModel(null)).toBeNull()
    expect(await buildByokModel({})).toBeNull()
    expect(await buildByokModel({ anthropicApiKey: 'sk-ant' })).toBeNull() // anthropic-direct deferred
    expect(await buildByokModel({ openrouterApiKey: '   ' })).toBeNull()
  })

  it('prefers OpenRouter when present', async () => {
    const r = await buildByokModel({ openrouterApiKey: 'or-key', openaiApiKey: 'oa-key' })
    expect(r?.provider).toBe('openrouter')
    expect(r?.modelId.startsWith('openrouter/')).toBe(true)
    expect(r?.model).toBeTruthy()
  })

  it('falls back to OpenAI when no OpenRouter key', async () => {
    const r = await buildByokModel({ openaiApiKey: 'oa-key' })
    expect(r?.provider).toBe('openai')
    expect(r?.modelId.startsWith('openai/')).toBe(true)
  })
})
