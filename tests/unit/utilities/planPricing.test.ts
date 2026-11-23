import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import {
  PLAN_ANNUAL_PRICE_CENTS,
  PLAN_FEE_BPS,
  PLAN_LABEL,
  PLAN_PRICE_CENTS,
} from '@/utilities/portalPlan'

/**
 * Locked Sprint B pricing ($0 Preview / $10 Creator / $29 Pro / $79 Studio):
 *   • free (Starter Preview): $0/mo, 5% (500 bps)
 *   • creator (Creator): $10/mo ($99/yr), 4% (400 bps)
 *   • site (Pro): $29/mo ($290/yr), 1.5% (150 bps)
 *   • business (Studio): $79/mo ($790/yr), 0% (0 bps)
 */
describe('the plan tables are the one source of pricing', () => {
  it('matches the locked Sprint B creator pricing ladder', () => {
    // `agency` is a PLACEHOLDER price and is deliberately not self-serve — see
    // PURCHASABLE_PLANS.
    expect(PLAN_PRICE_CENTS).toEqual({
      free: 0,
      creator: 1000,
      site: 2900,
      business: 7900,
      agency: 29900,
      demo: 0,
    })
    expect(PLAN_ANNUAL_PRICE_CENTS).toEqual({
      free: 0,
      creator: 9900,
      site: 29000,
      business: 79000,
      agency: 0,
      demo: 0,
    })
  })

  it('steps down the platform fee across Starter (5%) -> Creator (4%) -> Pro (1.5%) -> Studio (0%)', () => {
    expect(PLAN_FEE_BPS).toEqual({
      free: 500,
      creator: 400,
      site: 150,
      business: 0,
      agency: 0,
      demo: 0,
    })
    expect(PLAN_FEE_BPS.creator).toBeLessThan(PLAN_FEE_BPS.free)
    expect(PLAN_FEE_BPS.site).toBeLessThan(PLAN_FEE_BPS.creator)
    expect(PLAN_FEE_BPS.business).toBe(0)
  })

  it('the labels agree with the prices — they are read by humans deciding to pay', () => {
    expect(PLAN_LABEL.creator).toContain(String(PLAN_PRICE_CENTS.creator / 100))
    expect(PLAN_LABEL.site).toContain(String(PLAN_PRICE_CENTS.site / 100))
    expect(PLAN_LABEL.business).toContain(String(PLAN_PRICE_CENTS.business / 100))
  })

  it('the fee resolver consults the plan, not just the settings bag', () => {
    const src = readFileSync('src/utilities/platformFee.ts', 'utf8')
    expect(src).toContain('PLAN_FEE_BPS')
    expect(src).toContain('planOf')
  })

  it('PlanPanel renders the map rather than its own stale numbers', () => {
    const src = readFileSync('src/app/[locale]/(dashboard)/dashboard/plan/PlanPanel.tsx', 'utf8')
    expect(src).toContain('PLAN_PRICE_CENTS')
    expect(src).toContain('PLAN_FEE_BPS')
    expect(src).not.toContain('$149')
    expect(src).not.toContain('$49/mo')
  })

  it('a portal on an OFF-CARD plan is never shown an upgrade button', () => {
    const src = readFileSync('src/app/[locale]/(dashboard)/dashboard/plan/PlanPanel.tsx', 'utf8')
    expect(src).toContain('isUpgrade &&')
    expect(src).toContain('!offCard')
    expect(src).toContain('const offCard = isDemo || isAgency')
  })

  it('the agency tier cannot be bought with a card while its price is a placeholder', async () => {
    const { PURCHASABLE_PLANS } = await import('@/endpoints/portal-plan-checkout')
    expect([...PURCHASABLE_PLANS]).toEqual(['creator', 'site', 'business'])
    expect([...PURCHASABLE_PLANS]).not.toContain('agency')
  })
})
