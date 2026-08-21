/**
 * The paywall. Cheap to get wrong in the direction that costs money, so the
 * boundaries are asserted rather than assumed.
 */
import { describe, it, expect } from 'vitest'
import { planOf, portalCan, planRequiredFor } from '@/utilities/portalPlan'

describe('planOf', () => {
  it('treats anything unrecognised as Free', () => {
    expect(planOf(null)).toBe('free')
    expect(planOf({})).toBe('free')
    expect(planOf({ portalPlan: 'enterprise' })).toBe('free')
    expect(planOf({ portalPlan: 'business' })).toBe('business')
  })
})

describe('portalCan', () => {
  it('gives Free the website and nothing that is sold', () => {
    const free = { portalPlan: 'free' }
    expect(portalCan(free, 'customDomain')).toBe(false)
    expect(portalCan(free, 'hideFooterCredit')).toBe(false)
    expect(portalCan(free, 'onlineBooking')).toBe(false)
  })

  it('gives Site the domain and the clean footer, but not booking', () => {
    const site = { portalPlan: 'site' }
    expect(portalCan(site, 'customDomain')).toBe(true)
    expect(portalCan(site, 'hideFooterCredit')).toBe(true)
    // Booking is the $149 line. Site must not cross it.
    expect(portalCan(site, 'onlineBooking')).toBe(false)
    expect(portalCan(site, 'crm')).toBe(false)
  })

  it('gives Business everything', () => {
    const biz = { portalPlan: 'business' }
    for (const cap of ['customDomain', 'hideFooterCredit', 'onlineBooking', 'crm', 'customerAssistant', 'memberships'] as const) {
      expect(portalCan(biz, cap)).toBe(true)
    }
  })
})

describe('planRequiredFor', () => {
  it('names the cheapest plan that unlocks a capability', () => {
    expect(planRequiredFor('customDomain')).toBe('site')
    expect(planRequiredFor('onlineBooking')).toBe('business')
  })
})

describe('the demo tier', () => {
  it('grants everything Business does — the demo IS the pitch', () => {
    for (const cap of [
      'customDomain',
      'hideFooterCredit',
      'onlineBooking',
      'crm',
      'customerAssistant',
      'memberships',
    ] as const) {
      expect(portalCan({ portalPlan: 'demo' }, cap)).toBe(true)
    }
  })

  it('is a plan, not a bypass — an unknown value still falls back to free', () => {
    // The whole point of doing this as a tier: one map answers "what may this
    // portal do", so a typo cannot silently unlock the paid features.
    expect(portalCan({ portalPlan: 'demoo' }, 'onlineBooking')).toBe(false)
    expect(portalCan({ portalPlan: 'DEMO' }, 'onlineBooking')).toBe(false)
    expect(portalCan({}, 'onlineBooking')).toBe(false)
  })

  it('is distinguishable from a paying customer', async () => {
    const { isDemoPortal } = await import('@/utilities/portalPlan')
    expect(isDemoPortal({ portalPlan: 'demo' })).toBe(true)
    expect(isDemoPortal({ portalPlan: 'business' })).toBe(false)
    expect(isDemoPortal(null)).toBe(false)
  })
})
