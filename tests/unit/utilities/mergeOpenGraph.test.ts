/**
 * mergeOpenGraph — Unit Tests
 *
 * Merges caller-supplied OpenGraph metadata with Angel OS defaults.
 */
import { describe, it, expect } from 'vitest'

import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'

describe('mergeOpenGraph', () => {
  it('returns defaults when called with no arguments', () => {
    const og = mergeOpenGraph()
    expect(og).toBeDefined()
    expect((og as any).siteName).toBe('Angel OS')
    expect((og as any).title).toBe('Angel OS')
    expect((og as any).type).toBe('website')
  })

  it('overrides title when provided', () => {
    const og = mergeOpenGraph({ title: 'My Page' })
    expect((og as any).title).toBe('My Page')
  })

  it('overrides description when provided', () => {
    const og = mergeOpenGraph({ description: 'Custom description' })
    expect((og as any).description).toBe('Custom description')
  })

  it('uses caller images when provided', () => {
    const customImages = [{ url: 'https://example.com/image.png' }]
    const og = mergeOpenGraph({ images: customImages })
    expect((og as any).images).toEqual(customImages)
  })

  it('falls back to default images when caller images is undefined', () => {
    const og = mergeOpenGraph({ title: 'No images' })
    const images = (og as any).images
    expect(Array.isArray(images)).toBe(true)
    expect(images.length).toBeGreaterThan(0)
    // The asset name churns (website-template-OG.webp → og-fallback.jpg). What
    // must hold is that it is an ABSOLUTE url — scrapers won't resolve a path.
    expect(images[0].url).toMatch(/^https?:\/\/.+\/og-fallback\.jpg$/)
  })

  it('preserves default siteName when not overridden', () => {
    const og = mergeOpenGraph({ title: 'Custom' })
    expect((og as any).siteName).toBe('Angel OS')
  })

  it('allows overriding type', () => {
    const og = mergeOpenGraph({ type: 'article' })
    expect((og as any).type).toBe('article')
  })
})
