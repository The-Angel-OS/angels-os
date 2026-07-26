/**
 * bookManifestServer — deep-link slug inference + resolution.
 *
 * This used to run against the committed WDEG book in public/library/wdeg. That
 * directory was deleted when Works moved to DB + Blob only (51d90bc), so the
 * suite spent weeks asserting `expect(loaded).not.toBeNull()` against a book
 * that no longer existed. The loader is still live — /learn/<soul> calls it,
 * with a CDN-origin fallback — so the logic worth guarding is the slug/excerpt
 * inference, which is now exercised directly instead of through whatever
 * happens to be on disk.
 */
import { describe, it, expect } from 'vitest'
import {
  buildLoadedBook,
  loadBookFromPublic,
  resolvePageIndex,
  pageExcerpt,
} from '@/components/Library/bookManifestServer'
import type { BookManifest } from '@/components/Library/BookReader'

const PAGE_COUNT = 26

// A prose book, the WDEG shape: no manifest titles, the first line IS the title.
const manifest = {
  defaultLanguage: 'en',
  pages: Array.from({ length: PAGE_COUNT }, (_, i) => ({ order: i + 1 })),
} as unknown as BookManifest

const baseText: Record<string, string> = Object.fromEntries(
  Array.from({ length: PAGE_COUNT }, (_, i) => [
    String(i + 1),
    i === 0
      ? "Something's Wrong With The World\n\nThe body of the first page, which is\nlonger than its title and should be what the description is built from."
      : `Chapter ${i + 1} Title\n\nBody text for chapter ${i + 1}, long enough to excerpt from.`,
  ]),
)

const loaded = buildLoadedBook(manifest, baseText)

describe('bookManifestServer — slug inference', () => {
  it('infers a clean chapter-name slug from the first line of each page', () => {
    expect(loaded.pageSlugs[0]).toBe('1-somethings-wrong-with-the-world')
    expect(loaded.pageTitles[0]).toMatch(/Something/i)
    // every slug starts with its 1-based page number
    loaded.pageSlugs.forEach((s, i) => expect(s.startsWith(`${i + 1}`)).toBe(true))
  })

  it('falls back to the bare page number when a page has no inferable title', () => {
    const bare = buildLoadedBook(manifest, {})
    expect(bare.pageSlugs[0]).toBe('1')
  })

  it('prefers an explicit manifest title over the first line', () => {
    const titled = buildLoadedBook(
      { defaultLanguage: 'en', pages: [{ order: 1, title: 'John 3' }] } as unknown as BookManifest,
      { '1': 'ignored first line' },
    )
    expect(titled.pageSlugs[0]).toBe('1-john-3')
  })
})

describe('bookManifestServer — page resolution', () => {
  it('resolves a <n>-<name> param by its leading number, ignoring the name', () => {
    expect(resolvePageIndex(loaded, '11-anything-here')).toBe(10)
    expect(resolvePageIndex(loaded, '1-somethings-wrong-with-the-world')).toBe(0)
    expect(resolvePageIndex(loaded, '26')).toBe(25)
  })

  it('clamps out-of-range / missing params to page 0', () => {
    expect(resolvePageIndex(loaded, '999-nope')).toBe(0)
    expect(resolvePageIndex(loaded, 'garbage')).toBe(0)
    expect(resolvePageIndex(loaded, undefined)).toBe(0)
  })
})

describe('bookManifestServer — excerpts', () => {
  it('builds a non-empty page description from the body, not the title', () => {
    const excerpt = pageExcerpt(loaded.baseText['1'] as string)
    expect(excerpt.length).toBeGreaterThan(10)
    expect(excerpt.length).toBeLessThanOrEqual(156)
    expect(excerpt).not.toBe(loaded.pageTitles[0])
  })
})

describe('bookManifestServer — loader', () => {
  it('returns null for an unknown book slug', () => {
    expect(loadBookFromPublic('does-not-exist')).toBeNull()
  })
})
