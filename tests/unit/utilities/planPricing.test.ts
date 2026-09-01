import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { PLAN_PRICE_CENTS, PLAN_FEE_BPS, PLAN_LABEL } from '@/utilities/portalPlan'

/**
 * Pricing drifted for months: the decision was $29/$79 with the fee bought down
 * 5% → 2% → 0%, and it lived only in a handoff document. The code still said
 * $49/$149, the public copy said $49, and `getPlatformFeeBps` charged every
 * portal the free rate whatever it paid — so we were selling a discount we did
 * not apply.
 */
describe('the plan tables are the one source of pricing', () => {
  it('is Ken 260823 pricing', () => {
    // `agency` is a PLACEHOLDER price and is deliberately not self-serve — see
    // PURCHASABLE_PLANS. It is asserted here so the number cannot quietly become
    // real without this test being read.
    expect(PLAN_PRICE_CENTS).toEqual({ free: 0, site: 2900, business: 7900, agency: 29900, demo: 0 })
  })

  it('the monthly buys the booking rate down, and a demo is billed nothing', () => {
    // An agency brings us its customers; taking a cut of their clients' sales on
    // top of the tier would be charging twice for one relationship.
    expect(PLAN_FEE_BPS).toEqual({ free: 500, site: 200, business: 0, agency: 0, demo: 0 })
    expect(PLAN_FEE_BPS.site).toBeLessThan(PLAN_FEE_BPS.free)
    expect(PLAN_FEE_BPS.business).toBe(0)
  })

  it('the labels agree with the prices — they are read by humans deciding to pay', () => {
    expect(PLAN_LABEL.site).toContain(String(PLAN_PRICE_CENTS.site / 100))
    expect(PLAN_LABEL.business).toContain(String(PLAN_PRICE_CENTS.business / 100))
  })

  it('the fee resolver consults the plan, not just the settings bag', () => {
    const src = readFileSync('src/utilities/platformFee.ts', 'utf8')
    expect(src).toContain('PLAN_FEE_BPS')
    expect(src).toContain('planOf')
  })

  it('/dashboard/plan renders the map rather than its own numbers', () => {
    const src = readFileSync('src/app/[locale]/(dashboard)/dashboard/plan/page.tsx', 'utf8')
    expect(src).toContain('PLAN_PRICE_CENTS')
    expect(src).not.toContain('$149')
    expect(src).not.toContain('$49/mo')
  })

  it('a portal on an OFF-CARD plan is never shown an upgrade button', () => {
    // demo and agency are both real plans that are not one of the three cards.
    // Without this guard findIndex returns -1 and the page tells them they are
    // on Free, then offers an "upgrade" that takes features away.
    const src = readFileSync('src/app/[locale]/(dashboard)/dashboard/plan/page.tsx', 'utf8')
    expect(src).toContain('isUpgrade && !offCard')
    expect(src).toContain('const offCard = isDemo || isAgency')
  })

  it('the agency tier cannot be bought with a card while its price is a placeholder', async () => {
    const { PURCHASABLE_PLANS } = await import('@/endpoints/portal-plan-checkout')
    expect([...PURCHASABLE_PLANS]).not.toContain('agency')
  })
})
