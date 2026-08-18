import { describe, it, expect, vi } from 'vitest'
import { seedDemoServices, serviceIdFromName } from '@/utilities/seedDemoServices'
import { TRADE_PACKS } from '@/utilities/demoSiteTemplates'

/**
 * The bug: demo-site wrote services into page COPY only. With no rows in the
 * `services` collection, resolveServices fell back to the static seed — a
 * pressure-washing catalog — so a cleaning company's /book page offered another
 * business's services.
 */

function fakePayload(existing: Array<Record<string, unknown>> = []) {
  const created: Array<Record<string, unknown>> = []
  const payload = {
    find: vi.fn(async ({ where }: { where: { and: Array<Record<string, never>> } }) => {
      const wanted = (where.and[1] as unknown as { serviceId: { equals: string } }).serviceId.equals
      return { docs: existing.filter((e) => e.serviceId === wanted) }
    }),
    create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
      created.push(data)
      return { id: created.length }
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return { payload, created }
}

describe('serviceIdFromName', () => {
  it('is stable and url-safe — bookings store this', () => {
    expect(serviceIdFromName('Commercial & Offices')).toBe('commercial-and-offices')
    expect(serviceIdFromName('Move-In / Move-Out')).toBe('move-in-move-out')
  })
})

describe('seedDemoServices', () => {
  it('creates a bookable row per service in the trade pack', async () => {
    const { payload, created } = fakePayload()
    const res = await seedDemoServices(payload, 33, TRADE_PACKS.cleaning!)

    expect(res.created).toBe(TRADE_PACKS.cleaning!.services.length)
    expect(created.every((c) => c.tenant === 33)).toBe(true)
    expect(created.every((c) => c.enabled === true)).toBe(true)
    expect(created.map((c) => c.label)).toContain('Residential Cleaning')
  })

  it('never invents a price for a stranger, but can still hold a slot', async () => {
    const { payload, created } = fakePayload()
    await seedDemoServices(payload, 33, TRADE_PACKS.cleaning!)

    // A wrong number on their own website is worse than "quoted before work
    // starts", which is what every pack's copy already promises.
    expect(created.every((c) => c.priceUsd === undefined)).toBe(true)
    expect(created.every((c) => c.hourlyRateUsd === undefined)).toBe(true)
    // A percentage of an unknown total is always zero, so the deposit is flat.
    expect(created.every((c) => c.depositFlatUsd === 25)).toBe(true)
  })

  it('is idempotent — re-running a demo site does not duplicate the catalog', async () => {
    const existing = TRADE_PACKS.cleaning!.services.map((s) => ({
      serviceId: serviceIdFromName(s.name),
    }))
    const { payload, created } = fakePayload(existing)
    const res = await seedDemoServices(payload, 33, TRADE_PACKS.cleaning!)

    expect(res.created).toBe(0)
    expect(res.skipped).toBe(TRADE_PACKS.cleaning!.services.length)
    // Must not overwrite a price the owner has since set by hand.
    expect(created).toHaveLength(0)
  })

  it('works for every trade pack, not just the one demoed', async () => {
    for (const [key, pack] of Object.entries(TRADE_PACKS)) {
      const { payload, created } = fakePayload()
      const res = await seedDemoServices(payload, 1, pack)
      expect(res.created, `pack ${key}`).toBe(pack.services.length)
      expect(created.every((c) => typeof c.serviceId === 'string' && c.serviceId)).toBe(true)
    }
  })
})
