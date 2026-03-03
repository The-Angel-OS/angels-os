/**
 * chartData — Unit Tests
 *
 * Tests revenue/order time-series aggregation, federation activity bucketing,
 * and justice fund cumulative growth. Payload is passed as a parameter.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  getRevenueTimeSeries,
  getOrderVolume,
  getFederationActivity,
  getJusticeFundGrowth,
} from '@/utilities/chartData'

// ── Helpers ─────────────────────────────────────────────────────────────────

function makePayload(docs: unknown[] = []) {
  return { find: vi.fn().mockResolvedValue({ docs }) } as any
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

function makeOrder(total: number, daysBack: number) {
  return { total, createdAt: daysAgo(daysBack) }
}

// ── getRevenueTimeSeries ──────────────────────────────────────────────────────

describe('getRevenueTimeSeries', () => {
  it('returns a series with exactly `days` entries', async () => {
    const payload = makePayload([])
    const result = await getRevenueTimeSeries(payload, 7)
    expect(result).toHaveLength(7)
  })

  it('initialises all days to 0 when there are no orders', async () => {
    const payload = makePayload([])
    const result = await getRevenueTimeSeries(payload, 3)
    expect(result.every(p => p.value === 0)).toBe(true)
  })

  it('accumulates order totals into the correct date bucket', async () => {
    // An order from yesterday with total = 1000 cents = $10.00
    const payload = makePayload([makeOrder(1000, 1)])
    const result = await getRevenueTimeSeries(payload, 3)
    // Yesterday's entry (last in series) should have $10
    const last = result[result.length - 1]
    expect(last.value).toBe(10)
  })

  it('sums multiple orders on the same day', async () => {
    const payload = makePayload([makeOrder(500, 1), makeOrder(700, 1)])
    const result = await getRevenueTimeSeries(payload, 3)
    const last = result[result.length - 1]
    expect(last.value).toBeCloseTo(12, 1) // (500+700)/100 = 12.00
  })

  it('keeps cents-to-dollars precision (no floating-point errors)', async () => {
    const payload = makePayload([makeOrder(100, 1), makeOrder(100, 1), makeOrder(100, 1)])
    const result = await getRevenueTimeSeries(payload, 2)
    expect(result[result.length - 1].value).toBe(3)
  })

  it('returns empty series on payload.find failure', async () => {
    const payload = { find: vi.fn().mockRejectedValue(new Error('DB fail')) } as any
    const result = await getRevenueTimeSeries(payload, 5)
    expect(result).toHaveLength(5)
    expect(result.every(p => p.value === 0)).toBe(true)
  })

  it('each entry has a date string', async () => {
    const payload = makePayload([])
    const result = await getRevenueTimeSeries(payload, 3)
    result.forEach(p => {
      expect(typeof p.date).toBe('string')
      expect(p.date.length).toBeGreaterThan(0)
    })
  })
})

// ── getOrderVolume ────────────────────────────────────────────────────────────

describe('getOrderVolume', () => {
  it('returns a series with exactly `days` entries', async () => {
    const payload = makePayload([])
    const result = await getOrderVolume(payload, 7)
    expect(result).toHaveLength(7)
  })

  it('counts one order per entry', async () => {
    const payload = makePayload([makeOrder(0, 1)])
    const result = await getOrderVolume(payload, 3)
    const last = result[result.length - 1]
    expect(last.value).toBe(1)
  })

  it('counts multiple orders on same day', async () => {
    const payload = makePayload([makeOrder(0, 1), makeOrder(0, 1), makeOrder(0, 1)])
    const result = await getOrderVolume(payload, 3)
    const last = result[result.length - 1]
    expect(last.value).toBe(3)
  })

  it('returns empty series on payload.find failure', async () => {
    const payload = { find: vi.fn().mockRejectedValue(new Error('DB')) } as any
    const result = await getOrderVolume(payload, 5)
    expect(result).toHaveLength(5)
    expect(result.every(p => p.value === 0)).toBe(true)
  })
})

// ── getFederationActivity ─────────────────────────────────────────────────────

describe('getFederationActivity', () => {
  function makeLog(action: string, daysBack: number) {
    return { action, createdAt: daysAgo(daysBack) }
  }

  it('returns a series with exactly `days` entries', async () => {
    const payload = makePayload([])
    const result = await getFederationActivity(payload, 7)
    expect(result).toHaveLength(7)
  })

  it('counts heartbeat events', async () => {
    const payload = makePayload([makeLog('heartbeat', 1)])
    const result = await getFederationActivity(payload, 3)
    const last = result[result.length - 1]
    expect(last.heartbeats).toBe(1)
  })

  it('counts skill_invoke events', async () => {
    const payload = makePayload([makeLog('skill_invoke', 1)])
    const result = await getFederationActivity(payload, 3)
    const last = result[result.length - 1]
    expect(last.skillInvocations).toBe(1)
  })

  it('counts catalog_browse events', async () => {
    const payload = makePayload([makeLog('catalog_browse', 1)])
    const result = await getFederationActivity(payload, 3)
    const last = result[result.length - 1]
    expect(last.catalogBrowses).toBe(1)
  })

  it('ignores unknown action types', async () => {
    const payload = makePayload([makeLog('unknown_action', 1)])
    const result = await getFederationActivity(payload, 3)
    const last = result[result.length - 1]
    expect(last.heartbeats).toBe(0)
    expect(last.skillInvocations).toBe(0)
    expect(last.catalogBrowses).toBe(0)
  })

  it('returns [] on payload.find failure', async () => {
    const payload = { find: vi.fn().mockRejectedValue(new Error('DB')) } as any
    const result = await getFederationActivity(payload, 5)
    expect(result).toEqual([])
  })
})

// ── getJusticeFundGrowth ──────────────────────────────────────────────────────

describe('getJusticeFundGrowth', () => {
  function makeTransaction(amountCents: number, daysBack: number) {
    return {
      type: 'allocation',
      status: 'completed',
      amountCents,
      createdAt: daysAgo(daysBack),
    }
  }

  it('returns [] when there are no transactions', async () => {
    const payload = makePayload([])
    const result = await getJusticeFundGrowth(payload, 7)
    expect(result).toEqual([])
  })

  it('returns a series with `days` entries when transactions exist', async () => {
    const payload = makePayload([makeTransaction(1000, 0)])
    const result = await getJusticeFundGrowth(payload, 7)
    expect(result).toHaveLength(7)
  })

  it('accumulates amount on the transaction date', async () => {
    const payload = makePayload([makeTransaction(500, 1)])
    const result = await getJusticeFundGrowth(payload, 3)
    // Last entry should show $5
    const last = result[result.length - 1]
    expect(last.value).toBeGreaterThanOrEqual(5)
  })

  it('carries running total forward for all dates after a transaction', async () => {
    const payload = makePayload([makeTransaction(1000, 2)])
    const result = await getJusticeFundGrowth(payload, 5)
    // Entries from 2 days ago onward should carry the $10 total
    const recent = result.slice(-2)
    recent.forEach(p => expect(p.value).toBeGreaterThanOrEqual(10))
  })

  it('returns [] on payload.find failure', async () => {
    const payload = { find: vi.fn().mockRejectedValue(new Error('DB')) } as any
    const result = await getJusticeFundGrowth(payload, 7)
    expect(result).toEqual([])
  })
})
