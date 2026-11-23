import { describe, expect, it } from 'vitest'
import { PURCHASABLE_PLANS, isPurchasablePlan } from '@/endpoints/portal-plan-checkout'
import { PLAN_PRICE_CENTS, portalCan } from '@/utilities/portalPlan'

describe('which plans can be bought', () => {
  it('is creator, site (Pro), and business (Studio) — never free, never demo', () => {
    expect([...PURCHASABLE_PLANS]).toEqual(['creator', 'site', 'business'])
    expect(isPurchasablePlan('creator')).toBe(true)
    expect(isPurchasablePlan('site')).toBe(true)
    expect(isPurchasablePlan('business')).toBe(true)
    // `demo` grants working features and `free` is not sold.
    expect(isPurchasablePlan('demo')).toBe(false)
    expect(isPurchasablePlan('free')).toBe(false)
    // Agency is granted by hand and not self-serve.
    expect(isPurchasablePlan('agency')).toBe(false)
    expect(isPurchasablePlan('')).toBe(false)
    expect(isPurchasablePlan(undefined)).toBe(false)
    expect(isPurchasablePlan({ toString: () => 'creator' })).toBe(false)
  })

  it('every purchasable plan has a real price', () => {
    for (const plan of PURCHASABLE_PLANS) {
      expect(PLAN_PRICE_CENTS[plan]).toBeGreaterThan(0)
    }
  })
})

describe('the custom-domain and membership gates', () => {
  it('unlock at $10 Creator rather than waiting for $29 or $79', () => {
    expect(portalCan({ portalPlan: 'free' }, 'customDomain')).toBe(false)
    expect(portalCan({ portalPlan: 'free' }, 'memberships')).toBe(false)
    expect(portalCan(null, 'customDomain')).toBe(false)

    for (const plan of ['creator', 'site', 'business', 'demo'] as const) {
      expect(portalCan({ portalPlan: plan }, 'customDomain')).toBe(true)
      expect(portalCan({ portalPlan: plan }, 'memberships')).toBe(true)
    }
  })
})
