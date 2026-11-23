import { describe, it, expect } from 'vitest'
import { UserPortals } from '@/blocks/UserPortals/config'
import { buildPortalCardItems } from '@/blocks/UserPortals/Component'
import { USER_PORTALS_BLOCK_STATEMENTS } from '@/endpoints/ensure-user-portals-block-tables'

describe('UserPortals Page Block & Zero-Downtime DDL', () => {
  it('defines expected Payload block schema fields matching Postgres DDL', () => {
    expect(UserPortals.slug).toBe('userPortals')
    expect(UserPortals.interfaceName).toBe('UserPortalsBlock')
    const names = UserPortals.fields.map((f) => ('name' in f ? f.name : ''))
    expect(names).toEqual([
      'heading',
      'subheading',
      'scope',
      'columns',
      'showQuota',
      'showFilters',
      'showCreateCard',
      'hideWhenAnonymous',
      'includePlatformTenant',
    ])

    const scopeField = UserPortals.fields.find((f) => 'name' in f && f.name === 'scope') as {
      defaultValue?: string
    }
    expect(scopeField?.defaultValue).toBe('all_for_admin')
  })

  it('provisions both live and versioned Postgres tables + guarded enums', () => {
    const sqlAll = USER_PORTALS_BLOCK_STATEMENTS.join('\n')
    expect(sqlAll).toContain('CREATE TABLE IF NOT EXISTS "pages_blocks_user_portals"')
    expect(sqlAll).toContain('CREATE TABLE IF NOT EXISTS "_pages_v_blocks_user_portals"')
    expect(sqlAll).toContain('enum_pages_blocks_user_portals_scope')
    expect(sqlAll).toContain('enum__pages_v_blocks_user_portals_scope')
    expect(sqlAll).toContain('enum_pages_blocks_user_portals_columns')
    expect(sqlAll).toContain('enum__pages_v_blocks_user_portals_columns')
    expect(sqlAll).toContain('"hide_when_anonymous" boolean DEFAULT true')
    expect(sqlAll).toContain('"include_platform_tenant" boolean DEFAULT false')
    expect(sqlAll).toContain('REFERENCES "pages"("id") ON DELETE CASCADE')
    expect(sqlAll).toContain('REFERENCES "_pages_v"("id") ON DELETE CASCADE')
  })

  it('surfaces ALL non-platform portals for super_admin in all_for_admin scope while tagging owned vs platform_admin', () => {
    const owned = [
      {
        id: 5,
        slug: 'clearwater-cruisin',
        name: 'Clearwater Cruisin Ministries',
        domain: 'clearwater-cruisin.spacesangels.com',
        plan: 'demo' as const,
        isGuardianAngel: false,
      },
    ]

    const allTenants = [
      {
        id: 1,
        slug: 'platform',
        name: 'Angel OS Platform',
        domain: 'www.spacesangels.com',
        status: 'active',
        type: 'platform',
        portalPlan: 'demo',
      },
      {
        id: 5,
        slug: 'clearwater-cruisin',
        name: 'Clearwater Cruisin Ministries',
        domain: 'clearwater-cruisin.spacesangels.com',
        status: 'active',
        type: 'tenant',
        portalPlan: 'demo',
      },
      {
        id: 45,
        slug: 'mlb',
        name: 'My Lunch Break',
        domain: 'mlb.spacesangels.com',
        status: 'active',
        type: 'tenant',
        portalPlan: 'free',
      },
      {
        id: 46,
        slug: 'uap',
        name: 'Global UAP Archive',
        domain: 'uap.spacesangels.com',
        status: 'active',
        type: 'tenant',
        portalPlan: 'free',
      },
    ]

    const adminCards = buildPortalCardItems({
      owned,
      allTenants,
      isSuperAdmin: true,
      scope: 'all_for_admin',
      includePlatformTenant: false,
    })

    // Platform excluded when includePlatformTenant is false; unowned mlb + uap ARE surfaced
    expect(adminCards.map((c) => c.slug)).toEqual(['clearwater-cruisin', 'mlb', 'uap'])
    expect(adminCards[0]?.relationship).toBe('owner')
    expect(adminCards[1]?.relationship).toBe('platform_admin')
    expect(adminCards[1]?.dashboardUrl).toBe('https://mlb.spacesangels.com/dashboard')
    expect(adminCards[1]?.adminUrl).toBe('https://mlb.spacesangels.com/admin/collections/tenants/45')

    // Including platform tenant surfaces all 4
    const withPlatform = buildPortalCardItems({
      owned,
      allTenants,
      isSuperAdmin: true,
      scope: 'all_for_admin',
      includePlatformTenant: true,
    })
    expect(withPlatform.map((c) => c.slug)).toEqual(['platform', 'clearwater-cruisin', 'mlb', 'uap'])
  })

  it('restricts non-admin creators and owned-only scope strictly to owned portals', () => {
    const owned = [
      {
        id: 30,
        slug: 'kessela',
        name: 'Kessela',
        domain: 'kessela.spacesangels.com',
        plan: 'creator' as const,
        isGuardianAngel: false,
      },
    ]
    const allTenants = [
      { id: 30, slug: 'kessela', name: 'Kessela', domain: 'kessela.spacesangels.com', portalPlan: 'creator' },
      { id: 45, slug: 'mlb', name: 'My Lunch Break', domain: 'mlb.spacesangels.com', portalPlan: 'free' },
    ]

    const creatorCards = buildPortalCardItems({
      owned,
      allTenants,
      isSuperAdmin: false,
      scope: 'all_for_admin',
    })
    expect(creatorCards.map((c) => c.slug)).toEqual(['kessela'])
    expect(creatorCards[0]?.adminUrl).toBeUndefined()
    expect(creatorCards[0]?.planLabel).toBe('Creator ($10)')

    const adminOwnedOnly = buildPortalCardItems({
      owned,
      allTenants,
      isSuperAdmin: true,
      scope: 'owned',
    })
    expect(adminOwnedOnly.map((c) => c.slug)).toEqual(['kessela'])
  })
})
