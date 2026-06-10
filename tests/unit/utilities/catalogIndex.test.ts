import { describe, it, expect } from 'vitest'
import {
  catalogEntryChecksum,
  toCatalogEntry,
  buildCatalogIndexForTenant,
  MAX_CATALOG_ENTRIES_PER_ENDEAVOR,
} from '@/utilities/catalogIndex'

describe('catalogIndex', () => {
  describe('catalogEntryChecksum', () => {
    it('is deterministic and tag-order-insensitive (cross-node dedupe)', () => {
      const a = catalogEntryChecksum({ title: 'Dumpster 20yd', priceCents: 35000, fulfillmentMode: 'network', tags: ['hauling', 'dumpster'] })
      const b = catalogEntryChecksum({ title: 'Dumpster 20yd', priceCents: 35000, fulfillmentMode: 'network', tags: ['dumpster', 'hauling'] })
      expect(a).toBe(b)
    })
    it('changes when a meaningful field changes', () => {
      const base = { title: 'Dumpster 20yd', priceCents: 35000, fulfillmentMode: 'network', tags: ['hauling'] }
      expect(catalogEntryChecksum(base)).not.toBe(catalogEntryChecksum({ ...base, priceCents: 40000 }))
      expect(catalogEntryChecksum(base)).not.toBe(catalogEntryChecksum({ ...base, title: 'Dumpster 30yd' }))
    })
  })

  describe('toCatalogEntry', () => {
    it('maps a product doc into a compact content-addressed entry', () => {
      const entry = toCatalogEntry({
        id: 7,
        title: 'Junk Haul-Away',
        slug: 'junk-haul-away',
        priceInUSD: 250,
        fulfillmentMode: 'network',
        requiredCapabilities: [{ skill: 'hauling' }, { skill: 'dismantling' }, { skill: null }],
      })
      expect(entry.id).toBe(7)
      expect(entry.title).toBe('Junk Haul-Away')
      expect(entry.priceCents).toBe(25000)
      expect(entry.tags).toEqual(['hauling', 'dismantling'])
      expect(entry.fulfillmentMode).toBe('network')
      expect(entry.checksum).toMatch(/^[0-9a-f]{32}$/)
    })
    it('defaults safely on a sparse doc', () => {
      const entry = toCatalogEntry({ id: 1, title: 'Bare' })
      expect(entry.priceCents).toBeUndefined()
      expect(entry.tags).toEqual([])
      expect(entry.fulfillmentMode).toBe('self')
    })
  })

  describe('buildCatalogIndexForTenant', () => {
    it('queries only network-listed products for the tenant and maps them', async () => {
      const calls: unknown[] = []
      const payload = {
        find: async (args: Record<string, unknown>) => {
          calls.push(args)
          return {
            docs: [
              { id: 1, title: 'A', priceInUSD: 10, fulfillmentMode: 'network', requiredCapabilities: [{ skill: 'x' }] },
              { id: 2, title: 'B' },
            ],
          }
        },
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const out = await buildCatalogIndexForTenant(payload as any, 42)
      expect(out).toHaveLength(2)
      expect(out[0].checksum).toMatch(/^[0-9a-f]{32}$/)
      const where = (calls[0] as { where: { and: Array<Record<string, unknown>> } }).where
      expect(where.and).toEqual([{ tenant: { equals: 42 } }, { networkListing: { equals: true } }])
      expect((calls[0] as { limit: number }).limit).toBe(MAX_CATALOG_ENTRIES_PER_ENDEAVOR)
    })
  })
})
