/**
 * sequenceRoute — order a set of destinations into an efficient travel route.
 *
 * The heart of turning quests into Uber-Eats-style active dispatch: given where a
 * person is now and the geo-located stops they've accepted, produce the order to
 * visit them that minimizes travel. **Rerouting is free** — when a new
 * destination comes on (a fresh quest accepted, a priority insert), just call
 * this again with the updated stop set and the person's current position; it
 * re-sequences from scratch. Stateless by design, so "reroute" is one call.
 *
 * Greedy nearest-neighbor for the initial order, then a bounded 2-opt cleanup
 * (cheap and high-quality for the handful of stops one courier carries). Uses the
 * existing haversine distance — straight-line miles, a good ordering signal;
 * swap in a road-distance provider later without changing callers.
 *
 * @see src/utilities/logistics-engine.ts — calculateDistance (haversine)
 */
import { calculateDistance } from './logistics-engine'

export interface RouteStop {
  id: number | string
  label: string
  lat: number
  lng: number
  /** Optional: higher = visit sooner regardless of distance (priority insert). */
  priority?: number
  [extra: string]: unknown
}

export interface SequencedStop extends RouteStop {
  order: number
  /** Miles from the previous point (origin for the first). */
  legMiles: number
  /** Cumulative miles from origin. */
  cumulativeMiles: number
}

export interface RouteResult {
  origin: { lat: number; lng: number }
  stops: SequencedStop[]
  totalMiles: number
  /** Rough drive-time estimate at `avgMph` (default 30). Minutes. */
  estMinutes: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

const geo = (s: { lat: number; lng: number }) => ({ lat: s.lat, lng: s.lng })

function routeLength(origin: { lat: number; lng: number }, order: RouteStop[]): number {
  let total = 0
  let prev = origin
  for (const s of order) {
    total += calculateDistance(geo(prev), geo(s))
    prev = s
  }
  return total
}

/** Greedy nearest-neighbor ordering from the origin. */
function nearestNeighbor(origin: { lat: number; lng: number }, stops: RouteStop[]): RouteStop[] {
  const remaining = [...stops]
  const order: RouteStop[] = []
  let cursor = origin
  while (remaining.length) {
    let bestIdx = 0
    let bestD = Infinity
    for (let i = 0; i < remaining.length; i++) {
      const d = calculateDistance(geo(cursor), geo(remaining[i]!))
      if (d < bestD) {
        bestD = d
        bestIdx = i
      }
    }
    const [next] = remaining.splice(bestIdx, 1)
    order.push(next!)
    cursor = next!
  }
  return order
}

/** Bounded 2-opt: reverse segments while it shortens the route. */
function twoOpt(origin: { lat: number; lng: number }, order: RouteStop[]): RouteStop[] {
  if (order.length < 4) return order
  let best = order
  let bestLen = routeLength(origin, best)
  let improved = true
  let guard = 0
  while (improved && guard++ < 50) {
    improved = false
    for (let i = 0; i < best.length - 1; i++) {
      for (let k = i + 1; k < best.length; k++) {
        const candidate = [...best.slice(0, i), ...best.slice(i, k + 1).reverse(), ...best.slice(k + 1)]
        const len = routeLength(origin, candidate)
        if (len + 1e-9 < bestLen) {
          best = candidate
          bestLen = len
          improved = true
        }
      }
    }
  }
  return best
}

/**
 * Sequence `stops` into an efficient route from `origin`. Stops with a higher
 * `priority` are pulled to the front (grouped), then distance-optimized within
 * each priority band — so an urgent insert jumps the queue without ignoring geo.
 */
export function sequenceRoute(
  origin: { lat: number; lng: number },
  stops: RouteStop[],
  opts: { avgMph?: number } = {},
): RouteResult {
  const avgMph = opts.avgMph && opts.avgMph > 0 ? opts.avgMph : 30
  const valid = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng))

  // Group by priority (desc); optimize distance within each band, then concat.
  const bands = new Map<number, RouteStop[]>()
  for (const s of valid) {
    const p = Number.isFinite(s.priority) ? (s.priority as number) : 0
    if (!bands.has(p)) bands.set(p, [])
    bands.get(p)!.push(s)
  }
  const orderedBands = [...bands.keys()].sort((a, b) => b - a)

  const finalOrder: RouteStop[] = []
  let cursor = origin
  for (const p of orderedBands) {
    const band = bands.get(p)!
    const seq = twoOpt(cursor, nearestNeighbor(cursor, band))
    finalOrder.push(...seq)
    if (seq.length) cursor = seq[seq.length - 1]!
  }

  // Annotate legs + cumulative.
  const sequenced: SequencedStop[] = []
  let prev = origin
  let cumulative = 0
  finalOrder.forEach((s, idx) => {
    const leg = calculateDistance(geo(prev), geo(s))
    cumulative += leg
    sequenced.push({ ...s, order: idx + 1, legMiles: round2(leg), cumulativeMiles: round2(cumulative) })
    prev = s
  })

  const totalMiles = round2(cumulative)
  return {
    origin,
    stops: sequenced,
    totalMiles,
    estMinutes: Math.round((totalMiles / avgMph) * 60),
  }
}
