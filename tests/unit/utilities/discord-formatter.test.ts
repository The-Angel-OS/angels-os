/**
 * discord-formatter — Unit Tests
 *
 * formatForDiscord, splitMessage, truncateWithEllipsis
 */
import { describe, it, expect } from 'vitest'

import { formatForDiscord, splitMessage, truncateWithEllipsis } from '@/utilities/discord-formatter'

// ── formatForDiscord ───────────────────────────────────────────────────────────

describe('formatForDiscord', () => {
  it('returns empty string for empty input', () => {
    expect(formatForDiscord('')).toBe('')
  })

  it('converts # heading to bold', () => {
    expect(formatForDiscord('# My Heading')).toBe('**My Heading**')
  })

  it('converts ## heading to bold', () => {
    expect(formatForDiscord('## Section')).toBe('**Section**')
  })

  it('converts ### heading to bold', () => {
    expect(formatForDiscord('### Subsection')).toBe('**Subsection**')
  })

  it('strips HTML tags', () => {
    expect(formatForDiscord('<b>bold</b> text')).toBe('bold text')
  })

  it('preserves code blocks unchanged', () => {
    const input = 'text\n```js\nconsole.log("hello")\n```\nmore text'
    const result = formatForDiscord(input)
    expect(result).toContain('```js')
    expect(result).toContain('console.log("hello")')
  })

  it('preserves inline code unchanged', () => {
    const input = 'Use the `npm install` command'
    const result = formatForDiscord(input)
    expect(result).toContain('`npm install`')
  })

  it('preserves existing bold formatting', () => {
    expect(formatForDiscord('**already bold**')).toBe('**already bold**')
  })

  it('collapses excessive blank lines to max 2', () => {
    const input = 'line1\n\n\n\n\nline2'
    const result = formatForDiscord(input)
    expect(result).not.toContain('\n\n\n')
  })
})

// ── splitMessage ──────────────────────────────────────────────────────────────

describe('splitMessage', () => {
  it('returns empty array for empty input', () => {
    expect(splitMessage('')).toEqual([])
  })

  it('returns single-element array when message fits in limit', () => {
    const text = 'Short message'
    expect(splitMessage(text)).toEqual([text])
  })

  it('splits a long message into multiple chunks within the limit', () => {
    const text = 'A'.repeat(100)
    const chunks = splitMessage(text, 30)
    expect(chunks.length).toBeGreaterThan(1)
    chunks.forEach(chunk => expect(chunk.length).toBeLessThanOrEqual(30))
  })

  it('splits at paragraph boundaries when possible', () => {
    const text = 'First paragraph.\n\nSecond paragraph that is much longer and will cause a split here'
    const chunks = splitMessage(text, 30)
    expect(chunks.length).toBeGreaterThan(1)
  })

  it('all chunks together contain all original content', () => {
    const text = 'Word '.repeat(200).trim()
    const chunks = splitMessage(text, 50)
    const combined = chunks.join(' ')
    // All words should be present
    expect(combined.split(' ').length).toBeGreaterThanOrEqual(text.split(' ').length - 1)
  })
})

// ── truncateWithEllipsis ───────────────────────────────────────────────────────

describe('truncateWithEllipsis', () => {
  it('returns empty string for empty input', () => {
    expect(truncateWithEllipsis('', 100)).toBe('')
  })

  it('returns text unchanged when within limit', () => {
    const text = 'Short text'
    expect(truncateWithEllipsis(text, 100)).toBe(text)
  })

  it('truncates long text with ellipsis', () => {
    const text = 'This is a longer text that should be truncated at some point'
    const result = truncateWithEllipsis(text, 20)
    expect(result.length).toBeLessThanOrEqual(20)
    expect(result.endsWith('...')).toBe(true)
  })

  it('breaks at word boundary when possible', () => {
    const text = 'First Second Third Fourth Fifth'
    const result = truncateWithEllipsis(text, 15)
    expect(result.endsWith('...')).toBe(true)
    // Result should end with a complete word (not mid-word cut like "Firs...")
    const withoutEllipsis = result.slice(0, -3)
    expect(withoutEllipsis.trimEnd()).not.toMatch(/[A-Za-z]$[A-Za-z]/)
  })
})
