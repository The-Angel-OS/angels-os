import { describe, it, expect } from 'vitest'
import { NAV_SECTIONS, type NavVisibilityContext } from '@/app/[locale]/(dashboard)/dashboard/nav-config'

function visibleSectionsAndKeys(ctx: NavVisibilityContext) {
  const sections = NAV_SECTIONS.filter((s) => s.visible(ctx))
  const itemKeys = sections.flatMap((s) =>
    s.items.filter((i) => i.visible(ctx)).map((i) => i.key),
  )
  return {
    sectionKeys: sections.map((s) => s.key),
    itemKeys,
  }
}

describe('Dashboard nav-config Creator Studio vs Platform Ops', () => {
  it('shows Creator Studio + Settings + Monetize to tenant_admin, with zero Platform Ops or Holon items', () => {
    const ctx: NavVisibilityContext = {
      isAuthenticated: true,
      isAdmin: false,
      isSuperAdmin: false,
      isPortalManager: true,
      isBusinessOwner: true,
      wizardComplete: true,
      permissions: [],
      tenantRole: 'tenant_admin',
      features: { works: false },
    }
    const { sectionKeys, itemKeys } = visibleSectionsAndKeys(ctx)

    expect(sectionKeys).toEqual(['studio', 'content', 'monetize', 'audience', 'settings', 'account'])
    expect(sectionKeys).not.toContain('platform-ops')

    expect(itemKeys).toContain('memberships')
    expect(itemKeys).toContain('shop-orders')
    expect(itemKeys).toContain('events')
    expect(itemKeys).toContain('bookings')
    expect(itemKeys).toContain('people-members')
    expect(itemKeys).toContain('people-contacts')
    expect(itemKeys).toContain('settings')
    expect(itemKeys).toContain('learn')

    // Removed / gated items
    expect(itemKeys).not.toContain('works')
    expect(itemKeys).not.toContain('holon')
    expect(itemKeys).not.toContain('federation-network')
    expect(itemKeys).not.toContain('tenant-admin')
    expect(itemKeys).not.toContain('payload-admin')
  })

  it('reveals Works in CONTENT only when tenant.features.works is enabled', () => {
    const ctx: NavVisibilityContext = {
      isAuthenticated: true,
      isAdmin: false,
      isSuperAdmin: false,
      isPortalManager: true,
      isBusinessOwner: true,
      wizardComplete: true,
      permissions: [],
      tenantRole: 'tenant_admin',
      features: { works: true },
    }
    const { itemKeys } = visibleSectionsAndKeys(ctx)
    expect(itemKeys).toContain('works')
  })

  it('shows collapsed-by-default PLATFORM OPS to super_admin only', () => {
    const ctx: NavVisibilityContext = {
      isAuthenticated: true,
      isAdmin: true,
      isSuperAdmin: true,
      isPortalManager: true,
      isBusinessOwner: true,
      wizardComplete: true,
      permissions: [],
      tenantRole: 'tenant_admin',
      features: { works: false },
    }
    const { sectionKeys, itemKeys } = visibleSectionsAndKeys(ctx)
    expect(sectionKeys).toContain('platform-ops')
    const opsSection = NAV_SECTIONS.find((s) => s.key === 'platform-ops')
    expect(opsSection?.defaultCollapsed).toBe(true)
    expect(itemKeys).toContain('tenant-admin')
    expect(itemKeys).toContain('payload-admin')
  })

  it('restricts plain tenant_member to STUDIO + ACCOUNT only', () => {
    const ctx: NavVisibilityContext = {
      isAuthenticated: true,
      isAdmin: false,
      isSuperAdmin: false,
      isPortalManager: false,
      isBusinessOwner: false,
      wizardComplete: true,
      permissions: [],
      tenantRole: 'tenant_member',
      features: { works: true },
    }
    const { sectionKeys, itemKeys } = visibleSectionsAndKeys(ctx)
    expect(sectionKeys).toEqual(['studio', 'account'])
    expect(itemKeys).not.toContain('settings')
    expect(itemKeys).not.toContain('memberships')
    expect(itemKeys).not.toContain('works')
  })

  it('shows only public Overview and View Site to anonymous visitors', () => {
    const ctx: NavVisibilityContext = {
      isAuthenticated: false,
      isAdmin: false,
      isSuperAdmin: false,
      isPortalManager: false,
      isBusinessOwner: false,
      wizardComplete: true,
      permissions: [],
      tenantRole: null,
      features: null,
    }
    const { sectionKeys, itemKeys } = visibleSectionsAndKeys(ctx)
    expect(sectionKeys).toEqual(['studio'])
    expect(itemKeys).toEqual(['dashboard', 'home'])
  })
})
