/**
 * resolveBookingProvider — picks the provider user a tenant's bookings schedule
 * against: first active tenant_admin, else any active membership, else null.
 */
import { describe, it, expect, vi } from 'vitest'
import { resolveBookingProvider } from '@/utilities/resolveBookingProvider'

function mockPayload(adminUserId: number | null, anyUserId: number | null) {
  const find = vi.fn(async ({ where }: any) => {
    // The first branch filters by role: tenant_admin
    const conds = where?.and || []
    const wantsAdmin = conds.some((c: any) => c?.role?.equals === 'tenant_admin')
    if (wantsAdmin) {
      return { docs: adminUserId != null ? [{ id: 1, user: adminUserId }] : [] }
    }
    return { docs: anyUserId != null ? [{ id: 2, user: anyUserId }] : [] }
  })
  return { find } as any
}

describe('resolveBookingProvider', () => {
  it('returns the first active tenant_admin user id', async () => {
    const payload = mockPayload(3, 9)
    await expect(resolveBookingProvider(payload, 5)).resolves.toBe(3)
  })

  it('falls back to any active membership when no tenant_admin exists', async () => {
    const payload = mockPayload(null, 9)
    await expect(resolveBookingProvider(payload, 5)).resolves.toBe(9)
  })

  it('returns null when the tenant has no active members', async () => {
    const payload = mockPayload(null, null)
    await expect(resolveBookingProvider(payload, 5)).resolves.toBeNull()
  })

  it('handles a relationship object for user (depth>0 shape)', async () => {
    const find = vi.fn(async () => ({ docs: [{ id: 1, user: { id: 7 } }] }))
    await expect(resolveBookingProvider({ find } as any, 5)).resolves.toBe(7)
  })

  it('returns null for an invalid tenantId without querying', async () => {
    const find = vi.fn()
    await expect(resolveBookingProvider({ find } as any, 'not-a-number')).resolves.toBeNull()
    expect(find).not.toHaveBeenCalled()
  })
})
