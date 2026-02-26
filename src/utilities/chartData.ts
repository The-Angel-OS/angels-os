/**
 * Chart Data Aggregation — Server-side data fetching for dashboard charts.
 *
 * Queries Payload collections and aggregates into chart-friendly formats.
 * Called from server components (page.tsx) and passed as props to chart components.
 */

import type { Payload, Where } from 'payload'
import type { TimeSeriesPoint, FederationActivityPoint } from '@/components/charts/DashboardCharts'

// ── Revenue Trend ──────────────────────────────────────────────────────

/**
 * Get daily revenue for the last N days.
 * Queries orders with completed payments, groups by date.
 */
export async function getRevenueTimeSeries(
  payload: Payload,
  days: number = 30,
  tenantFilter?: Where,
): Promise<TimeSeriesPoint[]> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  try {
    const orders = await payload.find({
      collection: 'orders' as any,
      where: {
        and: [
          { createdAt: { greater_than: startDate.toISOString() } },
          ...(tenantFilter ? [tenantFilter] : []),
        ],
      },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
      sort: 'createdAt',
    })

    // Group by date
    const byDate = new Map<string, number>()

    // Initialize all days with 0
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      const key = formatDateShort(d)
      byDate.set(key, 0)
    }

    for (const order of orders.docs) {
      const o = order as Record<string, unknown>
      const created = new Date(o.createdAt as string)
      const key = formatDateShort(created)
      const total = (o.total as number) || 0
      byDate.set(key, (byDate.get(key) || 0) + total / 100)
    }

    return Array.from(byDate.entries()).map(([date, value]) => ({
      date,
      value: Math.round(value * 100) / 100,
    }))
  } catch {
    return generateEmptyTimeSeries(days)
  }
}

// ── Order Volume ───────────────────────────────────────────────────────

/**
 * Get daily order count for the last N days.
 */
export async function getOrderVolume(
  payload: Payload,
  days: number = 30,
  tenantFilter?: Where,
): Promise<TimeSeriesPoint[]> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  try {
    const orders = await payload.find({
      collection: 'orders' as any,
      where: {
        and: [
          { createdAt: { greater_than: startDate.toISOString() } },
          ...(tenantFilter ? [tenantFilter] : []),
        ],
      },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
      sort: 'createdAt',
    })

    const byDate = new Map<string, number>()

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      byDate.set(formatDateShort(d), 0)
    }

    for (const order of orders.docs) {
      const o = order as Record<string, unknown>
      const created = new Date(o.createdAt as string)
      const key = formatDateShort(created)
      byDate.set(key, (byDate.get(key) || 0) + 1)
    }

    return Array.from(byDate.entries()).map(([date, value]) => ({ date, value }))
  } catch {
    return generateEmptyTimeSeries(days)
  }
}

// ── Federation Activity ────────────────────────────────────────────────

/**
 * Get daily federation activity breakdown for the last N days.
 */
export async function getFederationActivity(
  payload: Payload,
  days: number = 14,
): Promise<FederationActivityPoint[]> {
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  startDate.setHours(0, 0, 0, 0)

  try {
    const logs = await payload.find({
      collection: 'federation-audit-log' as any,
      where: {
        createdAt: { greater_than: startDate.toISOString() },
      },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
      sort: 'createdAt',
    })

    const byDate = new Map<
      string,
      { heartbeats: number; skillInvocations: number; catalogBrowses: number }
    >()

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      byDate.set(formatDateShort(d), { heartbeats: 0, skillInvocations: 0, catalogBrowses: 0 })
    }

    for (const log of logs.docs) {
      const l = log as Record<string, unknown>
      const created = new Date(l.createdAt as string)
      const key = formatDateShort(created)
      const entry = byDate.get(key)
      if (!entry) continue

      const action = l.action as string
      if (action === 'heartbeat') entry.heartbeats++
      else if (action === 'skill_invoke') entry.skillInvocations++
      else if (action === 'catalog_browse') entry.catalogBrowses++
    }

    return Array.from(byDate.entries()).map(([date, counts]) => ({
      date,
      ...counts,
    }))
  } catch {
    return []
  }
}

// ── Justice Fund ───────────────────────────────────────────────────────

/**
 * Get cumulative justice fund allocations over time.
 */
export async function getJusticeFundGrowth(
  payload: Payload,
  days: number = 30,
): Promise<TimeSeriesPoint[]> {
  try {
    const transactions = await payload.find({
      collection: 'justice-fund-transactions' as any,
      where: {
        type: { equals: 'allocation' },
        status: { equals: 'completed' },
      },
      limit: 1000,
      depth: 0,
      overrideAccess: true,
      sort: 'createdAt',
    })

    if (transactions.docs.length === 0) return []

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    startDate.setHours(0, 0, 0, 0)

    // Calculate cumulative total up to startDate
    let runningTotal = 0
    const recentDocs: Array<Record<string, unknown>> = []

    for (const doc of transactions.docs) {
      const d = doc as Record<string, unknown>
      const created = new Date(d.createdAt as string)
      if (created < startDate) {
        runningTotal += ((d.amountCents as number) || 0) / 100
      } else {
        recentDocs.push(d)
      }
    }

    // Build daily cumulative series
    const byDate = new Map<string, number>()
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      byDate.set(formatDateShort(d), runningTotal)
    }

    for (const d of recentDocs) {
      const created = new Date(d.createdAt as string)
      const key = formatDateShort(created)
      runningTotal += ((d.amountCents as number) || 0) / 100

      // Update this date and all subsequent dates
      let found = false
      for (const [date] of byDate) {
        if (date === key) found = true
        if (found) byDate.set(date, runningTotal)
      }
    }

    return Array.from(byDate.entries()).map(([date, value]) => ({
      date,
      value: Math.round(value * 100) / 100,
    }))
  } catch {
    return []
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function formatDateShort(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function generateEmptyTimeSeries(days: number): TimeSeriesPoint[] {
  const result: TimeSeriesPoint[] = []
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  for (let i = 0; i < days; i++) {
    const d = new Date(startDate)
    d.setDate(d.getDate() + i)
    result.push({ date: formatDateShort(d), value: 0 })
  }

  return result
}
