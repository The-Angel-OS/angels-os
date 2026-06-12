/**
 * meterHourly — the metering + invoice math for service jobs.
 *
 * Turns "time actually on the clock" into a bill. A job accrues WORK SEGMENTS
 * (clock-in → clock-out); a phone call or break is a clock-out, so it's never
 * billed. Billable time = summed segments rounded to the service's increment
 * (1 = exact minutes, like Ronald), with an optional minimum. The invoice =
 * labor (hourly × billable, or fixed, or per-unit) + extra-cost line items
 * (materials / disposal / trip fee).
 *
 * Pure + deterministic — pass `now` for open segments (no Date.now) so it's
 * testable. Stored on Bookings.metadata.workSession by the booking-ops endpoints.
 *
 * @see src/endpoints/booking-work-session.ts  @see src/collections/Services
 */

export interface WorkSegment {
  /** ISO clock-in. */
  in: string
  /** ISO clock-out; absent = still on the clock. */
  out?: string
}

export interface InvoiceLine {
  label: string
  amountCents: number
}

export interface Invoice {
  laborCents: number
  costsCents: number
  totalCents: number
  lines: InvoiceLine[]
  billedMinutes?: number
}

/** Minutes in a single segment (open segment measured to `now`). */
export function segmentMinutes(seg: WorkSegment, now?: string): number {
  const start = Date.parse(seg.in)
  const end = seg.out ? Date.parse(seg.out) : now ? Date.parse(now) : NaN
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0
  return (end - start) / 60000
}

/** Total minutes actually on the clock across all segments. */
export function workedMinutes(segments: WorkSegment[], now?: string): number {
  return (segments || []).reduce((sum, s) => sum + segmentMinutes(s, now), 0)
}

/**
 * Billable minutes: worked time rounded UP to the increment, then floored to the
 * minimum. increment 1 = bill exact whole minutes.
 */
export function billableMinutes(
  segments: WorkSegment[],
  opts: { incrementMinutes?: number; minimumMinutes?: number } = {},
  now?: string,
): number {
  const inc = Math.max(1, Math.round(opts.incrementMinutes ?? 1))
  const raw = workedMinutes(segments, now)
  let billed = Math.ceil(raw / inc) * inc
  if (opts.minimumMinutes && billed < opts.minimumMinutes) billed = opts.minimumMinutes
  return billed
}

const dollars = (cents: number) => (cents / 100).toFixed(2)

/** Build the invoice for a job. All money in cents. */
export function computeInvoice(input: {
  pricingModel: 'fixed' | 'hourly' | 'per_unit'
  hourlyRateCents?: number
  billedMinutes?: number
  fixedPriceCents?: number
  unitRateCents?: number
  units?: number
  unitLabel?: string
  extraCosts?: InvoiceLine[]
}): Invoice {
  const lines: InvoiceLine[] = []
  let laborCents = 0

  if (input.pricingModel === 'hourly') {
    const mins = Math.max(0, input.billedMinutes ?? 0)
    const rate = input.hourlyRateCents ?? 0
    laborCents = Math.round((rate * mins) / 60)
    lines.push({ label: `Labor — ${mins} min @ $${dollars(rate)}/hr`, amountCents: laborCents })
  } else if (input.pricingModel === 'per_unit') {
    const units = Math.max(0, input.units ?? 0)
    const rate = input.unitRateCents ?? 0
    laborCents = Math.round(rate * units)
    lines.push({ label: `${units} ${input.unitLabel || 'unit'} @ $${dollars(rate)}`, amountCents: laborCents })
  } else {
    laborCents = input.fixedPriceCents ?? 0
    lines.push({ label: 'Service', amountCents: laborCents })
  }

  const extras = input.extraCosts ?? []
  const costsCents = extras.reduce((s, c) => s + (c.amountCents || 0), 0)
  lines.push(...extras)

  return {
    laborCents,
    costsCents,
    totalCents: laborCents + costsCents,
    lines,
    billedMinutes: input.billedMinutes,
  }
}

// ─── Work-session state transitions (pure; endpoints persist the result) ───────
export interface WorkSession {
  segments: WorkSegment[]
  extraCosts: InvoiceLine[]
  invoice?: Invoice
  finalizedAt?: string
}

export function emptySession(): WorkSession {
  return { segments: [], extraCosts: [] }
}

/** True if the clock is currently running (a segment is open). */
export function isOnClock(s: WorkSession): boolean {
  const last = s.segments[s.segments.length - 1]
  return Boolean(last && !last.out)
}

/** Clock in — opens a new segment. No-op if already on the clock. */
export function clockIn(s: WorkSession, now: string): WorkSession {
  if (isOnClock(s)) return s
  return { ...s, segments: [...s.segments, { in: now }] }
}

/** Clock out — closes the open segment. No-op if not on the clock. */
export function clockOut(s: WorkSession, now: string): WorkSession {
  if (!isOnClock(s)) return s
  const segments = s.segments.slice()
  segments[segments.length - 1] = { ...segments[segments.length - 1], out: now }
  return { ...s, segments }
}
