import { describe, it, expect } from 'vitest'
import { formatForDiscord, splitMessage, truncateWithEllipsis } from '@/utilities/discord-formatter'

describe('discord-formatter', () => {
  // ── formatForDiscord ──────────────────────────────────────────────────

  describe('formatForDiscord', () => {
    it('converts # heading to **bold**', () => {
      expect(formatForDiscord('# Hello World')).toBe('**Hello World**')
    })

    it('converts ## and ### headings to **bold**', () => {
      const input = '## Section Title\n\n### Sub-section'
      const result = formatForDiscord(input)
      expect(result).toContain('**Section Title**')
      expect(result).toContain('**Sub-section**')
    })

    it('preserves code blocks (```code```)', () => {
      const input = '# Title\n\n```js\nconst x = 1;\n```'
      const result = formatForDiscord(input)
      expect(result).toContain('```js\nconst x = 1;\n```')
      expect(result).toContain('**Title**')
    })

    it('preserves inline code (`code`)', () => {
      const input = 'Run `npm install` to start'
      expect(formatForDiscord(input)).toBe('Run `npm install` to start')
    })

    it('strips HTML tags', () => {
      const input = '<p>Hello</p> <b>World</b> <img src="x" />'
      const result = formatForDiscord(input)
      expect(result).toBe('Hello World')
      expect(result).not.toContain('<')
      expect(result).not.toContain('>')
    })

    it('returns empty string for empty input', () => {
      expect(formatForDiscord('')).toBe('')
    })

    it('preserves emoji characters', () => {
      const input = 'Hello World! \u{1F680}\u{1F525}\u{2764}\u{FE0F}'
      expect(formatForDiscord(input)).toBe('Hello World! \u{1F680}\u{1F525}\u{2764}\u{FE0F}')
    })
  })

  // ── splitMessage ──────────────────────────────────────────────────────

  describe('splitMessage', () => {
    it('returns single-element array for text under limit', () => {
      const result = splitMessage('Short message')
      expect(result).toEqual(['Short message'])
    })

    it('splits at paragraph boundary (\\n\\n) when available', () => {
      const paragraph1 = 'A'.repeat(900)
      const paragraph2 = 'B'.repeat(900)
      const input = `${paragraph1}\n\n${paragraph2}`
      const result = splitMessage(input, 1000)
      expect(result.length).toBe(2)
      expect(result[0]).toBe(paragraph1)
      expect(result[1]).toBe(paragraph2)
    })

    it('splits at line boundary (\\n) as fallback', () => {
      // Build text with only single newlines, no paragraph breaks in the split zone
      const line1 = 'A'.repeat(800)
      const line2 = 'B'.repeat(100)
      const line3 = 'C'.repeat(800)
      const input = `${line1}\n${line2}\n${line3}`
      const result = splitMessage(input, 1000)
      expect(result.length).toBe(2)
      expect(result[0]).toContain(line1)
      expect(result[1]).toContain(line3)
    })

    it('splits at sentence boundary as second fallback', () => {
      // Build a long string with no newlines but with sentence boundaries
      const sentence1 = 'The quick brown fox jumped over the lazy dog.'
      const sentence2 = ' Another sentence follows here.'
      // Repeat to exceed limit, no newlines
      const input = (sentence1 + sentence2).repeat(50)
      const result = splitMessage(input, 100)
      expect(result.length).toBeGreaterThan(1)
      // Every chunk should be at most 100 chars
      for (const chunk of result) {
        expect(chunk.length).toBeLessThanOrEqual(100)
      }
    })

    it('hard splits at max when no natural boundary exists', () => {
      // Continuous string with no spaces, newlines, or sentence ends
      const input = 'x'.repeat(5000)
      const result = splitMessage(input, 2000)
      expect(result.length).toBeGreaterThan(1)
      for (const chunk of result) {
        expect(chunk.length).toBeLessThanOrEqual(2000)
      }
    })

    it('handles exact boundary (text length === max)', () => {
      const input = 'x'.repeat(2000)
      const result = splitMessage(input, 2000)
      expect(result).toEqual([input])
    })

    it('accepts custom max parameter', () => {
      const input = 'Hello World. This is a test.'
      const result = splitMessage(input, 5)
      expect(result.length).toBeGreaterThan(1)
      for (const chunk of result) {
        expect(chunk.length).toBeLessThanOrEqual(5)
      }
    })

    it('returns empty array for empty input', () => {
      expect(splitMessage('')).toEqual([])
    })
  })

  // ── truncateWithEllipsis ──────────────────────────────────────────────

  describe('truncateWithEllipsis', () => {
    it('returns text unchanged if under limit', () => {
      expect(truncateWithEllipsis('Hello', 100)).toBe('Hello')
    })

    it('truncates with ... if over limit, at word boundary', () => {
      const input = 'The quick brown fox jumped over the lazy dog'
      const result = truncateWithEllipsis(input, 25)
      expect(result).toContain('...')
      expect(result.length).toBeLessThanOrEqual(25)
      // Should end with "..." preceded by a complete word (no partial word cuts)
      expect(result).toBe('The quick brown fox...')
    })

    it('returns text unchanged if exactly at limit', () => {
      const input = 'Exact'
      expect(truncateWithEllipsis(input, 5)).toBe('Exact')
    })

    it('returns empty string for empty input', () => {
      expect(truncateWithEllipsis('', 100)).toBe('')
    })
  })

  // ── Edge cases ────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles unicode/emoji in splitMessage', () => {
      const emoji = '\u{1F680}'.repeat(500) + '\n\n' + '\u{1F525}'.repeat(500)
      const result = splitMessage(emoji, 1500)
      expect(result.length).toBeGreaterThanOrEqual(1)
      // Reassembled chunks should contain all original emoji
      const joined = result.join('')
      expect(joined).toContain('\u{1F680}')
      expect(joined).toContain('\u{1F525}')
    })

    it('formatForDiscord handles null/undefined gracefully (empty string return)', () => {
      // The function checks `if (!text)` so null/undefined should return ''
      expect(formatForDiscord(null as unknown as string)).toBe('')
      expect(formatForDiscord(undefined as unknown as string)).toBe('')
    })
  })
})
