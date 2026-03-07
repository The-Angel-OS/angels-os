/**
 * Vercel Billing Utility — Sprint 40
 *
 * Queries Vercel's billing API to monitor spend and credits.
 * This is a CIC feed — the bridge needs to know when fuel is running low.
 *
 * Naval metaphor: This is the Chief Engineer's fuel gauge.
 * When credits drop below thresholds, the bridge gets alerted.
 *
 * Uses Vercel REST API v1:
 * - GET /v1/billing/charges — current billing period charges
 *
 * Zero Payload imports — usable in MCP server and edge functions.
 *
 * @see src/endpoints/cic-status.ts — CIC aggregation
 * @see mcp-server/index.ts — vercel_spend_check tool
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VercelSpendSnapshot {
  billingPeriodStart: string
  billingPeriodEnd: string
  totalCharges: number
  chargesByResource: Record<string, number>
  planLimit: number | null
  estimatedRemaining: number | null
  currency: string
  timestamp: string
}

export interface VercelSpendAlert {
  level: 'info' | 'warning' | 'critical'
  threshold: number
  message: string
  spendPercentage: number
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

export const SPEND_THRESHOLDS = {
  info: 0.5, // 50% — log to CIC
  warning: 0.75, // 75% — alert Bridge crew
  critical: 1.0, // 100% — escalate to Captain
} as const

// ---------------------------------------------------------------------------
// API Client
// ---------------------------------------------------------------------------

/**
 * Fetch current billing charges from Vercel.
 *
 * Requires either VERCEL_TOKEN or a passed-in token.
 * The teamId is required for team accounts (most production setups).
 */
export async function getVercelSpend(options: {
  token?: string
  teamId?: string
  planLimit?: number
}): Promise<VercelSpendSnapshot> {
  const token = options.token || process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN || ''
  if (!token) {
    throw new Error('Vercel API token not configured (set VERCEL_TOKEN or VERCEL_API_TOKEN)')
  }

  const teamId = options.teamId || process.env.VERCEL_TEAM_ID || ''
  const teamParam = teamId ? `?teamId=${teamId}` : ''

  // Fetch billing usage from Vercel
  const res = await fetch(`https://api.vercel.com/v1/billing/usage${teamParam}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (!res.ok) {
    // Try the /v4/billing endpoint as fallback
    const fallbackRes = await fetch(
      `https://api.vercel.com/v4/billing${teamParam}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!fallbackRes.ok) {
      throw new Error(
        `Vercel billing API error: ${res.status} ${res.statusText} (and fallback: ${fallbackRes.status})`,
      )
    }

    const fallbackData = (await fallbackRes.json()) as any
    return parseBillingResponse(fallbackData, options.planLimit ?? null)
  }

  const data = (await res.json()) as any
  return parseBillingResponse(data, options.planLimit ?? null)
}

function parseBillingResponse(data: any, planLimit: number | null): VercelSpendSnapshot {
  // Vercel billing responses vary by API version — normalize
  const period = data.period || data.billingPeriod || {}
  const charges = data.charges || data.items || data.usage || {}

  // Aggregate charges by resource type
  const chargesByResource: Record<string, number> = {}
  let totalCharges = 0

  if (Array.isArray(charges)) {
    for (const item of charges) {
      const name = item.name || item.resourceType || item.type || 'other'
      const amount = item.total || item.amount || item.cost || 0
      chargesByResource[name] = (chargesByResource[name] || 0) + amount
      totalCharges += amount
    }
  } else if (typeof charges === 'object') {
    for (const [key, val] of Object.entries(charges)) {
      if (typeof val === 'number') {
        chargesByResource[key] = val
        totalCharges += val
      } else if (typeof val === 'object' && val && 'total' in (val as any)) {
        chargesByResource[key] = (val as any).total
        totalCharges += (val as any).total
      }
    }
  }

  // If totalCharges is still 0 but data has a total field
  if (totalCharges === 0 && typeof data.total === 'number') {
    totalCharges = data.total
  }

  return {
    billingPeriodStart: period.start || period.startDate || new Date().toISOString(),
    billingPeriodEnd: period.end || period.endDate || new Date().toISOString(),
    totalCharges,
    chargesByResource,
    planLimit,
    estimatedRemaining: planLimit != null ? Math.max(0, planLimit - totalCharges) : null,
    currency: data.currency || 'usd',
    timestamp: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Alert evaluation
// ---------------------------------------------------------------------------

/**
 * Evaluate spend against thresholds — returns alerts if any thresholds are crossed.
 */
export function evaluateSpendAlerts(
  snapshot: VercelSpendSnapshot,
): VercelSpendAlert[] {
  if (snapshot.planLimit == null || snapshot.planLimit <= 0) return []

  const percentage = snapshot.totalCharges / snapshot.planLimit
  const alerts: VercelSpendAlert[] = []

  if (percentage >= SPEND_THRESHOLDS.critical) {
    alerts.push({
      level: 'critical',
      threshold: SPEND_THRESHOLDS.critical,
      message: `CRITICAL: Vercel spend at ${(percentage * 100).toFixed(1)}% of plan limit ($${snapshot.totalCharges.toFixed(2)} / $${snapshot.planLimit.toFixed(2)}). Escalate to Captain.`,
      spendPercentage: percentage,
    })
  } else if (percentage >= SPEND_THRESHOLDS.warning) {
    alerts.push({
      level: 'warning',
      threshold: SPEND_THRESHOLDS.warning,
      message: `WARNING: Vercel spend at ${(percentage * 100).toFixed(1)}% of plan limit ($${snapshot.totalCharges.toFixed(2)} / $${snapshot.planLimit.toFixed(2)}). Alert Bridge crew.`,
      spendPercentage: percentage,
    })
  } else if (percentage >= SPEND_THRESHOLDS.info) {
    alerts.push({
      level: 'info',
      threshold: SPEND_THRESHOLDS.info,
      message: `INFO: Vercel spend at ${(percentage * 100).toFixed(1)}% of plan limit ($${snapshot.totalCharges.toFixed(2)} / $${snapshot.planLimit.toFixed(2)}).`,
      spendPercentage: percentage,
    })
  }

  return alerts
}

/**
 * Human-readable spend summary for CIC display.
 */
export function formatSpendSummary(snapshot: VercelSpendSnapshot): string {
  const lines: string[] = [
    `Vercel Billing — ${snapshot.timestamp}`,
    `Period: ${snapshot.billingPeriodStart.slice(0, 10)} → ${snapshot.billingPeriodEnd.slice(0, 10)}`,
    `Total charges: $${snapshot.totalCharges.toFixed(2)} ${snapshot.currency.toUpperCase()}`,
  ]

  if (snapshot.planLimit != null) {
    const pct = ((snapshot.totalCharges / snapshot.planLimit) * 100).toFixed(1)
    lines.push(
      `Plan limit: $${snapshot.planLimit.toFixed(2)}`,
      `Remaining: $${(snapshot.estimatedRemaining ?? 0).toFixed(2)} (${pct}% used)`,
    )
  }

  const resources = Object.entries(snapshot.chargesByResource)
  if (resources.length > 0) {
    lines.push('', 'Charges by resource:')
    for (const [name, amount] of resources.sort((a, b) => b[1] - a[1])) {
      lines.push(`  ${name}: $${amount.toFixed(2)}`)
    }
  }

  return lines.join('\n')
}
