/**
 * Phase 7: History Truncation Tests
 *
 * Tests the message truncation logic used in both leo-stream.ts and ConversationEngine.ts
 * to prevent context bloat from long tool results being echoed back in history.
 *
 * The truncation rule:
 *   if (content.length > MAX_HISTORY_MESSAGE_CHARS)
 *     content = content.slice(0, MAX_HISTORY_MESSAGE_CHARS) + '\n\n[...truncated for context efficiency]'
 *
 * MAX_HISTORY_MESSAGE_CHARS = 2000
 */
import { describe, it, expect } from 'vitest'

// ─── Replicate the truncation logic (pure function) ──────────

const MAX_HISTORY_MESSAGE_CHARS = 2000
const TRUNCATION_SUFFIX = '\n\n[...truncated for context efficiency]'

function truncateHistoryMessage(content: string): string {
  if (content.length > MAX_HISTORY_MESSAGE_CHARS) {
    return content.slice(0, MAX_HISTORY_MESSAGE_CHARS) + TRUNCATION_SUFFIX
  }
  return content
}

// ═══════════════════════════════════════════════════════════════
// Basic truncation behavior
// ═══════════════════════════════════════════════════════════════

describe('History Message Truncation', () => {
  it('passes through messages under 2000 chars unchanged', () => {
    const short = 'Hello, how can I help you today?'
    expect(truncateHistoryMessage(short)).toBe(short)
  })

  it('passes through messages exactly 2000 chars unchanged', () => {
    const exact = 'a'.repeat(2000)
    expect(truncateHistoryMessage(exact)).toBe(exact)
  })

  it('truncates messages over 2000 chars', () => {
    const long = 'a'.repeat(3000)
    const result = truncateHistoryMessage(long)
    expect(result.length).toBeLessThan(long.length)
    expect(result).toContain('[...truncated')
  })

  it('preserves first 2000 chars of truncated content', () => {
    const long = 'IMPORTANT_START' + 'x'.repeat(3000)
    const result = truncateHistoryMessage(long)
    expect(result.startsWith('IMPORTANT_START')).toBe(true)
  })

  it('appends truncation suffix', () => {
    const long = 'a'.repeat(3000)
    const result = truncateHistoryMessage(long)
    expect(result.endsWith(TRUNCATION_SUFFIX)).toBe(true)
  })

  it('total truncated length is 2000 + suffix length', () => {
    const long = 'a'.repeat(5000)
    const result = truncateHistoryMessage(long)
    expect(result.length).toBe(2000 + TRUNCATION_SUFFIX.length)
  })

  it('handles empty string', () => {
    expect(truncateHistoryMessage('')).toBe('')
  })

  it('handles single character', () => {
    expect(truncateHistoryMessage('x')).toBe('x')
  })
})

// ═══════════════════════════════════════════════════════════════
// Content-type specific truncation
// ═══════════════════════════════════════════════════════════════

describe('Truncation with realistic content', () => {
  it('truncates long tool result text', () => {
    // Simulate a tool result like query_products returning 50 products
    const toolResult = Array.from({ length: 50 }, (_, i) =>
      `Product ${i + 1}: Widget ${i + 1} — $${(i + 1) * 9.99} — In stock`,
    ).join('\n')
    expect(toolResult.length).toBeGreaterThan(2000)

    const result = truncateHistoryMessage(toolResult)
    expect(result.length).toBeLessThan(toolResult.length)
    expect(result).toContain('Product 1:') // First items preserved
    expect(result).toContain('[...truncated')
  })

  it('truncates long JSON tool results', () => {
    const json = JSON.stringify({
      products: Array.from({ length: 100 }, (_, i) => ({
        id: i,
        name: `Product ${i}`,
        price: i * 10,
        description: `A great product number ${i} with many features`,
      })),
    })
    expect(json.length).toBeGreaterThan(2000)

    const result = truncateHistoryMessage(json)
    expect(result).toContain('[...truncated')
    // The truncated JSON won't be valid, but that's expected
  })

  it('preserves short user messages unchanged', () => {
    const userMsg = 'Create a product called "Angel Wings Necklace" priced at $49.99'
    expect(truncateHistoryMessage(userMsg)).toBe(userMsg)
  })

  it('preserves normal LEO responses unchanged', () => {
    const response =
      "I've created the product 'Angel Wings Necklace' priced at $49.99. " +
      "It's been added to your catalog as a draft. Would you like me to publish it?"
    expect(truncateHistoryMessage(response)).toBe(response)
  })

  it('truncates very long image generation results', () => {
    // Image gen tools return URLs + descriptions that could be long
    const imageResult =
      'Generated image: https://example.blob.vercel-storage.com/images/generated-12345.png\n' +
      'Description: ' + 'A beautiful sunset over the ocean '.repeat(100)
    expect(imageResult.length).toBeGreaterThan(2000)

    const result = truncateHistoryMessage(imageResult)
    expect(result).toContain('Generated image:') // URL preserved in first 2000 chars
    expect(result).toContain('[...truncated')
  })
})

// ═══════════════════════════════════════════════════════════════
// URL preservation in truncated content
// ═══════════════════════════════════════════════════════════════

describe('URL handling in truncation', () => {
  it('preserves URLs that appear within first 2000 chars', () => {
    const withUrl =
      'URL: https://example.blob.vercel-storage.com/media/image.png\n' +
      'x'.repeat(3000)
    const result = truncateHistoryMessage(withUrl)
    expect(result).toContain('https://example.blob.vercel-storage.com/media/image.png')
  })

  it('loses URLs that appear after 2000 chars', () => {
    const lateUrl = 'x'.repeat(2500) + '\nURL: https://example.com/late-image.png'
    const result = truncateHistoryMessage(lateUrl)
    expect(result).not.toContain('late-image.png')
  })
})

// ═══════════════════════════════════════════════════════════════
// Constants verification
// ═══════════════════════════════════════════════════════════════

describe('Truncation constants', () => {
  it('MAX_HISTORY_MESSAGE_CHARS is 2000', () => {
    expect(MAX_HISTORY_MESSAGE_CHARS).toBe(2000)
  })

  it('truncation suffix is descriptive', () => {
    expect(TRUNCATION_SUFFIX).toContain('truncated')
    expect(TRUNCATION_SUFFIX).toContain('context')
  })

  it('truncation suffix is not excessively long', () => {
    expect(TRUNCATION_SUFFIX.length).toBeLessThan(100)
  })
})

// ═══════════════════════════════════════════════════════════════
// Consistency between leo-stream.ts and ConversationEngine.ts
// ═══════════════════════════════════════════════════════════════

describe('Truncation consistency across engines', () => {
  it('both engines use the same MAX_HISTORY_MESSAGE_CHARS value', async () => {
    // Read both files and verify the constant is the same
    const { readFileSync } = await import('fs')
    const leoStream = readFileSync('src/endpoints/leo-stream.ts', 'utf-8')
    const convEngine = readFileSync('src/utilities/ConversationEngine.ts', 'utf-8')

    // Both should define MAX_HISTORY_MESSAGE_CHARS = 2000
    expect(leoStream).toContain('MAX_HISTORY_MESSAGE_CHARS = 2000')
    expect(convEngine).toContain('MAX_HISTORY_MESSAGE_CHARS = 2000')
  })

  it('both engines use the same truncation suffix', async () => {
    const { readFileSync } = await import('fs')
    const leoStream = readFileSync('src/endpoints/leo-stream.ts', 'utf-8')
    const convEngine = readFileSync('src/utilities/ConversationEngine.ts', 'utf-8')

    // Both should use the same suffix string
    expect(leoStream).toContain('[...truncated for context efficiency]')
    expect(convEngine).toContain('[...truncated for context efficiency]')
  })

  it('both engines use the same MAX_HISTORY_TURNS value', async () => {
    const { readFileSync } = await import('fs')
    const leoStream = readFileSync('src/endpoints/leo-stream.ts', 'utf-8')
    const convEngine = readFileSync('src/utilities/ConversationEngine.ts', 'utf-8')

    expect(leoStream).toContain('MAX_HISTORY_TURNS = 12')
    expect(convEngine).toContain('MAX_HISTORY_TURNS = 12')
  })
})
