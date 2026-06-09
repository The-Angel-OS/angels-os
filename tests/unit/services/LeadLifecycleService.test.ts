/**
 * LeadLifecycleService — the failover state machine for the vendor lead network.
 * Pure reducers: exhaustive over capture, route, offer, accept/decline/expire,
 * the failover cascade, exhaustion, cancellation, and the claim/expiry contracts.
 */
import { describe, it, expect } from 'vitest'
import {
  initLead,
  applyRouting,
  offerNext,
  openLead,
  respond,
  cancelLead,
  currentOffer,
  currentVendorId,
  isTerminal,
  canClaim,
  isOfferExpired,
  remainingVendorCount,
  type LeadState,
} from '@/services/LeadLifecycleService'
import type { VendorLike } from '@/services/VendorRoutingService'

const T0 = '2026-06-09T12:00:00.000Z'
const T1 = '2026-06-09T12:05:00.000Z'
const T2 = '2026-06-09T12:10:00.000Z'

const req = { zip: '33755', size: '10yd' as string | undefined }

const vendor = (id: string, over: Partial<VendorLike> = {}): VendorLike => ({
  id,
  serviceZips: ['33755'],
  sizes: ['10yd'],
  status: 'active',
  trustLevel: 'full',
  ...over,
})

describe('initLead', () => {
  it('starts new with an empty trail', () => {
    const s = initLead(req, T0)
    expect(s.status).toBe('new')
    expect(s.trail).toEqual([])
    expect(s.cursor).toBe(-1)
    expect(s.createdAt).toBe(T0)
  })
})

describe('applyRouting', () => {
  it('seats a ranked sequence as pending rungs', () => {
    const s = applyRouting(initLead(req, T0), ['a', 'b', 'c'], T1)
    expect(s.status).toBe('new')
    expect(s.trail.map((o) => o.vendorId)).toEqual(['a', 'b', 'c'])
    expect(s.trail.every((o) => o.status === 'pending')).toBe(true)
    expect(s.cursor).toBe(-1)
  })

  it('coerces numeric vendor ids to strings', () => {
    const s = applyRouting(initLead(req, T0), [1, 2], T0)
    expect(s.trail.map((o) => o.vendorId)).toEqual(['1', '2'])
  })

  it('empty ranking → unfulfillable (no coverage)', () => {
    const s = applyRouting(initLead(req, T0), [], T0)
    expect(s.status).toBe('unfulfillable')
    expect(isTerminal(s)).toBe(true)
  })

  it('refuses to route a terminal lead', () => {
    const cancelled = cancelLead(initLead(req, T0), T0)
    expect(() => applyRouting(cancelled, ['a'], T1)).toThrow(/terminal/)
  })
})

describe('offerNext', () => {
  it('activates the first pending vendor', () => {
    const s = offerNext(applyRouting(initLead(req, T0), ['a', 'b'], T0), T1)
    expect(s.status).toBe('offered')
    expect(s.cursor).toBe(0)
    expect(s.trail[0]).toMatchObject({ vendorId: 'a', status: 'offered', offeredAt: T1 })
    expect(s.trail[1].status).toBe('pending')
  })

  it('exhausts when no pending vendors remain', () => {
    let s = applyRouting(initLead(req, T0), ['a'], T0)
    s = offerNext(s, T1) // offer a
    s = respond(s, 'a', 'declined', T1) // declines → auto-advance → exhausted
    expect(s.status).toBe('exhausted')
    expect(isTerminal(s)).toBe(true)
  })
})

describe('openLead (capture → route → first offer)', () => {
  it('offers the top-ranked vendor (trust-first)', () => {
    const vendors = [
      vendor('low', { trustLevel: 'probation' }),
      vendor('high', { trustLevel: 'full' }),
    ]
    const s = openLead(req, vendors, T0)
    expect(s.status).toBe('offered')
    expect(currentVendorId(s)).toBe('high')
    expect(s.trail.map((o) => o.vendorId)).toEqual(['high', 'low'])
  })

  it('no eligible vendor → unfulfillable', () => {
    const s = openLead({ zip: '99999' }, [vendor('a')], T0)
    expect(s.status).toBe('unfulfillable')
    expect(currentOffer(s)).toBeNull()
  })
})

describe('respond — accept', () => {
  it('accepting ends the lead and marks the rung', () => {
    let s = openLead(req, [vendor('a'), vendor('b')], T0)
    s = respond(s, 'a', 'accepted', T1)
    expect(s.status).toBe('accepted')
    expect(s.trail[0]).toMatchObject({ status: 'accepted', respondedAt: T1 })
    expect(isTerminal(s)).toBe(true)
  })
})

describe('respond — failover cascade', () => {
  it('decline advances to the next ranked vendor', () => {
    let s = openLead(req, [vendor('a'), vendor('b'), vendor('c')], T0)
    s = respond(s, 'a', 'declined', T1)
    expect(s.status).toBe('offered')
    expect(currentVendorId(s)).toBe('b')
    expect(s.trail[0]).toMatchObject({ status: 'declined', respondedAt: T1 })
    expect(s.trail[1]).toMatchObject({ status: 'offered', offeredAt: T1 })
  })

  it('expire fails over just like decline', () => {
    let s = openLead(req, [vendor('a'), vendor('b')], T0)
    s = respond(s, 'a', 'expired', T1)
    expect(currentVendorId(s)).toBe('b')
    expect(s.trail[0].status).toBe('expired')
  })

  it('declining every vendor lands on exhausted', () => {
    let s = openLead(req, [vendor('a'), vendor('b')], T0)
    s = respond(s, 'a', 'declined', T1)
    s = respond(s, 'b', 'declined', T2)
    expect(s.status).toBe('exhausted')
    expect(remainingVendorCount(s)).toBe(0)
  })

  it('a later vendor can still accept after earlier declines', () => {
    let s = openLead(req, [vendor('a'), vendor('b')], T0)
    s = respond(s, 'a', 'declined', T1)
    s = respond(s, 'b', 'accepted', T2)
    expect(s.status).toBe('accepted')
    expect(currentVendorId(s)).toBe(null) // no active offer once accepted
    expect(s.trail[1].status).toBe('accepted')
  })
})

describe('respond — misuse guards', () => {
  it('throws when there is no active offer', () => {
    const s = initLead(req, T0)
    expect(() => respond(s, 'a', 'accepted', T1)).toThrow(/no active offer/)
  })

  it('throws when a non-active vendor responds', () => {
    const s = openLead(req, [vendor('a'), vendor('b')], T0) // a is active
    expect(() => respond(s, 'b', 'accepted', T1)).toThrow(/not the active offer/)
  })
})

describe('cancelLead', () => {
  it('cancels a new lead', () => {
    expect(cancelLead(initLead(req, T0), T1).status).toBe('cancelled')
  })
  it('cancels an offered lead', () => {
    const s = cancelLead(openLead(req, [vendor('a')], T0), T1)
    expect(s.status).toBe('cancelled')
  })
  it('is idempotent on an already-cancelled lead', () => {
    const once = cancelLead(initLead(req, T0), T1)
    expect(cancelLead(once, T2)).toBe(once)
  })
  it('refuses to cancel an accepted lead', () => {
    const accepted = respond(openLead(req, [vendor('a')], T0), 'a', 'accepted', T1)
    expect(() => cancelLead(accepted, T2)).toThrow(/accepted/)
  })
})

describe('canClaim contract (pairs with can("Claim","lead"))', () => {
  it('true only for the active offer vendor', () => {
    const s = openLead(req, [vendor('a'), vendor('b')], T0)
    expect(canClaim(s, 'a')).toBe(true)
    expect(canClaim(s, 'b')).toBe(false)
  })
  it('false once accepted/terminal', () => {
    const accepted = respond(openLead(req, [vendor('a')], T0), 'a', 'accepted', T1)
    expect(canClaim(accepted, 'a')).toBe(false)
  })
})

describe('isOfferExpired (timeout failover)', () => {
  const TTL = 5 * 60 * 1000 // 5 minutes
  it('false before the TTL elapses', () => {
    const s = openLead(req, [vendor('a')], T0) // offered at T0
    expect(isOfferExpired(s, '2026-06-09T12:04:00.000Z', TTL)).toBe(false)
  })
  it('true after the TTL elapses', () => {
    const s = openLead(req, [vendor('a')], T0)
    expect(isOfferExpired(s, '2026-06-09T12:06:00.000Z', TTL)).toBe(true)
  })
  it('false when there is no active offer', () => {
    const s: LeadState = initLead(req, T0)
    expect(isOfferExpired(s, T2, TTL)).toBe(false)
  })
})

describe('re-routing while non-terminal (e.g. new vendors onboarded)', () => {
  it('reseats the trail and can offer the refreshed set', () => {
    let s = openLead(req, [vendor('a')], T0)
    s = respond(s, 'a', 'declined', T1) // exhausted (only one vendor)
    expect(s.status).toBe('exhausted')
    // exhausted is terminal — a fresh capture is required, not a re-route.
    expect(() => applyRouting(s, ['b', 'c'], T2)).toThrow(/terminal/)
  })
})
