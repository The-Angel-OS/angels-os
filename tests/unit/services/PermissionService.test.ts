/**
 * PermissionService.isAuthorized — the pure, security-critical resolver.
 * Exhaustive cases: platform admin, role/user grants, deny-precedence, special
 * roles, legacy tenant-permission fallback, deny-by-default.
 */
import { describe, it, expect } from 'vitest'
import {
  isAuthorized,
  mergeVisibleSpaceIds,
  resolveVisibleSpaceIds,
  buildSpaceVisibilityFilter,
  ROLE_ALL_USERS,
  ROLE_REGISTERED,
  type GrantContext,
  type PermissionRow,
} from '@/services/PermissionService'

const ctx = (over: Partial<GrantContext> = {}): GrantContext => ({
  userId: 1,
  roles: [ROLE_REGISTERED],
  isPlatformAdmin: false,
  tenantPermissions: [],
  ...over,
})

describe('PermissionService.isAuthorized', () => {
  it('platform admin is authorized for anything (short-circuit, even with no rows)', () => {
    expect(isAuthorized(ctx({ isPlatformAdmin: true }), 'Manage', [])).toBe(true)
  })

  it('denies by default with no rows and no membership perms', () => {
    expect(isAuthorized(ctx(), 'Edit', [])).toBe(false)
  })

  it('authorizes a matching role grant', () => {
    const rows: PermissionRow[] = [
      { permissionName: 'Edit', roleName: 'space_admin', isAuthorized: true },
    ]
    expect(isAuthorized(ctx({ roles: ['space_admin'] }), 'Edit', rows)).toBe(true)
    expect(isAuthorized(ctx({ roles: ['space_member'] }), 'Edit', rows)).toBe(false)
  })

  it('authorizes a direct user grant', () => {
    const rows: PermissionRow[] = [{ permissionName: 'View', user: 7, isAuthorized: true }]
    expect(isAuthorized(ctx({ userId: 7 }), 'View', rows)).toBe(true)
    expect(isAuthorized(ctx({ userId: 8 }), 'View', rows)).toBe(false)
  })

  it('honors a populated (object) user grant', () => {
    const rows: PermissionRow[] = [{ permissionName: 'View', user: { id: 7 }, isAuthorized: true }]
    expect(isAuthorized(ctx({ userId: 7 }), 'View', rows)).toBe(true)
  })

  it('deny precedence: an explicit deny beats a grant', () => {
    const rows: PermissionRow[] = [
      { permissionName: 'Edit', roleName: 'space_member', isAuthorized: true },
      { permissionName: 'Edit', user: 1, isAuthorized: false }, // explicit deny for this user
    ]
    expect(isAuthorized(ctx({ userId: 1, roles: ['space_member'] }), 'Edit', rows)).toBe(false)
  })

  it('"All Users" grant authorizes everyone, even anonymous', () => {
    const rows: PermissionRow[] = [
      { permissionName: 'View', roleName: ROLE_ALL_USERS, isAuthorized: true },
    ]
    expect(isAuthorized(ctx({ userId: null, roles: [] }), 'View', rows)).toBe(true)
  })

  it('"Registered Users" grant authorizes any authenticated user', () => {
    const rows: PermissionRow[] = [
      { permissionName: 'View', roleName: ROLE_REGISTERED, isAuthorized: true },
    ]
    expect(isAuthorized(ctx({ roles: [ROLE_REGISTERED] }), 'View', rows)).toBe(true)
    // anonymous (no Registered role) is not covered by a Registered-only grant
    expect(isAuthorized(ctx({ userId: null, roles: [] }), 'View', rows)).toBe(false)
  })

  it('legacy fallback: tenant membership permission satisfies the mapped permissionName', () => {
    // No explicit rows, but the user holds manage_users → Manage is authorized.
    expect(isAuthorized(ctx({ tenantPermissions: ['manage_users'] }), 'Manage', [])).toBe(true)
    expect(isAuthorized(ctx({ tenantPermissions: ['manage_content'] }), 'Edit', [])).toBe(true)
    expect(isAuthorized(ctx({ tenantPermissions: ['view_analytics'] }), 'Manage', [])).toBe(false)
  })

  it('only considers rows for the requested permissionName', () => {
    const rows: PermissionRow[] = [
      { permissionName: 'View', roleName: 'space_member', isAuthorized: true },
    ]
    // A View grant must not authorize Edit.
    expect(isAuthorized(ctx({ roles: ['space_member'] }), 'Edit', rows)).toBe(false)
  })

  it('a non-matching deny does not block an unrelated user', () => {
    const rows: PermissionRow[] = [
      { permissionName: 'Edit', roleName: 'space_admin', isAuthorized: true },
      { permissionName: 'Edit', user: 99, isAuthorized: false }, // deny for someone else
    ]
    expect(isAuthorized(ctx({ userId: 1, roles: ['space_admin'] }), 'Edit', rows)).toBe(true)
  })
})

// ── Space visibility resolver ────────────────────────────────────────────────

describe('mergeVisibleSpaceIds (pure)', () => {
  it('unions and dedupes, dropping nullish', () => {
    expect(mergeVisibleSpaceIds([1, 2, null], [2, 3, undefined])).toEqual([1, 2, 3])
  })
  it('empty inputs → empty', () => {
    expect(mergeVisibleSpaceIds([], [])).toEqual([])
  })
})

/**
 * Mock payload.find keyed by collection. Each collection returns canned docs.
 */
function mockPayload(byCollection: Record<string, Array<Record<string, unknown>>>) {
  return {
    find: async ({ collection }: { collection: string }) => ({
      docs: byCollection[collection] || [],
    }),
  }
}

describe('resolveVisibleSpaceIds', () => {
  it('anonymous → false (sees nothing)', async () => {
    expect(await resolveVisibleSpaceIds(mockPayload({}), null)).toBe(false)
  })

  it('platform admin → true (sees everything, no queries needed)', async () => {
    expect(await resolveVisibleSpaceIds(mockPayload({}), { id: 1, roles: ['super_admin'] })).toBe(true)
  })

  it('system user → true', async () => {
    expect(await resolveVisibleSpaceIds(mockPayload({}), { id: 9, isSystemUser: true })).toBe(true)
  })

  it('member inherits ALL non-private spaces of their tenant — no membership row needed (the Tyler fix)', async () => {
    // Tyler: active CCM tenant membership, ZERO space-memberships.
    const payload = mockPayload({
      'tenant-memberships': [{ tenant: 5, status: 'active' }],
      spaces: [{ id: 10 }, { id: 11 }], // CCM's public + invite_only spaces
      'space-memberships': [], // none
    })
    const ids = await resolveVisibleSpaceIds(payload, { id: 1, roles: ['member'] })
    expect(ids).toEqual([10, 11])
  })

  it('private spaces require an explicit grant — union with role-inherited set', async () => {
    const payload = mockPayload({
      'tenant-memberships': [{ tenant: 5, status: 'active' }],
      spaces: [{ id: 10 }], // only the non-private one is returned by the query
      'space-memberships': [{ space: 99 }], // explicit grant to a private space
    })
    const ids = await resolveVisibleSpaceIds(payload, { id: 1, roles: ['member'] })
    expect(ids).toEqual([10, 99])
  })

  it('normalizes populated relationship objects', async () => {
    const payload = mockPayload({
      'tenant-memberships': [{ tenant: { id: 5 }, status: 'active' }],
      spaces: [{ id: 10 }],
      'space-memberships': [{ space: { id: 10 } }], // dup of role-inherited → deduped
    })
    expect(await resolveVisibleSpaceIds(payload, { id: 1, roles: ['member'] })).toEqual([10])
  })

  it('member of nothing → false (fail closed)', async () => {
    const payload = mockPayload({ 'tenant-memberships': [], spaces: [], 'space-memberships': [] })
    expect(await resolveVisibleSpaceIds(payload, { id: 1, roles: ['member'] })).toBe(false)
  })
})

describe('buildSpaceVisibilityFilter', () => {
  const payload = mockPayload({
    'tenant-memberships': [{ tenant: 5, status: 'active' }],
    spaces: [{ id: 10 }, { id: 11 }],
    'space-memberships': [],
  })

  it("shapes the filter onto the doc's own id for Spaces.read", async () => {
    expect(await buildSpaceVisibilityFilter(payload, { id: 1, roles: ['member'] }, 'id')).toEqual({
      id: { in: [10, 11] },
    })
  })

  it("shapes the filter onto the 'space' field for Channels/Messages.read", async () => {
    expect(await buildSpaceVisibilityFilter(payload, { id: 1, roles: ['member'] }, 'space')).toEqual({
      space: { in: [10, 11] },
    })
  })

  it('passes through true/false unchanged', async () => {
    expect(await buildSpaceVisibilityFilter(mockPayload({}), { id: 1, roles: ['admin'] }, 'space')).toBe(true)
    expect(await buildSpaceVisibilityFilter(mockPayload({}), null, 'space')).toBe(false)
  })
})
