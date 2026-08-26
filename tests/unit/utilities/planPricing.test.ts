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
    expect(PLAN_PRICE_CENTS).toEqual({ free: 0, site: 2900, business: 7900, demo: 0 })
  })

  it('the monthly buys the booking rate down, and a demo is billed nothing', () => {
    expect(PLAN_FEE_BPS).toEqual({ free: 500, site: 200, business: 0, demo: 0 })
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

  it('a demo portal is never shown an upgrade button', () => {
    const src = readFileSync('src/app/[locale]/(dashboard)/dashboard/plan/page.tsx', 'utf8')
    expect(src).toContain('isUpgrade && !isDemo')
  })
})
