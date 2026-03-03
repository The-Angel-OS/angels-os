/**
 * angelTokens — Unit Tests
 *
 * Pure functions: generateAngelTokenId, createAngelTokenEntry
 */
import { describe, it, expect } from 'vitest'

import { generateAngelTokenId, createAngelTokenEntry } from '@/utilities/angelTokens'

// ── generateAngelTokenId ───────────────────────────────────────────────────────

describe('generateAngelTokenId', () => {
  it('returns a string starting with AT-', () => {
    const id = generateAngelTokenId()
    expect(id.startsWith('AT-')).toBe(true)
  })

  it('includes the current year', () => {
    const year = new Date().getFullYear().toString()
    const id = generateAngelTokenId()
    expect(id).toContain(year)
  })

  it('matches pattern AT-YYYY-NNNNN', () => {
    const id = generateAngelTokenId()
    expect(id).toMatch(/^AT-\d{4}-\d{5}$/)
  })

  it('increments on each call', () => {
    const a = generateAngelTokenId()
    const b = generateAngelTokenId()
    const seqA = parseInt(a.split('-')[2]!, 10)
    const seqB = parseInt(b.split('-')[2]!, 10)
    expect(seqB).toBeGreaterThan(seqA)
  })
})

// ── createAngelTokenEntry ──────────────────────────────────────────────────────

describe('createAngelTokenEntry', () => {
  it('returns an object with required fields', () => {
    const entry = createAngelTokenEntry({ orderItemIndex: 0, requiredSkills: ['welding'] })
    expect(entry.orderItemIndex).toBe(0)
    expect(entry.fulfillmentStatus).toBe('pending_match')
    expect(entry.tokenStatus).toBe('active')
    expect(typeof entry.angelTokenId).toBe('string')
    expect(typeof entry.queuedAt).toBe('string')
    expect(typeof entry.queueReason).toBe('string')
  })

  it('includes required skills in queueReason', () => {
    const entry = createAngelTokenEntry({ orderItemIndex: 1, requiredSkills: ['welding', 'painting'] })
    expect(entry.queueReason).toContain('welding')
    expect(entry.queueReason).toContain('painting')
  })

  it('uses "general manufacturing" when no skills provided', () => {
    const entry = createAngelTokenEntry({ orderItemIndex: 0, requiredSkills: [] })
    expect(entry.queueReason).toContain('general manufacturing')
  })

  it('includes selectedConfiguration when provided', () => {
    const config = { color: 'red', size: 'L' }
    const entry = createAngelTokenEntry({ orderItemIndex: 0, requiredSkills: [], selectedConfiguration: config })
    expect(entry.selectedConfiguration).toEqual(config)
  })

  it('omits selectedConfiguration when not provided', () => {
    const entry = createAngelTokenEntry({ orderItemIndex: 0, requiredSkills: [] })
    expect(entry).not.toHaveProperty('selectedConfiguration')
  })

  it('generates a valid AT- token ID', () => {
    const entry = createAngelTokenEntry({ orderItemIndex: 0, requiredSkills: [] })
    expect(entry.angelTokenId).toMatch(/^AT-\d{4}-\d{5}$/)
  })

  it('queuedAt is a valid ISO date string', () => {
    const entry = createAngelTokenEntry({ orderItemIndex: 0, requiredSkills: [] })
    expect(() => new Date(entry.queuedAt)).not.toThrow()
    expect(new Date(entry.queuedAt).getFullYear()).toBeGreaterThan(2020)
  })
})
