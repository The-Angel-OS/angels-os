/**
 * bookManifestServer — deep-link slug inference + resolution.
 *
 * Runs against the committed WDEG book (public/library/wdeg), so it doubles as a
 * guard that the live book still loads + infers clean chapter slugs.
 */
import { describe, it, expect } from 'vitest'
import { loadBookFromPublic, resolvePageIndex, pageExcerpt } from '@/components/Library/bookManifestServer'

describe('bookManifestServer — WDEG', () => {
  const loaded = loadBookFromPublic('wdeg')

  it('loads the manifest with all pages', () => {
    expect(loaded).not.toBeNull()
    expect(loaded!.manifest.pages.length).toBe(26)
    expect(loaded!.baseLanguage).toBe('en')
  })

  it('infers a clean chapter-name slug from the first line of each page', () => {
    expect(loaded!.pageSlugs[0]).toBe('1-somethings-wrong-with-the-world')
    expect(loaded!.pageTitles[0]).toMatch(/Something/i)
    // every slug starts with its 1-based page number
    loaded!.pageSlugs.forEach((s, i) => expect(s.startsWith(`${i + 1}`)).toBe(true))
  })

  it('resolves a <n>-<name> param by its leading number, ignoring the name', () => {
    expect(resolvePageIndex(loaded!, '11-anything-here')).toBe(10)
    expect(resolvePageIndex(loaded!, '1-somethings-wrong-with-the-world')).toBe(0)
    expect(resolvePageIndex(loaded!, '26')).toBe(25)
  })

  it('clamps out-of-range / missing params to page 0', () => {
    expect(resolvePageIndex(loaded!, '999-nope')).toBe(0)
    expect(resolvePageIndex(loaded!, 'garbage')).toBe(0)
    expect(resolvePageIndex(loaded!, undefined)).toBe(0)
  })

  it('builds a non-empty page description from the body, not the title', () => {
    const excerpt = pageExcerpt(loaded!.baseText['1'])
    expect(excerpt.length).toBeGreaterThan(10)
    expect(excerpt.length).toBeLessThanOrEqual(156)
    expect(excerpt).not.toBe(loaded!.pageTitles[0])
  })

  it('returns null for an unknown book slug', () => {
    expect(loadBookFromPublic('does-not-exist')).toBeNull()
  })
})
