/**
 * connectorAccess — endeavor owners self-serve their own tenant's integrations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/access/getUserTenantRoles', () => ({ getUserTenantRoles: vi.fn() }))

import { connectorScopedAccess, connectorCreateAccess, managerTenantIds } from '@/access/connectorAccess'
import { getUserTenantRoles } from '@/access/getUserTenantRoles'

const call = (fn: typeof connectorScopedAccess, user: unknown) => fn({ req: { user } } as never)

describe('connectorAccess', () => {
  beforeEach(() => vi.clearAllMocks())

  it('denies anonymous', async () => {
    expect(await call(connectorScopedAccess, null)).toBe(false)
    expect(await call(connectorCreateAccess, null)).toBe(false)
  })

  it('super_admin gets unconstrained access (plugin clamps tenants)', async () => {
    const u = { id: 1, roles: ['super_admin'] }
    expect(await call(connectorScopedAccess, u)).toBe(true)
    expect(await call(connectorCreateAccess, u)).toBe(true)
    expect(getUserTenantRoles).not.toHaveBeenCalled()
  })

  it('any non-customer global role (admin, producer, …) is allowed — plugin scopes tenants', async () => {
    for (const roles of [['admin'], ['producer'], ['customer', 'producer']]) {
      const u = { id: 2, roles }
      expect(await call(connectorScopedAccess, u)).toBe(true)
      expect(await call(connectorCreateAccess, u)).toBe(true)
    }
    expect(getUserTenantRoles).not.toHaveBeenCalled() // short-circuits before membership lookup
  })

  it('tenant_admin membership → tenant-scoped Where + create allowed', async () => {
    ;(getUserTenantRoles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { tenant: { id: 11 }, role: 'tenant_admin', status: 'active' },
      { tenant: 7, role: 'tenant_manager', status: 'active' },
      { tenant: 9, role: 'tenant_member', status: 'active' }, // not a manager → excluded
    ])
    const u = { id: 3, roles: ['customer'] }
    expect(await call(connectorScopedAccess, u)).toEqual({ tenant: { in: [11, 7] } })
    expect(await call(connectorCreateAccess, u)).toBe(true)
  })

  it('non-manager member is denied', async () => {
    ;(getUserTenantRoles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { tenant: 9, role: 'tenant_member', status: 'active' },
    ])
    const u = { id: 4, roles: ['customer'] }
    expect(await call(connectorScopedAccess, u)).toBe(false)
    expect(await call(connectorCreateAccess, u)).toBe(false)
  })

  it('managerTenantIds handles both populated + id-only tenant refs and fails soft', async () => {
    ;(getUserTenantRoles as ReturnType<typeof vi.fn>).mockResolvedValue([
      { tenant: { id: 1 }, role: 'tenant_admin' },
      { tenant: 2, role: 'tenant_manager' },
    ])
    expect(await managerTenantIds({ id: 5 })).toEqual([1, 2])

    ;(getUserTenantRoles as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('db'))
    expect(await managerTenantIds({ id: 5 })).toEqual([])
    expect(await managerTenantIds(null)).toEqual([])
  })
})
