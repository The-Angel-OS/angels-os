/**
 * Header nav composition — against the REAL function.
 *
 * The previous version of this file re-implemented the composition by hand and
 * asserted its own copy, so it agreed with itself rather than with production.
 * It went on claiming "Posts and Events are ALWAYS visible" after that stopped
 * being true, and it would have passed either way. `composeNavItems` is now
 * exported and this imports it.
 *
 * The rule, in order: what the OWNER stored wins, then what the endeavor
 * actually HAS, then platform chrome.
 *
 * @see src/components/Header/index.client.tsx
 */
import { describe, it, expect } from 'vitest'
import { composeNavItems } from '@/components/Header/index.client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const urls = (items: any[]) => items.map((i) => i?.link?.url)
const stored = (url: string, label = url) => ({ id: url, link: { type: 'custom', label, url } })

describe('composeNavItems', () => {
  it('guarantees Home first even when the header doc omits it', () => {
    expect(urls(composeNavItems({ navItems: [stored('/about')] }))[0]).toBe('/')
  })

  // --- populated or absent -------------------------------------------------

  it('omits Posts, Events and Book entirely when there is nothing in them', () => {
    const out = urls(composeNavItems({ navItems: [stored('/')], isStorefront: true }))
    expect(out).not.toContain('/posts')
    expect(out).not.toContain('/events')
    expect(out).not.toContain('/book')
  })

  it('adds each one as soon as it is populated', () => {
    const out = urls(
      composeNavItems({
        navItems: [stored('/')],
        isStorefront: true,
        hasPosts: true,
        hasEvents: true,
        hasBook: true,
      }),
    )
    expect(out).toContain('/posts')
    expect(out).toContain('/events')
    expect(out).toContain('/book')
  })

  it('never overrides what the owner stored — an empty section they pinned stays', () => {
    // hasEvents false, but the owner put Events in their own navItems.
    const out = composeNavItems({ navItems: [stored('/'), stored('/events', 'Events')] })
    expect(urls(out).filter((u) => u === '/events')).toHaveLength(1)
  })

  // --- giving --------------------------------------------------------------

  it('offers Giving only to an organization that takes donations', () => {
    expect(urls(composeNavItems({ navItems: [stored('/')] }))).not.toContain('/donate')
    expect(urls(composeNavItems({ navItems: [stored('/')], givingOrg: true }))).toContain('/donate')
  })

  it('keeps Giving off a storefront even if it is somehow flagged as giving', () => {
    const out = composeNavItems({ navItems: [stored('/')], givingOrg: true, isStorefront: true })
    expect(urls(out)).not.toContain('/donate')
  })

  // --- chrome --------------------------------------------------------------

  it('keeps mission chrome off a storefront and on a community site', () => {
    const shop = urls(composeNavItems({ navItems: [stored('/')], isStorefront: true }))
    expect(shop).not.toContain('/works')
    expect(shop).not.toContain('/learn')
    expect(shop).not.toContain('/dashboard/spaces')

    const community = urls(composeNavItems({ navItems: [stored('/')] }))
    expect(community).toEqual(expect.arrayContaining(['/works', '/learn', '/dashboard/spaces']))
  })

  it('always offers Dashboard — the layout handles the auth redirect', () => {
    expect(urls(composeNavItems({ navItems: [stored('/')], isStorefront: true }))).toContain('/dashboard')
  })

  it('adds Discovery only when the Endeavor switch is on', () => {
    expect(urls(composeNavItems({ navItems: [stored('/')] }))).not.toContain('/federation/discover')
    expect(urls(composeNavItems({ navItems: [stored('/')], discoveryEnabled: true }))).toContain(
      '/federation/discover',
    )
  })

  // --- membership ----------------------------------------------------------

  it('puts Join right after Home, because position IS the mobile position', () => {
    const out = urls(
      composeNavItems({
        navItems: [stored('/'), stored('/about')],
        membership: { url: '/join', label: 'Join' },
      }),
    )
    expect(out.slice(0, 2)).toEqual(['/', '/join'])
  })
})
