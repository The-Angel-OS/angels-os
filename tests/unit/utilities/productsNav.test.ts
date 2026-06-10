import { describe, it, expect } from 'vitest'
import { injectProductsUnderNav, DEFAULT_SHOP_DROPDOWN_COUNT } from '@/utilities/productsNav'

const item = (label: string, url: string, extra: Record<string, unknown> = {}) => ({
  id: url,
  link: { type: 'custom', label, url },
  ...extra,
})

const NAV = [item('Home', '/'), item('Shop', '/shop'), item('Dashboard', '/dashboard')]

describe('productsNav.injectProductsUnderNav', () => {
  it('hangs products under Shop at /products/<slug> with image', () => {
    const out = injectProductsUnderNav(NAV, [
      { slug: 'mug', title: 'Angel Mug', image: '/t/mug.jpg' },
      { slug: 'tee', title: 'Tee' },
    ])
    const shop = out.find((i) => i.link.url === '/shop')
    expect(shop.children.map((c: { link: { url: string } }) => c.link.url)).toEqual(['/products/mug', '/products/tee'])
    expect(shop.children[0].image).toBe('/t/mug.jpg')
    expect(shop.children[1].image).toBeUndefined()
  })

  it('defaults to the top 5', () => {
    expect(DEFAULT_SHOP_DROPDOWN_COUNT).toBe(5)
    const many = Array.from({ length: 12 }, (_, i) => ({ slug: `p${i}`, title: `P${i}` }))
    expect(injectProductsUnderNav(NAV, many).find((i) => i.link.url === '/shop').children).toHaveLength(5)
  })

  it('count is configurable', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ slug: `p${i}`, title: `P${i}` }))
    expect(injectProductsUnderNav(NAV, many, { max: 3 }).find((i) => i.link.url === '/shop').children).toHaveLength(3)
  })

  it('returns nav unchanged with no products', () => {
    expect(injectProductsUnderNav(NAV, [])).toBe(NAV)
  })

  it('leaves non-Shop items alone and dedups vs manual children', () => {
    const nav = [item('Shop', '/shop', { children: [{ link: { type: 'custom', label: 'Pinned', url: '/products/mug' } }] }), item('Home', '/')]
    const out = injectProductsUnderNav(nav, [{ slug: 'mug', title: 'Mug' }, { slug: 'new', title: 'New' }])
    expect(out[0].children.map((c: { link: { url: string } }) => c.link.url)).toEqual(['/products/mug', '/products/new'])
    expect(out[1].children).toBeUndefined()
  })
})
