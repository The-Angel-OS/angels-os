/**
 * Unit tests for the legacy-lexical normalizer's link rewrite — the bare
 * /products listing link → /shop, while /products/<slug> detail links survive.
 */
import { describe, it, expect } from 'vitest'
import {
  rewriteProductsListingUrl,
  normalizeLegacyLexicalNode,
} from '@/components/RichText/normalizeLegacyLexical'

describe('rewriteProductsListingUrl', () => {
  it('rewrites the bare /products listing to /shop', () => {
    expect(rewriteProductsListingUrl('/products')).toBe('/shop')
    expect(rewriteProductsListingUrl('/products/')).toBe('/shop')
  })

  it('preserves the query string and hash on the bare listing', () => {
    expect(rewriteProductsListingUrl('/products?q=van')).toBe('/shop?q=van')
    expect(rewriteProductsListingUrl('/products#top')).toBe('/shop#top')
    expect(rewriteProductsListingUrl('/products/?sort=title')).toBe('/shop?sort=title')
  })

  it('preserves individual product detail links', () => {
    expect(rewriteProductsListingUrl('/products/soul-van')).toBe('/products/soul-van')
    expect(rewriteProductsListingUrl('/products/soul-van?ref=x')).toBe('/products/soul-van?ref=x')
  })

  it('leaves unrelated urls untouched', () => {
    expect(rewriteProductsListingUrl('/shop')).toBe('/shop')
    expect(rewriteProductsListingUrl('https://x.com/products')).toBe('https://x.com/products')
    expect(rewriteProductsListingUrl('/product')).toBe('/product')
  })
})

describe('normalizeLegacyLexicalNode — link rewrite', () => {
  it('rewrites a bare /products link node in-flight without mutating the input', () => {
    const node = {
      type: 'link',
      fields: { url: '/products', linkType: 'custom' },
      children: [{ type: 'text', text: 'our products' }],
    }
    const out = normalizeLegacyLexicalNode(node) as typeof node
    expect(out.fields.url).toBe('/shop')
    expect(node.fields.url).toBe('/products') // original untouched
  })

  it('leaves a product-detail link node alone', () => {
    const node = { type: 'link', fields: { url: '/products/soul-van' }, children: [] }
    const out = normalizeLegacyLexicalNode(node) as typeof node
    expect(out.fields.url).toBe('/products/soul-van')
  })
})
