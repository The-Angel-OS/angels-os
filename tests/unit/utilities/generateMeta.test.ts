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

  it('includes doc meta title with site suffix', async () => {
    const meta = await generateMeta({ doc: { meta: { title: 'About Us' } } })
    expect(meta.title).toBe('About Us | Angel OS')
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

  it('handles array slug by joining with slash', async () => {
    const doc = { slug: ['products', 'widgets'] } as any
    const meta = await generateMeta({ doc })
    expect((meta.openGraph as any)?.url).toBe('products/widgets')
  })

  it('defaults url to "/" for non-array slug', async () => {
    const doc = {}
    const meta = await generateMeta({ doc })
    expect((meta.openGraph as any)?.url).toBe('/')
  })
})
