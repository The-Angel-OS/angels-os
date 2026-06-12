import { describe, it, expect } from 'vitest'
import { parsePath } from '@/endpoints/resolve-edit'

describe('resolve-edit parsePath', () => {
  it('maps root to the home page', () => {
    expect(parsePath('/')).toEqual({ collection: 'pages', slug: 'home' })
    expect(parsePath('')).toEqual({ collection: 'pages', slug: 'home' })
  })

  it('strips a locale prefix', () => {
    expect(parsePath('/en')).toEqual({ collection: 'pages', slug: 'home' })
    expect(parsePath('/es/posts/hola')).toEqual({ collection: 'posts', slug: 'hola' })
    expect(parsePath('/en/about')).toEqual({ collection: 'pages', slug: 'about' })
  })

  it('maps detail routes to their collection', () => {
    expect(parsePath('/posts/my-post')).toEqual({ collection: 'posts', slug: 'my-post' })
    expect(parsePath('/products/widget')).toEqual({ collection: 'products', slug: 'widget' })
    expect(parsePath('/shop/widget')).toEqual({ collection: 'products', slug: 'widget' })
    expect(parsePath('/events/launch')).toEqual({ collection: 'events', slug: 'launch' })
  })

  it('maps a top-level slug to a page', () => {
    expect(parsePath('/about')).toEqual({ collection: 'pages', slug: 'about' })
    expect(parsePath('/contact')).toEqual({ collection: 'pages', slug: 'contact' })
  })

  it('returns null for reserved / non-editable routes', () => {
    expect(parsePath('/dashboard')).toBeNull()
    expect(parsePath('/checkout')).toBeNull()
    expect(parsePath('/login')).toBeNull()
    expect(parsePath('/federation/discover')).toBeNull()
    expect(parsePath('/posts')).toBeNull() // listing, not a detail page
    expect(parsePath('/account/orders')).toBeNull()
  })

  it('ignores query and hash', () => {
    expect(parsePath('/posts/my-post?utm=x#frag')).toEqual({ collection: 'posts', slug: 'my-post' })
  })
})
