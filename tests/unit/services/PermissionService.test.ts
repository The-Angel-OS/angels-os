/**
 * PermissionService.isAuthorized — the pure, security-critical resolver.
 * Exhaustive cases: platform admin, role/user grants, deny-precedence, special
 * roles, legacy tenant-permission fallback, deny-by-default.
 */
import { describe, it, expect } from 'vitest'
import {
  isAuthorized,
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
