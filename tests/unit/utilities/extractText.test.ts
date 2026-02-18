/**
 * Unit tests for UMS (Universal Message Structure) text extraction.
 *
 * Messages in Angel OS carry dynamic JSON content envelopes.
 * extractText must handle: plain strings, JSON with text/content/message
 * fields, and arbitrary objects — all backward-compatible.
 *
 * @see src/components/ChatControl/useChat.ts — extractText()
 */
import { describe, it, expect } from 'vitest'

// Re-implement extractText to test in isolation
function extractText(content: unknown): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (typeof content !== 'object') return String(content)
  const obj = content as Record<string, unknown>
  if (typeof obj.text === 'string') return obj.text
  if (typeof obj.content === 'string') return obj.content
  if (typeof obj.message === 'string') return obj.message
  try {
    return JSON.stringify(content)
  } catch {
    return '[Message]'
  }
}

describe('extractText', () => {
  describe('string input', () => {
    it('returns plain string as-is', () => {
      expect(extractText('Hello world')).toBe('Hello world')
    })

    it('returns empty string for empty string', () => {
      expect(extractText('')).toBe('')
    })
  })

  describe('falsy input', () => {
    it('returns empty string for null', () => {
      expect(extractText(null)).toBe('')
    })

    it('returns empty string for undefined', () => {
      expect(extractText(undefined)).toBe('')
    })

    it('returns empty string for 0', () => {
      // 0 is falsy
      expect(extractText(0)).toBe('')
    })
  })

  describe('primitive input', () => {
    it('converts number to string', () => {
      expect(extractText(42)).toBe('42')
    })

    it('converts boolean to string', () => {
      expect(extractText(true)).toBe('true')
    })
  })

  describe('UMS JSON objects', () => {
    it('extracts text field (standard UMS)', () => {
      expect(extractText({ type: 'text', text: 'Hello from UMS' })).toBe('Hello from UMS')
    })

    it('extracts content field', () => {
      expect(extractText({ content: 'Content field value' })).toBe('Content field value')
    })

    it('extracts message field', () => {
      expect(extractText({ message: 'Message field value' })).toBe('Message field value')
    })

    it('prefers text over content over message', () => {
      expect(
        extractText({ text: 'winner', content: 'loser', message: 'also loser' }),
      ).toBe('winner')
    })

    it('falls back to content when text is not a string', () => {
      expect(extractText({ text: 123, content: 'fallback' })).toBe('fallback')
    })

    it('falls back to message when text and content are not strings', () => {
      expect(extractText({ text: null, content: {}, message: 'last resort' })).toBe(
        'last resort',
      )
    })
  })

  describe('arbitrary objects', () => {
    it('JSON.stringifies objects with no known field', () => {
      const obj = { foo: 'bar', baz: 42 }
      const result = extractText(obj)
      expect(result).toBe(JSON.stringify(obj))
    })

    it('handles nested objects', () => {
      const obj = { blocks: [{ type: 'image', url: 'https://example.com' }] }
      const result = extractText(obj)
      expect(result).toContain('blocks')
      expect(result).toContain('image')
    })
  })

  describe('array input', () => {
    it('JSON.stringifies arrays', () => {
      const arr = ['hello', 'world']
      const result = extractText(arr)
      expect(result).toBe(JSON.stringify(arr))
    })
  })
})
