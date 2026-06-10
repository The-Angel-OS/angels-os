import { describe, it, expect } from 'vitest'
import {
  catalogEntryChecksum,
  toCatalogEntry,
  toQuestEntry,
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
      expect(entry.kind).toBe('product')
      expect(entry.checksum).toMatch(/^[0-9a-f]{32}$/)
    })
    it('defaults safely on a sparse doc', () => {
      const entry = toCatalogEntry({ id: 1, title: 'Bare' })
      expect(entry.priceCents).toBeUndefined()
      expect(entry.tags).toEqual([])
      expect(entry.fulfillmentMode).toBe('self')
    })
  })

  describe('toQuestEntry', () => {
    it('maps a quest into a quest-kind entry with payout + karma', () => {
      const entry = toQuestEntry({
        id: 3,
        title: 'Deliver 20yd dumpster to job site',
        slug: 'deliver-dumpster',
        questType: 'delivery',
        difficulty: 'medium',
        payout: { type: 'fixed', amount: 75 },
        reputationReward: 50,
      })
      expect(entry.kind).toBe('quest')
      expect(entry.priceCents).toBe(7500)
      expect(entry.karma).toBe(50)
      expect(entry.tags).toEqual(['delivery', 'medium'])
      expect(entry.fulfillmentMode).toBe('quest')
      expect(entry.checksum).toMatch(/^[0-9a-f]{32}$/)
    })
  })

  describe('buildCatalogIndexForTenant', () => {
    it('queries only network-listed products for the tenant and maps them', async () => {
      const calls: Array<Record<string, unknown>> = []
      const payload = {
        find: async (args: Record<string, unknown>) => {
          calls.push(args)
          if (args.collection === 'quests') {
            return { docs: [{ id: 9, title: 'Q', questType: 'help', payout: { amount: 5 }, reputationReward: 10 }] }
          }
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
      // 2 products + 1 quest, with the quest discriminated by kind
      expect(out).toHaveLength(3)
      expect(out.filter((e) => e.kind === 'product')).toHaveLength(2)
      expect(out.filter((e) => e.kind === 'quest')).toHaveLength(1)
      expect(out[0].checksum).toMatch(/^[0-9a-f]{32}$/)
      const productCall = calls.find((c) => c.collection === 'products') as { where: { and: Array<Record<string, unknown>> }; limit: number }
      expect(productCall.where.and).toEqual([{ tenant: { equals: 42 } }, { networkListing: { equals: true } }])
      expect(productCall.limit).toBe(MAX_CATALOG_ENTRIES_PER_ENDEAVOR)
    })
  })
})
