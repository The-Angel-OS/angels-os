/**
 * translationCache — Unit Tests
 *
 * Tests pure, synchronous functions that operate on the in-memory cache:
 * getCacheStats, invalidateCache, getCachedTranslation, setCachedTranslation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/services/BusinessAgent', () => ({
  BusinessAgentFactory: {
    createForTenant: vi.fn(),
  },
}))

vi.mock('payload', () => ({
  getPayload: vi.fn(),
}))

vi.mock('@payload-config', () => ({ default: {} }))

import {
  getCacheStats,
  invalidateCache,
  getCachedTranslation,
  setCachedTranslation,
} from '@/utilities/translationCache'

// ── Helpers ────────────────────────────────────────────────────────────────────

const KEY = {
  contentType: 'product' as const,
  contentId: 'prod-1',
  language: 'es',
  tenantId: 'tenant-abc',
}

// ── getCacheStats ──────────────────────────────────────────────────────────────

describe('getCacheStats', () => {
  beforeEach(() => { invalidateCache() })

  it('returns zero totalEntries when cache is empty', () => {
    expect(getCacheStats().totalEntries).toBe(0)
  })

  it('returns empty arrays for languages and tenants when empty', () => {
    const stats = getCacheStats()
    expect(stats.languages).toHaveLength(0)
    expect(stats.tenants).toHaveLength(0)
  })

  it('returns null for oldestEntry and newestEntry when empty', () => {
    const stats = getCacheStats()
    expect(stats.oldestEntry).toBeNull()
    expect(stats.newestEntry).toBeNull()
  })

  it('returns correct totalEntries after adding entries', async () => {
    await setCachedTranslation('hello', 'hola', KEY)
    expect(getCacheStats().totalEntries).toBe(1)
  })

  it('tracks language in stats', async () => {
    await setCachedTranslation('hello', 'hola', KEY)
    expect(getCacheStats().languages).toContain('es')
  })

  it('tracks tenant in stats', async () => {
    await setCachedTranslation('hello', 'hola', KEY)
    expect(getCacheStats().tenants).toContain('tenant-abc')
  })

  it('returns non-null oldestEntry after adding an entry', async () => {
    await setCachedTranslation('hello', 'hola', KEY)
    expect(getCacheStats().oldestEntry).toBeInstanceOf(Date)
  })

  it('counts multiple entries correctly', async () => {
    await setCachedTranslation('a', 'b', { ...KEY, contentId: 'p1' })
    await setCachedTranslation('c', 'd', { ...KEY, contentId: 'p2' })
    expect(getCacheStats().totalEntries).toBe(2)
  })
})

// ── invalidateCache ────────────────────────────────────────────────────────────

describe('invalidateCache', () => {
  beforeEach(() => { invalidateCache() })

  it('returns 0 when cache is already empty', () => {
    expect(invalidateCache()).toBe(0)
  })

  it('clears all entries and returns count when called without pattern', async () => {
    await setCachedTranslation('a', 'b', { ...KEY, contentId: 'p1' })
    await setCachedTranslation('c', 'd', { ...KEY, contentId: 'p2' })
    expect(invalidateCache()).toBe(2)
    expect(getCacheStats().totalEntries).toBe(0)
  })

  it('removes only matching entries when pattern is provided', async () => {
    await setCachedTranslation('a', 'b', { ...KEY, contentId: 'match-me' })
    await setCachedTranslation('c', 'd', { ...KEY, contentId: 'other' })
    const removed = invalidateCache('match-me')
    expect(removed).toBe(1)
    expect(getCacheStats().totalEntries).toBe(1)
  })

  it('returns 0 when pattern matches nothing', async () => {
    await setCachedTranslation('a', 'b', KEY)
    expect(invalidateCache('no-such-pattern')).toBe(0)
  })

  it('is idempotent — second call on empty cache returns 0', () => {
    invalidateCache()
    expect(invalidateCache()).toBe(0)
  })
})

// ── getCachedTranslation / setCachedTranslation ────────────────────────────────

describe('getCachedTranslation + setCachedTranslation', () => {
  beforeEach(() => { invalidateCache() })

  it('returns null for a key that has never been set', async () => {
    const result = await getCachedTranslation('hello', KEY)
    expect(result).toBeNull()
  })

  it('returns the cached translation after it is set', async () => {
    await setCachedTranslation('hello', 'hola', KEY)
    const result = await getCachedTranslation('hello', KEY)
    expect(result).toBe('hola')
  })

  it('returns null when content hash does not match (content changed)', async () => {
    await setCachedTranslation('hello', 'hola', KEY)
    // Ask for a different original content → hash mismatch
    const result = await getCachedTranslation('goodbye', KEY)
    expect(result).toBeNull()
  })

  it('invalidates entry when content changes (cache is cleared for that key)', async () => {
    await setCachedTranslation('hello', 'hola', KEY)
    await getCachedTranslation('goodbye', KEY) // triggers invalidation
    // Now original 'hello' mapping is gone, so re-fetching returns null
    const result = await getCachedTranslation('hello', KEY)
    expect(result).toBeNull()
  })

  it('supports object content', async () => {
    const original = { name: 'Widget', price: 100 }
    const translated = { name: 'Widget ES', price: 100 }
    await setCachedTranslation(original, translated, KEY)
    const result = await getCachedTranslation(original, KEY)
    expect(result).toEqual(translated)
  })

  it('differentiates keys by language', async () => {
    const esKey = { ...KEY, language: 'es' }
    const frKey = { ...KEY, language: 'fr' }
    await setCachedTranslation('hello', 'hola', esKey)
    await setCachedTranslation('hello', 'bonjour', frKey)
    expect(await getCachedTranslation('hello', esKey)).toBe('hola')
    expect(await getCachedTranslation('hello', frKey)).toBe('bonjour')
  })

  it('differentiates keys by contentId', async () => {
    const key1 = { ...KEY, contentId: 'p1' }
    const key2 = { ...KEY, contentId: 'p2' }
    await setCachedTranslation('text-A', 'trans-A', key1)
    await setCachedTranslation('text-B', 'trans-B', key2)
    expect(await getCachedTranslation('text-A', key1)).toBe('trans-A')
    expect(await getCachedTranslation('text-B', key2)).toBe('trans-B')
  })
})
