/**
 * Library works (souls) registry — every registered work is well-formed and the
 * expected works are present.
 */
import { describe, it, expect } from 'vitest'
import { SOULS, getSoul, getAllSouls } from '@/souls'

describe('souls registry', () => {
  it('registers the expected works including answer53 and wdeg', () => {
    const ids = Object.keys(SOULS)
    // 'rainmaker' was deliberately unpublished on 260710 (active legal matter) —
    // removed from the registry, not lost. Re-add it here if it is ever restored.
    expect(ids).toEqual(expect.arrayContaining(['wdeg', 'answer53', 'ready-player-everyone']))
  })

  it('getSoul returns a manifest by id and null for unknown', () => {
    expect(getSoul('answer53')?.id).toBe('answer53')
    expect(getSoul('does-not-exist')).toBeNull()
  })

  it('every work is well-formed (id, title, defaultDoc resolvable, non-empty docs)', () => {
    for (const soul of getAllSouls()) {
      expect(soul.id).toBeTruthy()
      expect(soul.title).toBeTruthy()
      expect(Array.isArray(soul.docs)).toBe(true)
      expect(soul.docs.length).toBeGreaterThan(0)
      // defaultDoc must point at a real doc
      expect(soul.docs.some((d) => d.id === soul.defaultDoc)).toBe(true)
      // every doc has the fields the viewer reads
      for (const doc of soul.docs) {
        expect(doc.id).toBeTruthy()
        expect(doc.filename).toMatch(/\.md$/)
        expect(doc.title).toBeTruthy()
      }
    }
  })

  it('answer53 has its 12 chapters plus the about doc', () => {
    const a53 = getSoul('answer53')!
    expect(a53.bookSlug).toBeUndefined() // markdown-doc work, not a paged book
    expect(a53.docs.length).toBe(13) // about + 12 chapters
    expect(a53.docs.filter((d) => d.tier === 'chapter').length).toBe(10)
  })
})
