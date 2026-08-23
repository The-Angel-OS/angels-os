import { describe, expect, it } from 'vitest'
import { newDocHrefFor } from '@/components/AdminBar'

describe('AdminBar "+ New" button', () => {
  it('offers a new post on the posts listing root', () => {
    const href = newDocHrefFor(['posts'], '/en/posts')
    expect(href).toContain('/admin/collections/posts/create')
    // AdminReturnBar reads these to offer the way back out of the editor.
    expect(href).toContain(`returnTo=${encodeURIComponent('/en/posts')}`)
    expect(href).toContain('returnLabel=Posts')
  })

  it('offers nothing on a document page — the edit link already works there', () => {
    expect(newDocHrefFor(['posts', 'my-post'], '/en/posts/my-post')).toBeNull()
  })

  it('offers nothing on a pagination page', () => {
    expect(newDocHrefFor(['posts', 'page', '2'], '/en/posts/page/2')).toBeNull()
  })

  it('covers products and events, but not pages', () => {
    expect(newDocHrefFor(['products'], '/en/products')).toContain('products/create')
    expect(newDocHrefFor(['events'], '/en/events')).toContain('events/create')
    // Pages are created rarely and "/" is the home page, not a listing.
    expect(newDocHrefFor(['pages'], '/en/pages')).toBeNull()
  })

  it('treats /shop as the products listing', () => {
    // The listing is /shop but a document is /products/<slug> — keying off the
    // segment name alone missed the shop, the listing owners add to most.
    const href = newDocHrefFor(['shop'], '/en/shop')
    expect(href).toContain('/admin/collections/products/create')
    expect(href).toContain(`returnTo=${encodeURIComponent('/en/shop')}`)
  })

  it('ignores routes that are not collections', () => {
    expect(newDocHrefFor(['about'], '/en/about')).toBeNull()
    expect(newDocHrefFor([], '/en')).toBeNull()
  })
})
