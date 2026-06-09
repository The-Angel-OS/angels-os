/**
 * VendorRoutingService.matchVendors — the deterministic lead-routing core.
 * Leads must never mis-route or dead-end: service-area, size, capacity, trust rank.
 */
import { describe, it, expect } from 'vitest'
import { matchVendors, bestVendor, normalizeZip, type VendorLike } from '@/services/VendorRoutingService'

const V = (over: Partial<VendorLike>): VendorLike => ({
  id: 1,
  serviceZips: ['33755'],
  sizes: ['10yd', '15yd'],
  status: 'active',
  trustLevel: 'vouched',
  ...over,
})

describe('normalizeZip', () => {
  it('strips ZIP+4 and whitespace to 5 digits', () => {
    expect(normalizeZip(' 33755-1234 ')).toBe('33755')
    expect(normalizeZip('33756')).toBe('33756')
  })
})

describe('matchVendors', () => {
  it('matches a vendor that serves the zip and size', () => {
    const out = matchVendors({ zip: '33755', size: '10yd' }, [V({ id: 1 })])
    expect(out.map((v) => v.id)).toEqual([1])
  })

  it('excludes a vendor that does not serve the zip', () => {
    const out = matchVendors({ zip: '99999', size: '10yd' }, [V({ id: 1 })])
    expect(out).toEqual([])
  })

  it('excludes a vendor that does not offer the size', () => {
    const out = matchVendors({ zip: '33755', size: '30yd' }, [V({ id: 1, sizes: ['10yd'] })])
    expect(out).toEqual([])
  })

  it('treats a vendor with no declared sizes as serving any size', () => {
    const out = matchVendors({ zip: '33755', size: '30yd' }, [V({ id: 1, sizes: [] })])
    expect(out.map((v) => v.id)).toEqual([1])
  })

  it('matches any size when the request omits size', () => {
    const out = matchVendors({ zip: '33755' }, [V({ id: 1, sizes: ['10yd'] })])
    expect(out.map((v) => v.id)).toEqual([1])
  })

  it('excludes paused vendors', () => {
    const out = matchVendors({ zip: '33755', size: '10yd' }, [V({ id: 1, status: 'paused' })])
    expect(out).toEqual([])
  })

  it('ranks by trust: full > vouched > probation', () => {
    const vendors = [
      V({ id: 1, trustLevel: 'probation' }),
      V({ id: 2, trustLevel: 'full' }),
      V({ id: 3, trustLevel: 'vouched' }),
    ]
    expect(matchVendors({ zip: '33755', size: '10yd' }, vendors).map((v) => v.id)).toEqual([2, 3, 1])
  })

  it('respects capacity caps and prefers more headroom within a trust tier', () => {
    const vendors = [
      V({ id: 1, trustLevel: 'full', maxConcurrent: 2 }),
      V({ id: 2, trustLevel: 'full', maxConcurrent: 5 }),
      V({ id: 3, trustLevel: 'full', maxConcurrent: 2 }), // at capacity → excluded
    ]
    const out = matchVendors(
      { zip: '33755', size: '10yd', activeCounts: { '1': 1, '2': 1, '3': 2 } },
      vendors,
    )
    // id 3 is full (2/2); id 2 has more headroom (4) than id 1 (1) → [2,1]
    expect(out.map((v) => v.id)).toEqual([2, 1])
  })

  it('normalizes zips on both sides (ZIP+4 request matches 5-digit coverage)', () => {
    const out = matchVendors({ zip: '33755-9000', size: '10yd' }, [V({ id: 1, serviceZips: ['33755'] })])
    expect(out.map((v) => v.id)).toEqual([1])
  })

  it('coerces a JSON-string serviceZips field (jsonb round-trip safety)', () => {
    const out = matchVendors({ zip: '33755', size: '10yd' }, [V({ id: 1, serviceZips: '["33755","33756"]' })])
    expect(out.map((v) => v.id)).toEqual([1])
  })

  it('returns a ranked LIST for failover, and bestVendor picks the head', () => {
    const vendors = [V({ id: 1, trustLevel: 'probation' }), V({ id: 2, trustLevel: 'full' })]
    const ranked = matchVendors({ zip: '33755', size: '10yd' }, vendors)
    expect(ranked.length).toBe(2) // both eligible → caller can fail over
    expect(bestVendor({ zip: '33755', size: '10yd' }, vendors)?.id).toBe(2)
    expect(bestVendor({ zip: '00000' }, vendors)).toBeNull()
  })
})

describe('matchVendors — minTrust eligibility (liability gate)', () => {
  const vendors = [
    V({ id: 'prob', trustLevel: 'probation' }),
    V({ id: 'vouch', trustLevel: 'vouched' }),
    V({ id: 'full', trustLevel: 'full' }),
  ]

  it('no minTrust → all eligible (probation still ranks last)', () => {
    const out = matchVendors({ zip: '33755' }, vendors)
    expect(out.map((v) => v.id)).toEqual(['full', 'vouch', 'prob'])
  })

  it("minTrust 'vouched' excludes probation (verified-insured only)", () => {
    const out = matchVendors({ zip: '33755', minTrust: 'vouched' }, vendors)
    expect(out.map((v) => v.id)).toEqual(['full', 'vouch'])
  })

  it("minTrust 'full' admits only fully-trusted vendors", () => {
    const out = matchVendors({ zip: '33755', minTrust: 'full' }, vendors)
    expect(out.map((v) => v.id)).toEqual(['full'])
  })

  it("minTrust 'probation' admits everyone (floor)", () => {
    const out = matchVendors({ zip: '33755', minTrust: 'probation' }, vendors)
    expect(out.map((v) => v.id).sort()).toEqual(['full', 'prob', 'vouch'])
  })

  it('a vendor with a missing trustLevel is treated as probation (gated out by vouched+)', () => {
    const out = matchVendors({ zip: '33755', minTrust: 'vouched' }, [V({ id: 'x', trustLevel: null })])
    expect(out).toEqual([])
  })
})
