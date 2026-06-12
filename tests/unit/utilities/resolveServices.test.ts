import { describe, it, expect, vi } from 'vitest'
import { resolveServices } from '@/utilities/resolveServices'

// Static seed: clearwater-cruisin has services in bookableServices.ts.
function mockPayload(serviceDocs: any[] | 'throw', tenantFound = true) {
  return {
    find: vi.fn(async ({ collection }: any) => {
      if (collection === 'tenants') return { docs: tenantFound ? [{ id: 5 }] : [] }
      if (collection === 'services') {
        if (serviceDocs === 'throw') throw new Error('relation "services" does not exist')
        return { totalDocs: serviceDocs.length, docs: serviceDocs }
      }
      return { totalDocs: 0, docs: [] }
    }),
  } as any
}

describe('resolveServices', () => {
  it('returns DB services when the tenant has rows (DB wins)', async () => {
    const payload = mockPayload([
      { serviceId: 'x', label: 'Custom Wash', description: 'd', bookingType: 'service', priceUsd: '50', depositPercent: '20', durationMinutes: '60' },
    ])
    const out = await resolveServices(payload, { tenantSlug: 'clearwater-cruisin' })
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'x', label: 'Custom Wash', priceUSD: 50, depositPercent: 20, durationMinutes: 60 })
  })

  it('falls back to the static seed when the tenant has no DB rows', async () => {
    const payload = mockPayload([]) // empty services table for tenant
    const out = await resolveServices(payload, { tenantSlug: 'clearwater-cruisin' })
    expect(out.length).toBeGreaterThan(0) // from bookableServices static seed
    expect(out.every((s) => typeof s.priceUSD === 'number')).toBe(true)
  })

  it('falls back to the static seed when the services table is missing (pre-migration)', async () => {
    const payload = mockPayload('throw')
    const out = await resolveServices(payload, { tenantSlug: 'clearwater-cruisin' })
    expect(out.length).toBeGreaterThan(0)
  })

  it('returns [] for an unknown tenant with no seed', async () => {
    const payload = mockPayload([], false)
    const out = await resolveServices(payload, { tenantSlug: 'nonexistent-tenant-xyz' })
    expect(out).toEqual([])
  })
})
