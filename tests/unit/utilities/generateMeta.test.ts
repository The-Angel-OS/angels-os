/**
 * generateMeta — Unit Tests
 *
 * Tests the async generateMeta function with mocked dependencies.
 */
import { describe, it, expect, vi } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/utilities/mergeOpenGraph', () => ({
  mergeOpenGraph: vi.fn((og: Record<string, unknown>) => ({
    siteName: 'Angel OS',
    type: 'website',
    ...og,
  })),
}))

vi.mock('@/utilities/getURL', () => ({
  getServerSideURL: vi.fn(() => 'http://localhost:3000'),
}))

import { generateMeta } from '@/utilities/generateMeta'

// ── generateMeta ───────────────────────────────────────────────────────────────

describe('generateMeta', () => {
  it('returns "Angel OS" title when doc has no meta', async () => {
    const meta = await generateMeta({ doc: null })
    expect(meta.title).toBe('Angel OS')
  })

  it('returns "Angel OS" title when doc.meta is empty', async () => {
    const meta = await generateMeta({ doc: {} })
    expect(meta.title).toBe('Angel OS')
  })

  // The document title stays BARE — the (app) layout declares
  // title.template = "%s | <siteName>" and Next appends the portal name. Suffixing
  // here too rendered the brand twice ("About Us | Angel OS | Angel OS").
  it('leaves the doc meta title bare for the layout title template', async () => {
    const meta = await generateMeta({ doc: { meta: { title: 'About Us' } } })
    expect(meta.title).toBe('About Us')
  })

  it('still suffixes og:title, which no title template applies to', async () => {
    const meta = await generateMeta({ doc: { meta: { title: 'About Us' } } })
    expect((meta.openGraph as any)?.title).toBe('About Us | Angel OS')
  })

  it('passes description from doc.meta to result', async () => {
    const meta = await generateMeta({ doc: { meta: { description: 'Our story' } } })
    expect(meta.description).toBe('Our story')
  })

  it('openGraph has title set', async () => {
    const meta = await generateMeta({ doc: { meta: { title: 'Products' } } })
    expect((meta.openGraph as any)?.title).toBe('Products | Angel OS')
  })

  it('uses default image URL when no image provided', async () => {
    const meta = await generateMeta({ doc: null })
    const images = (meta.openGraph as any)?.images
    if (images) {
      expect(images[0]?.url).toContain('localhost:3000')
    }
  })

  it('uses absolute image URL from doc when provided', async () => {
    const doc = {
      meta: {
        image: { url: 'https://cdn.example.com/img.jpg' },
      },
    } as any
    const meta = await generateMeta({ doc })
    const images = (meta.openGraph as any)?.images
    if (images) {
      expect(images[0]?.url).toBe('https://cdn.example.com/img.jpg')
    }
  })

  it('prepends server URL to relative image path', async () => {
    const doc = {
      meta: {
        image: { url: '/uploads/img.jpg' },
      },
    } as any
    const meta = await generateMeta({ doc })
    const images = (meta.openGraph as any)?.images
    if (images) {
      expect(images[0]?.url).toBe('http://localhost:3000/uploads/img.jpg')
    }
  })

  // og:url must be ABSOLUTE — messengers/unfurlers ignore relative URLs.
  it('handles array slug by joining with slash (absolute)', async () => {
    const doc = { slug: ['products', 'widgets'] } as any
    const meta = await generateMeta({ doc })
    expect((meta.openGraph as any)?.url).toBe('http://localhost:3000/products/widgets')
  })

  it('defaults url to origin root for non-array slug', async () => {
    const doc = {}
    const meta = await generateMeta({ doc })
    expect((meta.openGraph as any)?.url).toBe('http://localhost:3000/')
  })

  it('falls back to doc title when meta.title is missing', async () => {
    const meta = await generateMeta({ doc: { title: 'Donate' } as any })
    expect(meta.title).toBe('Donate')
    expect((meta.openGraph as any)?.title).toBe('Donate | Angel OS')
  })
})
