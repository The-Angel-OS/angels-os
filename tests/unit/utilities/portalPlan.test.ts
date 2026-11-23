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
    expect(planOf({ portalPlan: 'creator' })).toBe('creator')
    expect(planOf({ portalPlan: 'business' })).toBe('business')
  })
})

describe('portalCan', () => {
  it('gives Starter Preview (free) the website and none of the paid unlocks', () => {
    const free = { portalPlan: 'free' }
    expect(portalCan(free, 'customDomain')).toBe(false)
    expect(portalCan(free, 'memberships')).toBe(false)
    expect(portalCan(free, 'customerAssistant')).toBe(false)
    expect(portalCan(free, 'hideFooterCredit')).toBe(false)
    expect(portalCan(free, 'crm')).toBe(false)
  })

  it('unlocks customDomain, memberships, and customerAssistant (LEO AI) at $10 Creator', () => {
    const creator = { portalPlan: 'creator' }
    expect(portalCan(creator, 'customDomain')).toBe(true)
    expect(portalCan(creator, 'memberships')).toBe(true)
    expect(portalCan(creator, 'customerAssistant')).toBe(true)
    // White-label footer removal and CRM sit at $29 Pro.
    expect(portalCan(creator, 'hideFooterCredit')).toBe(false)
    expect(portalCan(creator, 'crm')).toBe(false)
  })

  it('gives Pro ($29 / site) and Studio ($79 / business) all capabilities', () => {
    for (const plan of ['site', 'business'] as const) {
      const portal = { portalPlan: plan }
      for (const cap of [
        'customDomain',
        'hideFooterCredit',
        'crm',
        'customerAssistant',
        'memberships',
      ] as const) {
        expect(portalCan(portal, cap)).toBe(true)
      }
    }
  })
})

describe('planRequiredFor', () => {
  it('names the cheapest plan that unlocks each capability', () => {
    expect(planRequiredFor('customDomain')).toBe('creator')
    expect(planRequiredFor('memberships')).toBe('creator')
    expect(planRequiredFor('customerAssistant')).toBe('creator')
    expect(planRequiredFor('hideFooterCredit')).toBe('site')
    expect(planRequiredFor('crm')).toBe('site')
  })
})

describe('the demo tier', () => {
  it('grants the working features — the demo IS the pitch', () => {
    for (const cap of ['customDomain', 'crm', 'customerAssistant', 'memberships'] as const) {
      expect(portalCan({ portalPlan: 'demo' }, cap)).toBe(true)
    }
  })

  it('keeps the footer credit — the demo is marketing, so it should say who built it', () => {
    expect(portalCan({ portalPlan: 'demo' }, 'hideFooterCredit')).toBe(false)
    expect(portalCan({ portalPlan: 'site' }, 'hideFooterCredit')).toBe(true)
    expect(portalCan({ portalPlan: 'business' }, 'hideFooterCredit')).toBe(true)
  })

  it('is a plan, not a bypass — an unknown value still falls back to free', () => {
    expect(portalCan({ portalPlan: 'demoo' }, 'crm')).toBe(false)
    expect(portalCan({ portalPlan: 'DEMO' }, 'crm')).toBe(false)
    expect(portalCan({}, 'crm')).toBe(false)
  })

  it('is distinguishable from a paying customer', async () => {
    const { isDemoPortal } = await import('@/utilities/portalPlan')
    expect(isDemoPortal({ portalPlan: 'demo' })).toBe(true)
    expect(isDemoPortal({ portalPlan: 'creator' })).toBe(false)
    expect(isDemoPortal({ portalPlan: 'business' })).toBe(false)
    expect(isDemoPortal(null)).toBe(false)
  })
})
