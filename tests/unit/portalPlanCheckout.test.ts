import { describe, expect, it } from 'vitest'
import { PURCHASABLE_PLANS, isPurchasablePlan } from '@/endpoints/portal-plan-checkout'
import { PLAN_PRICE_CENTS, portalCan } from '@/utilities/portalPlan'

describe('which plans can be bought', () => {
  it('is site and business — never free, never demo', () => {
    expect([...PURCHASABLE_PLANS]).toEqual(['site', 'business'])
    expect(isPurchasablePlan('site')).toBe(true)
    expect(isPurchasablePlan('business')).toBe(true)
    // `demo` grants everything and `free` is not sold. A checkout that accepted
    // either would be a way to TALK yourself onto a plan instead of paying.
    expect(isPurchasablePlan('demo')).toBe(false)
    expect(isPurchasablePlan('free')).toBe(false)
    // Agency is granted by hand and its price is not settled. Self-serve
    // checkout must never be able to charge a placeholder.
    expect(isPurchasablePlan('agency')).toBe(false)
    expect(isPurchasablePlan('')).toBe(false)
    expect(isPurchasablePlan(undefined)).toBe(false)
    expect(isPurchasablePlan({ toString: () => 'site' })).toBe(false)
  })

  it('every purchasable plan has a real price', () => {
    for (const plan of PURCHASABLE_PLANS) {
      expect(PLAN_PRICE_CENTS[plan]).toBeGreaterThan(0)
    }
  })
})

describe('the custom-domain gate', () => {
  it('is exactly the line between free and paid', () => {
    // The gate domain-ops now enforces on `add`. If this ever flips, self-serve
    // domain binding gives away the Site plan's headline feature again.
    expect(portalCan({ portalPlan: 'free' }, 'customDomain')).toBe(false)
    expect(portalCan(null, 'customDomain')).toBe(false)
    expect(portalCan({ portalPlan: 'site' }, 'customDomain')).toBe(true)
    expect(portalCan({ portalPlan: 'business' }, 'customDomain')).toBe(true)
    // A demo shows the whole product working, address included.
    expect(portalCan({ portalPlan: 'demo' }, 'customDomain')).toBe(true)
  })
})
