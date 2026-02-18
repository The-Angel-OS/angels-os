/**
 * Unit tests for Header navigation logic.
 *
 * Tests the nav item composition rules:
 * - Posts and Events are ALWAYS visible (logged in or out)
 * - Spaces and Dashboard require authentication
 * - CMS-driven nav items appear first
 *
 * This validates the logic without rendering React components.
 *
 * @see src/components/Header/index.client.tsx
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Extract the navigation composition logic for testing
// ---------------------------------------------------------------------------

const POSTS_NAV_ITEM = {
  id: 'posts',
  link: { type: 'custom' as const, label: 'Posts', url: '/posts', newTab: false },
}

const EVENTS_NAV_ITEM = {
  id: 'events',
  link: { type: 'custom' as const, label: 'Events', url: '/events', newTab: false },
}

const SPACES_NAV_ITEM = {
  id: 'spaces',
  link: { type: 'custom' as const, label: 'Spaces', url: '/spaces', newTab: false },
}

const DASHBOARD_NAV_ITEM = {
  id: 'dashboard',
  link: { type: 'custom' as const, label: 'Dashboard', url: '/dashboard', newTab: false },
}

type NavItem = {
  id: string
  link: { type: string; label: string; url: string; newTab: boolean }
}

/**
 * Mirrors the useMemo logic in HeaderClient.
 * @param baseMenu — CMS-driven nav items from Payload header collection
 * @param user — truthy if authenticated
 */
function buildNavMenu(baseMenu: NavItem[], user: unknown): NavItem[] {
  const items = [...baseMenu, POSTS_NAV_ITEM, EVENTS_NAV_ITEM]
  if (user) {
    items.push(SPACES_NAV_ITEM, DASHBOARD_NAV_ITEM)
  }
  return items
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Header Navigation Composition', () => {
  describe('logged out (user = null)', () => {
    it('includes Posts link', () => {
      const menu = buildNavMenu([], null)
      expect(menu.find((i) => i.id === 'posts')).toBeDefined()
    })

    it('includes Events link', () => {
      const menu = buildNavMenu([], null)
      expect(menu.find((i) => i.id === 'events')).toBeDefined()
    })

    it('does NOT include Spaces link', () => {
      const menu = buildNavMenu([], null)
      expect(menu.find((i) => i.id === 'spaces')).toBeUndefined()
    })

    it('does NOT include Dashboard link', () => {
      const menu = buildNavMenu([], null)
      expect(menu.find((i) => i.id === 'dashboard')).toBeUndefined()
    })

    it('returns 2 items with empty CMS menu', () => {
      const menu = buildNavMenu([], null)
      expect(menu).toHaveLength(2) // Posts + Events
    })
  })

  describe('logged in (user = truthy)', () => {
    const fakeUser = { id: 1, email: 'test@example.com' }

    it('includes Posts link', () => {
      const menu = buildNavMenu([], fakeUser)
      expect(menu.find((i) => i.id === 'posts')).toBeDefined()
    })

    it('includes Events link', () => {
      const menu = buildNavMenu([], fakeUser)
      expect(menu.find((i) => i.id === 'events')).toBeDefined()
    })

    it('includes Spaces link', () => {
      const menu = buildNavMenu([], fakeUser)
      expect(menu.find((i) => i.id === 'spaces')).toBeDefined()
    })

    it('includes Dashboard link', () => {
      const menu = buildNavMenu([], fakeUser)
      expect(menu.find((i) => i.id === 'dashboard')).toBeDefined()
    })

    it('returns 4 items with empty CMS menu', () => {
      const menu = buildNavMenu([], fakeUser)
      expect(menu).toHaveLength(4) // Posts + Events + Spaces + Dashboard
    })
  })

  describe('CMS-driven nav items', () => {
    const cmsItems: NavItem[] = [
      { id: 'shop', link: { type: 'custom', label: 'Shop', url: '/shop', newTab: false } },
      { id: 'about', link: { type: 'custom', label: 'About', url: '/about', newTab: false } },
    ]

    it('CMS items appear before hardcoded items', () => {
      const menu = buildNavMenu(cmsItems, null)
      expect(menu[0].id).toBe('shop')
      expect(menu[1].id).toBe('about')
      expect(menu[2].id).toBe('posts')
      expect(menu[3].id).toBe('events')
    })

    it('CMS + hardcoded items combine correctly when logged in', () => {
      const menu = buildNavMenu(cmsItems, { id: 1 })
      expect(menu).toHaveLength(6) // 2 CMS + Posts + Events + Spaces + Dashboard
    })

    it('CMS + hardcoded items combine correctly when logged out', () => {
      const menu = buildNavMenu(cmsItems, null)
      expect(menu).toHaveLength(4) // 2 CMS + Posts + Events
    })
  })

  describe('nav item structure', () => {
    it('all items have required fields', () => {
      const menu = buildNavMenu([], { id: 1 })
      for (const item of menu) {
        expect(item.id).toBeTruthy()
        expect(item.link.label).toBeTruthy()
        expect(item.link.url).toMatch(/^\//)
        expect(item.link.type).toBe('custom')
      }
    })

    it('no items open in new tab', () => {
      const menu = buildNavMenu([], { id: 1 })
      for (const item of menu) {
        expect(item.link.newTab).toBe(false)
      }
    })
  })
})
