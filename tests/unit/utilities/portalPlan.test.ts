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
    expect(portalCan(free, 'crm')).toBe(false)
  })

  it('gives Site the domain and the clean footer, but not the CRM', () => {
    const site = { portalPlan: 'site' }
    expect(portalCan(site, 'customDomain')).toBe(true)
    expect(portalCan(site, 'hideFooterCredit')).toBe(true)
    // The CRM is the Business line. Site must not cross it.
    expect(portalCan(site, 'crm')).toBe(false)
  })

  it('gives Business everything', () => {
    const biz = { portalPlan: 'business' }
    for (const cap of ['customDomain', 'hideFooterCredit', 'crm', 'customerAssistant', 'memberships'] as const) {
      expect(portalCan(biz, cap)).toBe(true)
    }
  })
})

describe('planRequiredFor', () => {
  it('names the cheapest plan that unlocks a capability', () => {
    expect(planRequiredFor('customDomain')).toBe('site')
    expect(planRequiredFor('crm')).toBe('business')
  })
})

describe('the demo tier', () => {
  it('grants the working features — the demo IS the pitch', () => {
    for (const cap of [
      'customDomain',
      'crm',
      'customerAssistant',
      'memberships',
    ] as const) {
      expect(portalCan({ portalPlan: 'demo' }, cap)).toBe(true)
    }
  })

  it('keeps the footer credit — the demo is marketing, so it should say who built it', () => {
    // The one capability Business has that demo must NOT: hiding the credit on
    // the page a prospect shows their friends would throw away the only
    // distribution the free work buys.
    expect(portalCan({ portalPlan: 'demo' }, 'hideFooterCredit')).toBe(false)
    expect(portalCan({ portalPlan: 'business' }, 'hideFooterCredit')).toBe(true)
  })

  it('is a plan, not a bypass — an unknown value still falls back to free', () => {
    // The whole point of doing this as a tier: one map answers "what may this
    // portal do", so a typo cannot silently unlock the paid features.
    expect(portalCan({ portalPlan: 'demoo' }, 'crm')).toBe(false)
    expect(portalCan({ portalPlan: 'DEMO' }, 'crm')).toBe(false)
    expect(portalCan({}, 'crm')).toBe(false)
  })

  it('is distinguishable from a paying customer', async () => {
    const { isDemoPortal } = await import('@/utilities/portalPlan')
    expect(isDemoPortal({ portalPlan: 'demo' })).toBe(true)
    expect(isDemoPortal({ portalPlan: 'business' })).toBe(false)
    expect(isDemoPortal(null)).toBe(false)
  })
})
