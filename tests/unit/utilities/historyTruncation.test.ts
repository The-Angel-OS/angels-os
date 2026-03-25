/**
 * Phase 7: History Truncation Tests
 *
 * Tests the shared truncateHistoryMessage utility imported by both
 * leo-stream.ts and ConversationEngine.ts.
 */
import { describe, it, expect, beforeAll } from 'vitest'
import {
  truncateHistoryMessage,
  MAX_HISTORY_MESSAGE_CHARS,
  TRUNCATION_SUFFIX,
} from '@/utilities/truncateHistoryMessage'

// Hoisted test data to avoid per-test allocations
const EXACT_2000 = 'a'.repeat(2000)
const LONG_3000 = 'a'.repeat(3000)
const LONG_5000 = 'a'.repeat(5000)

describe('History Message Truncation', () => {
  it('passes through short messages unchanged', () => {
    const short = 'Hello, how can I help you today?'
    expect(truncateHistoryMessage(short)).toBe(short)
  })

  it('passes through messages exactly at limit unchanged', () => {
    expect(truncateHistoryMessage(EXACT_2000)).toBe(EXACT_2000)
  })

  it('truncates messages over limit with suffix', () => {
    const result = truncateHistoryMessage(LONG_3000)
    expect(result.length).toBe(MAX_HISTORY_MESSAGE_CHARS + TRUNCATION_SUFFIX.length)
    expect(result.startsWith('a'.repeat(100))).toBe(true) // First chars preserved
    expect(result.endsWith(TRUNCATION_SUFFIX)).toBe(true)
  })

  it('handles empty string', () => {
    expect(truncateHistoryMessage('')).toBe('')
  })

  it('preserves first MAX_HISTORY_MESSAGE_CHARS chars', () => {
    const long = 'IMPORTANT_START' + 'x'.repeat(3000)
    expect(truncateHistoryMessage(long)).toContain('IMPORTANT_START')
  })
})

describe('Truncation with realistic content', () => {
  it('truncates long tool result text', () => {
    const toolResult = Array.from({ length: 50 }, (_, i) =>
      `Product ${i + 1}: Widget ${i + 1} — $${(i + 1) * 9.99} — In stock`,
    ).join('\n')

    const result = truncateHistoryMessage(toolResult)
    expect(result).toContain('Product 1:')
    expect(result).toContain(TRUNCATION_SUFFIX)
  })

  it('truncates long JSON tool results', () => {
    const json = JSON.stringify({
      products: Array.from({ length: 100 }, (_, i) => ({
        id: i, name: `Product ${i}`, price: i * 10,
      })),
    })

    expect(truncateHistoryMessage(json)).toContain(TRUNCATION_SUFFIX)
  })

  it('preserves short user messages unchanged', () => {
    const msg = 'Create a product called "Angel Wings Necklace" priced at $49.99'
    expect(truncateHistoryMessage(msg)).toBe(msg)
  })

  it('preserves normal LEO responses unchanged', () => {
    const response = "I've created the product. Would you like me to publish it?"
    expect(truncateHistoryMessage(response)).toBe(response)
  })
})

describe('URL handling in truncation', () => {
  it('preserves URLs within first 2000 chars', () => {
    const withUrl = 'URL: https://example.blob.vercel-storage.com/image.png\n' + LONG_3000
    expect(truncateHistoryMessage(withUrl)).toContain('vercel-storage.com/image.png')
  })

  it('loses URLs beyond truncation boundary', () => {
    const lateUrl = 'x'.repeat(2500) + '\nURL: https://example.com/late.png'
    expect(truncateHistoryMessage(lateUrl)).not.toContain('late.png')
  })
})

describe('Exported constants', () => {
  it('MAX_HISTORY_MESSAGE_CHARS is 2000', () => {
    expect(MAX_HISTORY_MESSAGE_CHARS).toBe(2000)
  })

  it('TRUNCATION_SUFFIX is descriptive and concise', () => {
    expect(TRUNCATION_SUFFIX).toContain('truncated')
    expect(TRUNCATION_SUFFIX.length).toBeLessThan(100)
  })
})

describe('Both engines import from shared utility', () => {
  // Now that the function is exported from a shared utility, we verify
  // both consumers actually import it (not redefine it locally)
  let leoStream: string
  let convEngine: string

  beforeAll(async () => {
    const { readFileSync } = await import('fs')
    leoStream = readFileSync('src/endpoints/leo-stream.ts', 'utf-8')
    convEngine = readFileSync('src/utilities/ConversationEngine.ts', 'utf-8')
  })

  it('leo-stream.ts imports truncateHistoryMessage', () => {
    expect(leoStream).toContain("import { truncateHistoryMessage } from")
  })

  it('ConversationEngine.ts imports truncateHistoryMessage', () => {
    expect(convEngine).toContain("import { truncateHistoryMessage } from")
  })

  it('neither engine defines MAX_HISTORY_MESSAGE_CHARS locally', () => {
    expect(leoStream).not.toContain('const MAX_HISTORY_MESSAGE_CHARS')
    expect(convEngine).not.toContain('const MAX_HISTORY_MESSAGE_CHARS')
  })
})
