/**
 * Discord Bot Utility Functions — Unit Tests
 *
 * Tests the three exported utility functions from src/discord/bot.ts:
 *   splitResponse, shouldRespond, buildPayload
 *
 * Sprint 33 — Discord Integration
 */

import { describe, it, expect } from 'vitest'
import { splitResponse, shouldRespond, buildPayload } from '@/discord/bot'

// ─── splitResponse ──────────────────────────────────────────

describe('splitResponse', () => {
  it('returns a single-element array for text under 2000 chars', () => {
    const text = 'Hello, world!'
    const result = splitResponse(text)
    expect(result).toEqual(['Hello, world!'])
    expect(result).toHaveLength(1)
  })

  it('splits at paragraph boundary (\\n\\n) for text over 2000 chars', () => {
    // Build a string with two paragraphs — first paragraph is ~1900 chars, then \n\n, then more
    const para1 = 'A'.repeat(1900)
    const para2 = 'B'.repeat(500)
    const text = `${para1}\n\n${para2}`

    const result = splitResponse(text)
    expect(result.length).toBeGreaterThanOrEqual(2)
    // First chunk should be the first paragraph (trimmed)
    expect(result[0]).toBe(para1)
    // Second chunk should be the second paragraph
    expect(result[1]).toBe(para2)
  })

  it('splits at newline boundary as fallback when no paragraph break exists', () => {
    // Build a string with single newlines but no \n\n
    const line1 = 'C'.repeat(1900)
    const line2 = 'D'.repeat(500)
    const text = `${line1}\n${line2}`

    const result = splitResponse(text)
    expect(result.length).toBeGreaterThanOrEqual(2)
    expect(result[0]).toBe(line1)
    expect(result[1]).toBe(line2)
  })

  it('hard splits very long lines with no whitespace', () => {
    const text = 'X'.repeat(5000)
    const result = splitResponse(text)
    expect(result.length).toBeGreaterThanOrEqual(3)
    // Each chunk should be at most 2000 chars
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(2000)
    }
    // Total content should be preserved
    expect(result.join('')).toBe(text)
  })

  it("returns [''] for empty input", () => {
    expect(splitResponse('')).toEqual([''])
  })
})

// ─── shouldRespond ──────────────────────────────────────────

describe('shouldRespond', () => {
  it('returns true for DMs (isDM=true)', () => {
    expect(shouldRespond(true, false, 'general')).toBe(true)
  })

  it('returns true when bot is mentioned (isMentioned=true)', () => {
    expect(shouldRespond(false, true, 'general')).toBe(true)
  })

  it("returns true when channel matches default leoChannelName ('leo')", () => {
    expect(shouldRespond(false, false, 'leo')).toBe(true)
  })

  it('returns false for random channel with no mention and not DM', () => {
    expect(shouldRespond(false, false, 'random')).toBe(false)
  })

  it('uses custom leoChannelName when provided', () => {
    // Should NOT match default 'leo'
    expect(shouldRespond(false, false, 'leo', 'ask-leo')).toBe(false)
    // Should match custom channel name
    expect(shouldRespond(false, false, 'ask-leo', 'ask-leo')).toBe(true)
  })
})

// ─── buildPayload ───────────────────────────────────────────

describe('buildPayload', () => {
  const baseOpts = {
    type: 'message' as const,
    content: 'Hello LEO',
    connectorId: 'conn-1',
    guildId: 'guild-123',
    channelId: 'ch-456',
    channelName: 'general',
    userId: 'user-789',
    userName: 'TestUser',
    isDM: false,
  }

  it('returns correct shape for a message', () => {
    const payload = buildPayload(baseOpts)
    expect(payload).toEqual({
      type: 'message',
      content: 'Hello LEO',
      connectorId: 'conn-1',
      guildId: 'guild-123',
      channelId: 'ch-456',
      channelName: 'general',
      userId: 'user-789',
      userName: 'TestUser',
      isDM: false,
    })
  })

  it('returns correct shape for a slash command with commandName', () => {
    const payload = buildPayload({
      ...baseOpts,
      type: 'slash_command',
      commandName: 'ask',
    })
    expect(payload.type).toBe('slash_command')
    expect(payload.commandName).toBe('ask')
  })

  it('sets isDM correctly', () => {
    const dmPayload = buildPayload({ ...baseOpts, isDM: true })
    expect(dmPayload.isDM).toBe(true)

    const guildPayload = buildPayload({ ...baseOpts, isDM: false })
    expect(guildPayload.isDM).toBe(false)
  })

  it('passes connectorId through', () => {
    const payload = buildPayload({ ...baseOpts, connectorId: 'tenant-abc-connector' })
    expect(payload.connectorId).toBe('tenant-abc-connector')
  })

  it('handles null guildId for DMs', () => {
    const payload = buildPayload({ ...baseOpts, guildId: null, isDM: true })
    expect(payload.guildId).toBeNull()
    expect(payload.isDM).toBe(true)
  })
})

// ─── BotManager conceptual tests (data flow via exported utilities) ──

describe('BotManager conceptual tests', () => {
  it('splitResponse preserves paragraph structure', () => {
    const paragraphs = [
      'First paragraph with some content.',
      'Second paragraph with different content.',
      'Third paragraph wrapping up.',
    ]
    const text = paragraphs.join('\n\n')
    const result = splitResponse(text)
    // All three paragraphs fit in one chunk (well under 2000)
    expect(result).toHaveLength(1)
    expect(result[0]).toContain('First paragraph')
    expect(result[0]).toContain('Second paragraph')
    expect(result[0]).toContain('Third paragraph')
  })

  it('splitResponse with custom max (e.g., max=100)', () => {
    const text = 'Word '.repeat(50) // 250 chars
    const result = splitResponse(text.trim(), 100)
    expect(result.length).toBeGreaterThanOrEqual(3)
    for (const chunk of result) {
      expect(chunk.length).toBeLessThanOrEqual(100)
    }
  })

  it("shouldRespond default leoChannelName is 'leo'", () => {
    // When no custom channel name provided, 'leo' should match
    expect(shouldRespond(false, false, 'leo')).toBe(true)
    // Other channels should not
    expect(shouldRespond(false, false, 'general')).toBe(false)
    expect(shouldRespond(false, false, 'help')).toBe(false)
  })

  it('buildPayload includes all required fields', () => {
    const payload = buildPayload({
      type: 'message',
      content: 'test',
      connectorId: 'c1',
      guildId: 'g1',
      channelId: 'ch1',
      channelName: 'leo',
      userId: 'u1',
      userName: 'Tester',
      isDM: false,
    })

    const requiredKeys = [
      'type',
      'content',
      'connectorId',
      'guildId',
      'channelId',
      'channelName',
      'userId',
      'userName',
      'isDM',
    ]
    for (const key of requiredKeys) {
      expect(payload).toHaveProperty(key)
    }
  })

  it('splitResponse handles text with only newlines', () => {
    const text = '\n\n\n\n\n'
    const result = splitResponse(text)
    // After trimming, all chunks that are empty get filtered out
    // The input is non-empty but after trim+filter it should be empty array or ['']
    // Since text is truthy and text.length <= 2000, it returns [text]
    // then no further splitting needed
    expect(result).toHaveLength(1)
    expect(result[0]).toBe('\n\n\n\n\n')
  })
})
