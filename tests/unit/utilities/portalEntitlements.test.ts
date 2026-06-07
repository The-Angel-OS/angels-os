/**
 * computePortalEntitlements — the single source of truth for dashboard auth.
 * Pure policy: one definition of admin / owner / "may manage this portal".
 */
import { describe, it, expect } from 'vitest'
import { computePortalEntitlements } from '@/utilities/portalEntitlements'

const E = computePortalEntitlements

describe('computePortalEntitlements', () => {
  it('anonymous → everything false/empty', () => {
    const e = E({ user: null, tenantId: 5, managedTenantIds: [] })
    expect(e.isAuthenticated).toBe(false)
    expect(e.isPlatformAdmin).toBe(false)
    expect(e.isMemberOfPortal).toBe(false)
    expect(e.can).toEqual({ manageConnectors: false, manageSpaces: false, adminPortal: false })
  })

  it('super_admin → platform admin, all caps for any portal', () => {
    const e = E({ user: { roles: ['super_admin'] }, tenantId: 999, managedTenantIds: [] })
    expect(e.isPlatformAdmin).toBe(true)
    expect(e.isMemberOfPortal).toBe(true)
    expect(e.can.adminPortal).toBe(true)
    expect(e.can.manageConnectors).toBe(true)
    expect(e.can.manageSpaces).toBe(true)
  })

  it('global admin role counts as platform admin (ADMIN_ROLES)', () => {
    expect(E({ user: { roles: ['admin'] }, tenantId: 1, managedTenantIds: [] }).isPlatformAdmin).toBe(true)
  })

  it('owner/staff (non-customer) member of the current portal → can manage connectors', () => {
    const e = E({ user: { roles: ['producer'], tenants: [{ tenant: { id: 5 } }] }, tenantId: 5, managedTenantIds: [] })
    expect(e.isBusinessOwner).toBe(true)
    expect(e.isMemberOfPortal).toBe(true)
    expect(e.can.manageConnectors).toBe(true)
    expect(e.can.manageSpaces).toBe(false) // not a tenant_manager of it
  })

  it('plain customer member → entitled to portal but CANNOT manage connectors', () => {
    const e = E({ user: { roles: ['customer'], tenants: [{ tenant: 5 }] }, tenantId: 5, managedTenantIds: [] })
    expect(e.isMemberOfPortal).toBe(true)
    expect(e.isBusinessOwner).toBe(false)
    expect(e.can.manageConnectors).toBe(false)
  })

  it('tenant_manager of the current portal → manage connectors + spaces', () => {
    const e = E({ user: { roles: ['customer'] }, tenantId: 7, managedTenantIds: [7] })
    expect(e.can.manageConnectors).toBe(true)
    expect(e.can.manageSpaces).toBe(true)
    expect(e.can.adminPortal).toBe(false)
  })

  it('member of another tenant → NOT entitled to the current portal (cross-tenant guard)', () => {
    const e = E({ user: { roles: ['producer'], tenants: [{ tenant: { id: 5 } }] }, tenantId: 42, managedTenantIds: [] })
    expect(e.isMemberOfPortal).toBe(false)
    expect(e.can.manageConnectors).toBe(false)
  })

  it('handles id-only and populated tenant refs; null current tenant', () => {
    const e = E({ user: { roles: ['producer'], tenants: [{ tenant: 5 }, { tenant: { id: 6 } }] }, tenantId: null, managedTenantIds: [] })
    expect(e.memberTenantIds).toEqual([5, 6])
    expect(e.isMemberOfPortal).toBe(false) // no current portal to be entitled to
  })
})
