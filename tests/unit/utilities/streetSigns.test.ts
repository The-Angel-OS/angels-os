/**
 * streetSigns.ts — Unit Tests
 *
 * Tests for the Street Signs federation gossip protocol utility.
 *
 * Covered:
 *   - buildStreetSigns() — builds payload from mocked products, caches result
 *   - mergeStreetSignsForPeer() — stores peer data in the cache
 *   - getStreetSignsForPeer() — retrieves from the cache
 *   - getAllPeerStreetSigns() — returns all cached entries
 *   - Empty products scenario — returns zero-count payload
 *   - Cache re-use — does not re-query if cache is fresh
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  buildStreetSigns,
  mergeStreetSignsForPeer,
  getStreetSignsForPeer,
  getAllPeerStreetSigns,
  clearAllSignsCaches,
  type StreetSignsPayload,
} from '@/utilities/streetSigns'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload(products: any[] = [], totalDocs?: number) {
  return {
    find: vi.fn().mockResolvedValue({
      docs: products,
      totalDocs: totalDocs ?? products.length,
    }),
  } as any
}

function makeProduct(overrides: Record<string, unknown> = {}) {
  return {
    title: 'Test Widget',
    priceInUSD: 25.0,
    category: { title: 'Apparel' },
    capabilities: ['screen-printing', 'embroidery'],
    ...overrides,
  }
}

function makeSigns(overrides: Partial<StreetSignsPayload> = {}): StreetSignsPayload {
  return {
    productCount: 5,
    topCategories: ['Apparel', 'Accessories'],
    featured: [
      {
        productTitle: 'Widget',
        category: 'Apparel',
        priceMin: 2000,
        priceMax: 2000,
        capabilities: ['screen-printing'],
      },
    ],
    lastUpdated: new Date().toISOString(),
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('streetSigns', () => {
  beforeEach(() => {
    clearAllSignsCaches()
  })

  // ── buildStreetSigns ──────────────────────────────────────────────────────

  describe('buildStreetSigns', () => {
    it('returns a StreetSignsPayload with product count from totalDocs', async () => {
      const payload = makePayload(
        [makeProduct(), makeProduct({ title: 'Another Widget', category: { title: 'Accessories' } })],
        42,
      )
      const result = await buildStreetSigns(payload as any)
      expect(result.productCount).toBe(42)
      expect(result.featured).toHaveLength(2)
      expect(result.lastUpdated).toBeTruthy()
    })

    it('computes topCategories sorted by count descending', async () => {
      const products = [
        makeProduct({ category: { title: 'Apparel' } }),
        makeProduct({ category: { title: 'Apparel' } }),
        makeProduct({ category: { title: 'Accessories' } }),
      ]
      const payload = makePayload(products)
      const result = await buildStreetSigns(payload as any)
      expect(result.topCategories[0]).toBe('Apparel')
      expect(result.topCategories[1]).toBe('Accessories')
    })

    it('limits topCategories to 5 entries', async () => {
      const categories = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
      const products = categories.map((c) => makeProduct({ category: { title: c } }))
      const payload = makePayload(products)
      const result = await buildStreetSigns(payload as any)
      expect(result.topCategories.length).toBeLessThanOrEqual(5)
    })

    it('limits featured products to 10', async () => {
      const products = Array.from({ length: 20 }, (_, i) =>
        makeProduct({ title: `Widget ${i}` }),
      )
      const payload = makePayload(products)
      const result = await buildStreetSigns(payload as any)
      expect(result.featured.length).toBeLessThanOrEqual(10)
    })

    it('converts priceInUSD to cents in StreetSign', async () => {
      const payload = makePayload([makeProduct({ priceInUSD: 49.99 })])
      const result = await buildStreetSigns(payload as any)
      expect(result.featured[0].priceMin).toBe(4999)
      expect(result.featured[0].priceMax).toBe(4999)
    })

    it('extracts capabilities from product.capabilities array', async () => {
      const payload = makePayload([makeProduct({ capabilities: ['screen-printing', 'CNC'] })])
      const result = await buildStreetSigns(payload as any)
      expect(result.featured[0].capabilities).toContain('screen-printing')
      expect(result.featured[0].capabilities).toContain('CNC')
    })

    it('falls back to "Uncategorised" when category is missing', async () => {
      const payload = makePayload([makeProduct({ category: undefined })])
      const result = await buildStreetSigns(payload as any)
      expect(result.featured[0].category).toBe('Uncategorised')
    })

    it('returns zero-count payload when products.find throws', async () => {
      const payload = { find: vi.fn().mockRejectedValue(new Error('DB error')) } as any
      const result = await buildStreetSigns(payload as any)
      expect(result.productCount).toBe(0)
      expect(result.featured).toHaveLength(0)
      expect(result.topCategories).toHaveLength(0)
    })

    it('caches result and does NOT re-query on second call within TTL', async () => {
      const payload = makePayload([makeProduct()])
      await buildStreetSigns(payload as any)
      await buildStreetSigns(payload as any)
      // Only 1 call despite 2 invocations (cache hit on second)
      expect(payload.find).toHaveBeenCalledTimes(1)
    })
  })

  // ── mergeStreetSignsForPeer / getStreetSignsForPeer ───────────────────────

  describe('mergeStreetSignsForPeer / getStreetSignsForPeer', () => {
    it('stores and retrieves signs for a known peer', () => {
      const signs = makeSigns()
      mergeStreetSignsForPeer('fed-abc', signs, 'Clearwater Angels', 'clearwater.example.com')

      const entry = getStreetSignsForPeer('fed-abc')
      expect(entry).not.toBeNull()
      expect(entry!.peerId).toBe('fed-abc')
      expect(entry!.peerName).toBe('Clearwater Angels')
      expect(entry!.peerDomain).toBe('clearwater.example.com')
      expect(entry!.signs.productCount).toBe(5)
    })

    it('returns null for unknown peer', () => {
      expect(getStreetSignsForPeer('unknown-peer')).toBeNull()
    })

    it('overwrites existing entry when same peer sends updated signs', () => {
      const signs1 = makeSigns({ productCount: 5 })
      const signs2 = makeSigns({ productCount: 12 })
      mergeStreetSignsForPeer('fed-abc', signs1)
      mergeStreetSignsForPeer('fed-abc', signs2)

      const entry = getStreetSignsForPeer('fed-abc')
      expect(entry!.signs.productCount).toBe(12)
    })

    it('sets receivedAt to a valid ISO timestamp', () => {
      mergeStreetSignsForPeer('fed-xyz', makeSigns())
      const entry = getStreetSignsForPeer('fed-xyz')
      expect(new Date(entry!.receivedAt).toString()).not.toBe('Invalid Date')
    })
  })

  // ── getAllPeerStreetSigns ─────────────────────────────────────────────────

  describe('getAllPeerStreetSigns', () => {
    it('returns empty array when no peers have been merged', () => {
      expect(getAllPeerStreetSigns()).toHaveLength(0)
    })

    it('returns all merged peers', () => {
      mergeStreetSignsForPeer('peer-1', makeSigns({ productCount: 3 }), 'Alpha')
      mergeStreetSignsForPeer('peer-2', makeSigns({ productCount: 7 }), 'Beta')
      const all = getAllPeerStreetSigns()
      expect(all).toHaveLength(2)
      const names = all.map((e) => e.peerName)
      expect(names).toContain('Alpha')
      expect(names).toContain('Beta')
    })

    it('returns a snapshot — modifying the result does not affect the cache', () => {
      mergeStreetSignsForPeer('peer-1', makeSigns())
      const all = getAllPeerStreetSigns()
      all.pop()
      expect(getAllPeerStreetSigns()).toHaveLength(1)
    })
  })
})
