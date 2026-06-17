/**
 * affectedUrl — visual-echo marker: collection→public-URL mapping + round-trip extraction.
 */
import { describe, it, expect } from 'vitest'
import { affectedPublicUrl, affectedUrlDirective, extractAffectedUrls } from '@/utilities/affectedUrl'

describe('affectedPublicUrl', () => {
  it('maps content collections to their public surface', () => {
    expect(affectedPublicUrl('products', 'golden-barrel')).toBe('/products/golden-barrel')
    expect(affectedPublicUrl('posts', 'beginner-care')).toBe('/posts/beginner-care')
    expect(affectedPublicUrl('pages', 'about')).toBe('/about')
  })
  it('maps the home page to root', () => {
    expect(affectedPublicUrl('pages', 'home')).toBe('/')
  })
  it('maps slugless mutations to a sensible index/home', () => {
    expect(affectedPublicUrl('products')).toBe('/shop')
    expect(affectedPublicUrl('pages')).toBe('/')
  })
  it('maps whole-site changes (branding/nav/endeavor) to home', () => {
    expect(affectedPublicUrl('site-settings')).toBe('/')
    expect(affectedPublicUrl('header')).toBe('/')
    expect(affectedPublicUrl('endeavors')).toBe('/')
  })
  it('returns null for surfaces with no public page', () => {
    expect(affectedPublicUrl('media')).toBeNull()
    expect(affectedPublicUrl('whatever')).toBeNull()
  })
})

describe('extractAffectedUrls (round-trip with the directive)', () => {
  it('extracts a single appended directive from a tool result', () => {
    const result = 'Updated the page.' + affectedUrlDirective('/about')
    expect(extractAffectedUrls([result])).toEqual(['/about'])
  })
  it('dedupes across multiple tool results and preserves order', () => {
    const a = 'x' + affectedUrlDirective('/products/a')
    const b = 'y' + affectedUrlDirective('/products/b')
    const c = 'z' + affectedUrlDirective('/products/a') // dup
    expect(extractAffectedUrls([a, b, c])).toEqual(['/products/a', '/products/b'])
  })
  it('ignores results with no directive and malformed markers', () => {
    expect(extractAffectedUrls(['plain text', '<!--affectedUrl:not json-->'])).toEqual([])
  })
})
