/**
 * The nav is what a prospect sees first on a site we built for them, and the
 * failure mode is silent: derive it and the bar fills with Discovery/Works/Learn
 * while their own services collapse into "More".
 */
import { describe, expect, it, vi } from 'vitest'
import { applyBrochureNav, navUrlFor, PLATFORM_ROUTES } from '@/utilities/applyBrochureNav'

vi.mock('@/utilities/navOverrides', () => ({
  setNavOverrides: vi.fn(async (_p: unknown, _t: unknown, next: unknown) => next),
}))

const fakePayload = (hasHeader: boolean) => {
  const calls: Record<string, any[]> = { update: [], create: [] }
  return {
    calls,
    payload: {
      find: async () => ({ docs: hasHeader ? [{ id: 5 }] : [] }),
      update: async (a: any) => { calls.update.push(a); return a },
      create: async (a: any) => { calls.create.push(a); return a },
    } as any,
  }
}

const PAGES = [
  { slug: 'home', title: 'Home', showInNav: false },
  { slug: 'services', title: 'Services' },
  { slug: 'about', title: 'About' },
  { slug: 'faq', title: 'FAQ' },
  { slug: 'contact', title: 'Contact' },
]

describe('navUrlFor', () => {
  it('collapses home to root', () => {
    expect(navUrlFor('home')).toBe('/')
    expect(navUrlFor('services')).toBe('/services')
  })
})

describe('applyBrochureNav', () => {
  it('builds Home plus every in-nav page, without duplicating Home', async () => {
    const { payload, calls } = fakePayload(true)
    const res = await applyBrochureNav(payload, 1, PAGES)
    expect(res.pinned).toEqual(['/', '/services', '/about', '/faq', '/contact'])
    expect(calls.update[0].data.navItems.map((n: any) => n.link.label)).toEqual([
      'Home', 'Services', 'About', 'FAQ', 'Contact',
    ])
  })

  it('caps the bar at exactly the pinned pages so nothing platform-derived rides inline', async () => {
    const { payload } = fakePayload(true)
    const res = await applyBrochureNav(payload, 1, PAGES)
    // Any slack here is a slot Discovery or Spaces takes immediately.
    expect(res.maxInline).toBe(res.pinned.length)
  })

  it('demotes platform routes to More rather than deleting them, by default', async () => {
    const { payload } = fakePayload(true)
    const res = await applyBrochureNav(payload, 1, PAGES)
    expect(res.hidden).toEqual([])
    for (const url of PLATFORM_ROUTES) expect(res.pinned).not.toContain(url)
  })

  it('drops them altogether only when explicitly asked', async () => {
    const { payload } = fakePayload(true)
    const res = await applyBrochureNav(payload, 1, PAGES, { hidePlatformRoutes: true })
    expect(res.hidden).toEqual(PLATFORM_ROUTES)
    expect(res.hidden).toContain('/dashboard/spaces')
  })

  it('creates a header when the tenant has none', async () => {
    const { payload, calls } = fakePayload(false)
    await applyBrochureNav(payload, 7, PAGES)
    expect(calls.create).toHaveLength(1)
    expect(calls.create[0].data.tenant).toBe(7)
    expect(calls.update).toHaveLength(0)
  })

  it('omits pages explicitly kept out of the nav', async () => {
    const { payload } = fakePayload(true)
    const res = await applyBrochureNav(payload, 1, [
      { slug: 'home', title: 'Home', showInNav: false },
      { slug: 'secret', title: 'Secret', showInNav: false },
      { slug: 'contact', title: 'Contact' },
    ])
    expect(res.pinned).toEqual(['/', '/contact'])
  })
})
