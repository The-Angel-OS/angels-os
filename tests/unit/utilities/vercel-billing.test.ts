/**
 * vercel-billing — Unit Tests
 *
 * Pure functions: evaluateSpendAlerts, formatSpendSummary
 * Constants: SPEND_THRESHOLDS
 *
 * Sprint 40: CIC Feed — Vercel Credits Monitoring
 */
import { describe, it, expect } from 'vitest'

import {
  evaluateSpendAlerts,
  formatSpendSummary,
  SPEND_THRESHOLDS,
  type VercelSpendSnapshot,
} from '@/utilities/vercel-billing'

// ── Helpers ────────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<VercelSpendSnapshot> = {}): VercelSpendSnapshot {
  return {
    billingPeriodStart: '2026-03-01T00:00:00Z',
    billingPeriodEnd: '2026-03-31T23:59:59Z',
    totalCharges: 0,
    chargesByResource: {},
    planLimit: 20,
    estimatedRemaining: 20,
    currency: 'usd',
    timestamp: '2026-03-07T12:00:00Z',
    ...overrides,
  }
}

// ── SPEND_THRESHOLDS ───────────────────────────────────────────────────────

describe('SPEND_THRESHOLDS', () => {
  it('has three threshold levels', () => {
    expect(SPEND_THRESHOLDS.info).toBe(0.5)
    expect(SPEND_THRESHOLDS.warning).toBe(0.75)
    expect(SPEND_THRESHOLDS.critical).toBe(1.0)
  })

  it('thresholds are in ascending order', () => {
    expect(SPEND_THRESHOLDS.info).toBeLessThan(SPEND_THRESHOLDS.warning)
    expect(SPEND_THRESHOLDS.warning).toBeLessThan(SPEND_THRESHOLDS.critical)
  })
})

// ── evaluateSpendAlerts ────────────────────────────────────────────────────

describe('evaluateSpendAlerts', () => {
  it('returns no alerts when under 50%', () => {
    const snapshot = makeSnapshot({ totalCharges: 5, planLimit: 20 })
    const alerts = evaluateSpendAlerts(snapshot)
    expect(alerts).toHaveLength(0)
  })

  it('returns info alert at 50%', () => {
    const snapshot = makeSnapshot({ totalCharges: 10, planLimit: 20 })
    const alerts = evaluateSpendAlerts(snapshot)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].level).toBe('info')
    expect(alerts[0].spendPercentage).toBeCloseTo(0.5)
  })

  it('returns warning alert at 75%', () => {
    const snapshot = makeSnapshot({ totalCharges: 15, planLimit: 20 })
    const alerts = evaluateSpendAlerts(snapshot)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].level).toBe('warning')
  })

  it('returns critical alert at 100%', () => {
    const snapshot = makeSnapshot({ totalCharges: 20, planLimit: 20 })
    const alerts = evaluateSpendAlerts(snapshot)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].level).toBe('critical')
  })

  it('returns critical alert when over 100%', () => {
    const snapshot = makeSnapshot({ totalCharges: 25, planLimit: 20 })
    const alerts = evaluateSpendAlerts(snapshot)
    expect(alerts).toHaveLength(1)
    expect(alerts[0].level).toBe('critical')
    expect(alerts[0].spendPercentage).toBeCloseTo(1.25)
  })

  it('returns no alerts when planLimit is null', () => {
    const snapshot = makeSnapshot({ totalCharges: 100, planLimit: null })
    const alerts = evaluateSpendAlerts(snapshot)
    expect(alerts).toHaveLength(0)
  })

  it('returns no alerts when planLimit is 0', () => {
    const snapshot = makeSnapshot({ totalCharges: 5, planLimit: 0 })
    const alerts = evaluateSpendAlerts(snapshot)
    expect(alerts).toHaveLength(0)
  })

  it('alert message includes dollar amounts', () => {
    const snapshot = makeSnapshot({ totalCharges: 18, planLimit: 20 })
    const alerts = evaluateSpendAlerts(snapshot)
    expect(alerts[0].message).toContain('$18.00')
    expect(alerts[0].message).toContain('$20.00')
  })
})

// ── formatSpendSummary ─────────────────────────────────────────────────────

describe('formatSpendSummary', () => {
  it('includes total charges', () => {
    const snapshot = makeSnapshot({ totalCharges: 12.50 })
    const text = formatSpendSummary(snapshot)
    expect(text).toContain('$12.50')
  })

  it('includes period dates', () => {
    const snapshot = makeSnapshot()
    const text = formatSpendSummary(snapshot)
    expect(text).toContain('2026-03-01')
    expect(text).toContain('2026-03-31')
  })

  it('includes plan limit and remaining when set', () => {
    const snapshot = makeSnapshot({
      totalCharges: 8,
      planLimit: 20,
      estimatedRemaining: 12,
    })
    const text = formatSpendSummary(snapshot)
    expect(text).toContain('Plan limit: $20.00')
    expect(text).toContain('Remaining: $12.00')
  })

  it('omits plan info when planLimit is null', () => {
    const snapshot = makeSnapshot({ planLimit: null })
    const text = formatSpendSummary(snapshot)
    expect(text).not.toContain('Plan limit')
  })

  it('includes charges by resource', () => {
    const snapshot = makeSnapshot({
      totalCharges: 15,
      chargesByResource: {
        'Serverless Functions': 10,
        'Edge Middleware': 3,
        'Bandwidth': 2,
      },
    })
    const text = formatSpendSummary(snapshot)
    expect(text).toContain('Serverless Functions: $10.00')
    expect(text).toContain('Edge Middleware: $3.00')
    expect(text).toContain('Bandwidth: $2.00')
  })

  it('sorts resources by amount descending', () => {
    const snapshot = makeSnapshot({
      chargesByResource: {
        'Small': 1,
        'Big': 10,
        'Medium': 5,
      },
    })
    const text = formatSpendSummary(snapshot)
    const bigIdx = text.indexOf('Big')
    const medIdx = text.indexOf('Medium')
    const smIdx = text.indexOf('Small')
    expect(bigIdx).toBeLessThan(medIdx)
    expect(medIdx).toBeLessThan(smIdx)
  })
})
