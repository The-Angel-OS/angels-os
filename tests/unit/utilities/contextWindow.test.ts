/**
 * contextWindow — token-aware history assembly. The window must never overflow
 * on long messages, but should keep MORE short turns than a fixed count would.
 */
import { describe, it, expect } from 'vitest'
import { estimateTokens, estimateMessagesTokens, trimToTokenBudget } from '@/utilities/contextWindow'

type Msg = { role: 'user' | 'assistant'; content: string }

describe('estimateTokens', () => {
  it('is zero for empty', () => expect(estimateTokens('')).toBe(0))
  it('approximates ~4 chars per token, rounding up', () => {
    expect(estimateTokens('abcd')).toBe(1)
    expect(estimateTokens('abcde')).toBe(2)
  })
})

describe('trimToTokenBudget', () => {
  const mk = (role: 'user' | 'assistant', n: number): Msg => ({ role, content: 'x'.repeat(n) })

  it('keeps everything when under budget', () => {
    const msgs: Msg[] = [mk('user', 8), mk('assistant', 8), mk('user', 8)]
    expect(trimToTokenBudget(msgs, 1000)).toHaveLength(3)
  })

  it('drops the OLDEST first to fit the budget', () => {
    // each message = 40 chars = 10 tokens; budget 25 → keep newest 2 (20 tokens).
    // index 2 is a user turn, so the kept window legally starts with 'user'.
    const msgs: Msg[] = [mk('user', 40), mk('assistant', 40), mk('user', 40), mk('assistant', 40)]
    const kept = trimToTokenBudget(msgs, 25)
    expect(kept).toHaveLength(2)
    expect(kept[0]).toBe(msgs[2])
    expect(kept[1]).toBe(msgs[3])
  })

  it('always keeps at least the most recent message even if it exceeds budget', () => {
    const msgs: Msg[] = [mk('user', 4000)]
    expect(trimToTokenBudget(msgs, 1)).toHaveLength(1)
  })

  it('keeps MORE short turns than a fixed-12 count would', () => {
    const msgs: Msg[] = Array.from({ length: 20 }, (_, i) => mk(i % 2 === 0 ? 'user' : 'assistant', 8))
    // 20 msgs × 2 tokens = 40 tokens, well under budget → all kept (vs a 12 cap)
    expect(trimToTokenBudget(msgs, 1000).length).toBeGreaterThan(12)
  })

  it('ensures the result starts with a user message', () => {
    // budget forces dropping until the leading message would be assistant
    const msgs: Msg[] = [mk('user', 40), mk('assistant', 40), mk('user', 40), mk('assistant', 40)]
    const kept = trimToTokenBudget(msgs, 25) // ~keeps last 2: user(40)+assistant(40)? 20tok → both
    expect(kept[0].role).toBe('user')
  })

  it('handles empty input', () => expect(trimToTokenBudget([], 100)).toEqual([]))

  it('estimateMessagesTokens sums string content', () => {
    expect(estimateMessagesTokens([mk('user', 8), mk('assistant', 8)])).toBe(4)
  })
})
