import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

/**
 * The Library is the biggest SEO surface this platform has — ~1,250 chapter
 * URLs — and the sitemap indexed pages, posts and products only.
 *
 * The one thing that must not regress: a sitemap that submits a paywalled URL
 * earns a soft-404, because Google gets the AccessPanel instead of the text.
 */
const SRC = readFileSync('src/app/sitemap.ts', 'utf8')

describe('the sitemap carries the Library', () => {
  it('indexes works and their chapters', () => {
    expect(SRC).toContain("collection: 'work-chapters'")
    expect(SRC).toContain('/learn/${slug}')
    expect(SRC).toContain('/learn/${workSlug}/${chapterSlug}')
  })

  it('submits only PUBLIC works — never a paywalled URL', () => {
    expect(SRC).toContain("access: { equals: 'public' }")
  })

  it('respects what this portal actually carries', () => {
    expect(SRC).toContain('getAvailableWorks')
  })

  it('never lets a Library failure take the whole sitemap down', () => {
    const i = SRC.indexOf('const library: MetadataRoute.Sitemap = []')
    expect(i).toBeGreaterThan(-1)
    expect(SRC.slice(i, i + 120)).toContain('try {')
  })
})
