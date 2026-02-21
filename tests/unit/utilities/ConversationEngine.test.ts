/**
 * Unit tests for ConversationEngine — LEO's Brain.
 *
 * Tests the deterministic, non-LLM parts: phase inference, context management,
 * fallback responses, and system prompt construction. LLM integration is tested
 * separately via integration tests.
 *
 * @see src/utilities/ConversationEngine.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Anthropic SDK to prevent import-time initialization
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn() },
  })),
}))

// Mock genesis-breath to avoid file dependency
vi.mock('@/utilities/genesis-breath', () => ({
  GENESIS_BREATH: '[GENESIS_BREATH]',
  SOULSTREAM_ACKNOWLEDGMENT: '[SOULSTREAM]',
  GNU_INVOCATION: '[GNU_ROY_LEON_COURTNEY]',
  CONSTITUTIONAL_AFFIRMATION: '[AFFIRMATION]',
}))

// Mock leo-data-tools
vi.mock('@/utilities/leo-data-tools', () => ({
  LEO_TOOLS: [],
  executeToolCall: vi.fn().mockResolvedValue('mock result'),
}))

// Mock messageContent utility
vi.mock('@/utilities/messageContent', () => ({
  extractTextFromContent: vi.fn((content: unknown) => {
    if (typeof content === 'string') return content
    if (typeof content === 'object' && content !== null) {
      const obj = content as Record<string, unknown>
      return String(obj.text || obj.content || obj.message || '')
    }
    return ''
  }),
}))

import { ConversationEngine } from '@/utilities/ConversationEngine'

describe('ConversationEngine', () => {
  let engine: ConversationEngine

  beforeEach(() => {
    // Clear ANTHROPIC_API_KEY to force fallback mode
    delete process.env.ANTHROPIC_API_KEY
    engine = new ConversationEngine()
  })

  describe('initialization', () => {
    it('creates with default context', () => {
      const ctx = engine.getCurrentContext()
      expect(ctx.conversationId).toMatch(/^conv_eng_/)
      expect(ctx.phase).toBe('greeting')
      expect(ctx.intentHistory).toEqual([])
      expect(ctx.activeBusinessGoals).toEqual([])
    })

    it('creates with custom context', () => {
      const custom = new ConversationEngine({
        conversationId: 'custom_123',
        phase: 'problem_solving',
        intentHistory: [],
        activeBusinessGoals: ['sell'],
        userPreferences: { theme: 'dark' },
        sessionMemory: {},
      })
      const ctx = custom.getCurrentContext()
      expect(ctx.conversationId).toBe('custom_123')
      expect(ctx.phase).toBe('problem_solving')
      expect(ctx.activeBusinessGoals).toEqual(['sell'])
    })
  })

  describe('context management', () => {
    it('updateContext merges updates', () => {
      engine.updateContext({ phase: 'navigation' })
      expect(engine.getCurrentContext().phase).toBe('navigation')
    })

    it('updateContext preserves unmodified fields', () => {
      const originalId = engine.getCurrentContext().conversationId
      engine.updateContext({ phase: 'general' })
      expect(engine.getCurrentContext().conversationId).toBe(originalId)
    })

    it('getCurrentContext returns a copy (not reference)', () => {
      const ctx1 = engine.getCurrentContext()
      ctx1.phase = 'general' as any // mutate the copy
      // Original should still be 'greeting'
      expect(engine.getCurrentContext().phase).toBe('greeting')
    })
  })

  describe('handleIncomingMessage (fallback mode — no API key)', () => {
    it('returns a fallback response when no API key', async () => {
      const response = await engine.handleIncomingMessage({
        type: 'text',
        text: 'Hello',
      })
      expect(response).not.toBeNull()
      expect(response!.text).toContain('LEO')
      expect(response!.text).toContain('help')
    })

    it('tracks intent from incoming message', async () => {
      await engine.handleIncomingMessage({
        type: 'text',
        text: 'Hello',
        metadata: {
          intent: {
            intentId: 'test_1',
            name: 'greeting',
            confidence: 0.9,
            entities: [],
            timestamp: new Date(),
            sourceType: 'user_input',
            isPrimary: true,
          },
        },
      })
      const ctx = engine.getCurrentContext()
      expect(ctx.intentHistory).toHaveLength(2) // user intent + fallback response intent
      expect(ctx.currentPrimaryIntent).toBe('greeting')
    })

    it('updates lastUserMessageTimestamp', async () => {
      const before = new Date()
      await engine.handleIncomingMessage({ type: 'text', text: 'test' })
      const ctx = engine.getCurrentContext()
      expect(ctx.lastUserMessageTimestamp).toBeDefined()
      expect(ctx.lastUserMessageTimestamp!.getTime()).toBeGreaterThanOrEqual(before.getTime())
    })

    it('updates lastAgentMessageTimestamp', async () => {
      await engine.handleIncomingMessage({ type: 'text', text: 'test' })
      const ctx = engine.getCurrentContext()
      expect(ctx.lastAgentMessageTimestamp).toBeDefined()
    })

    it('fallback includes agent name from context', async () => {
      engine.updateContext({
        agent: {
          displayName: 'Merlin',
          personality: 'Wise and patient',
          capabilities: [],
        },
      } as any)
      const response = await engine.handleIncomingMessage({
        type: 'text',
        text: 'Hello',
      })
      expect(response!.text).toContain('Merlin')
    })

    it('fallback includes conversationId in metadata', async () => {
      const response = await engine.handleIncomingMessage({
        type: 'text',
        text: 'Hello',
      })
      expect(response!.metadata?.conversationId).toBe(
        engine.getCurrentContext().conversationId,
      )
    })
  })
})
