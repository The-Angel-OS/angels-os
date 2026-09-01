import { describe, it, expect } from 'vitest'
import { injectPagesUnderHome } from '@/utilities/pagesNav'

const item = (label: string, url: string, extra: Record<string, unknown> = {}) => ({
  id: url,
  link: { type: 'custom', label, url },
  ...extra,
})

const NAV = [item('Home', '/'), item('Shop', '/shop'), item('Dashboard', '/dashboard')]

describe('pagesNav.injectPagesUnderHome', () => {
  it('hangs pages as children of the Home item', () => {
    const out = injectPagesUnderHome(NAV, [
      { slug: 'about', title: 'About Us' },
      { slug: 'services', title: 'Services' },
    ])
    const home = out.find((i) => i.link.url === '/')
    expect(home.children.map((c: { link: { url: string; label: string } }) => c.link.url)).toEqual(['/about', '/services'])
    expect(home.children[0].link.label).toBe('About Us')
    // other items untouched
    expect(out.find((i) => i.link.url === '/shop')?.children).toBeUndefined()
  })

  it('excludes the home page itself and falls back to slug for a missing title', () => {
    const out = injectPagesUnderHome(NAV, [{ slug: 'home', title: 'Home' }, { slug: 'faq' }])
    const home = out.find((i) => i.link.url === '/')
    expect(home.children.map((c: { link: { url: string } }) => c.link.url)).toEqual(['/faq'])
    expect(home.children[0].link.label).toBe('faq')
  })

  it('excludes pages with showInNav === false (e.g. campaign pages)', () => {
    const out = injectPagesUnderHome(NAV, [
      { slug: 'about', title: 'About' },
      { slug: 'summer-promo', title: 'Summer Promo', showInNav: false },
      { slug: 'services', title: 'Services' },
    ])
    const home = out.find((i) => i.link.url === '/')
    expect(home.children.map((c: { link: { url: string } }) => c.link.url)).toEqual(['/about', '/services'])
  })

  it('sorts by navOrder then label, and honors navLabel override', () => {
    const out = injectPagesUnderHome(NAV, [
      { slug: 'z-last', title: 'Zeta', navOrder: 3 },
      { slug: 'a-mid', title: 'Alpha' }, // no navOrder → sorts last among, after ordered
      { slug: 'b-first', title: 'Bravo', navOrder: 1, navLabel: 'First!' },
    ])
    const home = out.find((i) => i.link.url === '/')
    expect(home.children.map((c: { link: { label: string; url: string } }) => c.link.label)).toEqual(['First!', 'Zeta', 'Alpha'])
  })

  it('merges with manually-authored children (dedup by URL)', () => {
    const nav = [item('Home', '/', { children: [{ link: { type: 'custom', label: 'Manual', url: '/about' } }] }), item('X', '/x')]
    const out = injectPagesUnderHome(nav, [{ slug: 'about', title: 'About' }, { slug: 'new', title: 'New' }])
    const home = out.find((i) => i.link.url === '/')
    expect(home.children.map((c: { link: { url: string } }) => c.link.url)).toEqual(['/about', '/new']) // /about not duplicated
  })

  it('returns nav unchanged when there are no eligible pages', () => {
    const out = injectPagesUnderHome(NAV, [{ slug: 'home' }])
    expect(out).toBe(NAV)
  })

  it('caps the number of page children', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ slug: `p${i}`, title: `P${i}` }))
    const out = injectPagesUnderHome(NAV, many, { max: 5 })
    expect(out.find((i) => i.link.url === '/').children).toHaveLength(5)
  })

  it('matches Home by label when url is not "/"', () => {
    const nav = [{ id: 'h', link: { type: 'custom', label: 'Home', url: '/home' } }]
    const out = injectPagesUnderHome(nav, [{ slug: 'a', title: 'A' }])
    expect(out[0].children).toHaveLength(1)
  })

  // --- nesting by parent (the DNN model: the page tree IS the menu) ---

  it('nests a child under its parent page instead of under Home', () => {
    const out = injectPagesUnderHome([item('Home', '/'), item('Services', '/services')], [
      { id: 1, slug: 'services', title: 'Services' },
      { id: 2, slug: 'infrastructure', title: 'Infrastructure', parent: 1, navOrder: 1 },
      { id: 3, slug: 'analytics', title: 'Analytics', parent: 1, navOrder: 2 },
      { id: 4, slug: 'about', title: 'About' },
    ])
    const services = out.find((i) => i.link.url === '/services')
    expect(services.children.map((c: { link: { url: string } }) => c.link.url)).toEqual([
      '/infrastructure',
      '/analytics',
    ])
    // Parentless pages still go under Home -- including Services itself, which
    // is pre-existing behaviour (Home lists every page). What matters is that
    // the two CHILDREN are not there; they belong to their parent's dropdown.
    const home = out.find((i) => i.link.url === '/')
    expect(home.children.map((c: { link: { url: string } }) => c.link.url)).toEqual(['/about', '/services'])
  })

  it('accepts a populated parent doc as well as a bare id', () => {
    const out = injectPagesUnderHome([item('Home', '/'), item('Services', '/services')], [
      { id: 1, slug: 'services', title: 'Services' },
      { id: 2, slug: 'infrastructure', title: 'Infrastructure', parent: { id: 1 } },
    ])
    expect(
      out.find((i) => i.link.url === '/services').children.map((c: { link: { url: string } }) => c.link.url),
    ).toEqual(['/infrastructure'])
  })

  it('falls back to Home when the parent is not a top-level item', () => {
    // parent exists as a page but was never promoted to the bar -- the child
    // must still be reachable rather than vanishing.
    const out = injectPagesUnderHome([item('Home', '/')], [
      { id: 1, slug: 'services', title: 'Services', navOrder: 1 },
      { id: 2, slug: 'infrastructure', title: 'Infrastructure', parent: 1, navOrder: 2 },
    ])
    expect(
      out.find((i) => i.link.url === '/').children.map((c: { link: { url: string } }) => c.link.url),
    ).toEqual(['/services', '/infrastructure'])
  })

  it('falls back to Home when the parent is unpublished or not viewable', () => {
    // the parent is simply absent from the list the header passes in
    const out = injectPagesUnderHome([item('Home', '/'), item('Services', '/services')], [
      { id: 2, slug: 'infrastructure', title: 'Infrastructure', parent: 1 },
    ])
    expect(
      out.find((i) => i.link.url === '/').children.map((c: { link: { url: string } }) => c.link.url),
    ).toEqual(['/infrastructure'])
    expect(out.find((i) => i.link.url === '/services').children).toBeUndefined()
  })

  it('is a no-op for every page that has no parent (the 150 rows in prod today)', () => {
    const pages = [
      { id: 1, slug: 'about', title: 'About' },
      { id: 2, slug: 'services', title: 'Services' },
    ]
    expect(JSON.stringify(injectPagesUnderHome(NAV, pages))).toBe(
      JSON.stringify(injectPagesUnderHome(NAV, pages.map((p) => ({ ...p, parent: null })))),
    )
  })
})
