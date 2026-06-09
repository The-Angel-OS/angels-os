/**
 * VendorRoutingService — match captured demand to fulfillment holons.
 *
 * The deterministic routing core of the lead network. PURE function: no LLM, no IO
 * in matchVendors — given a request and the candidate vendors, it returns the
 * RANKED list of who can serve it. Returning a ranked LIST (not a single winner) is
 * what makes the lead lifecycle robust: on decline/timeout the caller fails over to
 * the next candidate, and no lead ever dead-ends.
 *
 * Ranking (MVP): trust first (full > vouched > probation), then capacity headroom,
 * then stable. Pheromone reinforcement (reliability) layers on later via the same
 * single entry point.
 *
 * @see docs/architecture/OQTANE_SPINE.md · project_kendev_commercial_arm (memory)
 */

export interface VendorLike {
  id: string | number
  name?: string
  serviceZips?: unknown
  sizes?: unknown
  status?: string | null
  trustLevel?: string | null
  maxConcurrent?: number | null
}

export interface LeadRequest {
  /** Service-area key — zip-list MVP. Normalized to its 5-digit form. */
  zip: string
  /** Requested size, e.g. "10yd". Optional — omit to match any size. */
  size?: string
  /** Per-vendor active-lead counts, by vendor id — for capacity filtering. */
  activeCounts?: Record<string, number>
}

const TRUST_RANK: Record<string, number> = { full: 0, vouched: 1, probation: 2 }

/** Coerce a json field that may be an array, JSON-string, or null → string[]. */
function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x))
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed.map((x) => String(x)) : []
    } catch {
      return v ? [v] : []
    }
  }
  return []
}

/** Normalize a zip to its 5-digit form (strips ZIP+4 and whitespace). */
export function normalizeZip(zip: string): string {
  return String(zip).trim().slice(0, 5)
}

/**
 * Rank the vendors that can serve a request. Filters: active, serves the zip, offers
 * the size (if specified), and has capacity headroom. Returns best-first.
 */
export function matchVendors(req: LeadRequest, vendors: VendorLike[]): VendorLike[] {
  const zip = normalizeZip(req.zip)
  const wantSize = req.size?.trim()
  const counts = req.activeCounts || {}

  const eligible = vendors.filter((v) => {
    if ((v.status ?? 'active') !== 'active') return false
    if (!toStringArray(v.serviceZips).map(normalizeZip).includes(zip)) return false
    if (wantSize) {
      const sizes = toStringArray(v.sizes)
      // A vendor with no declared sizes is treated as "serves any size".
      if (sizes.length > 0 && !sizes.includes(wantSize)) return false
    }
    const cap = v.maxConcurrent
    if (cap != null && cap > 0 && (counts[String(v.id)] || 0) >= cap) return false
    return true
  })

  return eligible
    .map((v, i) => ({ v, i })) // index preserves stable order within a tier
    .sort((a, b) => {
      const ta = TRUST_RANK[a.v.trustLevel ?? 'probation'] ?? 2
      const tb = TRUST_RANK[b.v.trustLevel ?? 'probation'] ?? 2
      if (ta !== tb) return ta - tb
      // More headroom first (uncapped counts as most).
      const ha = a.v.maxConcurrent && a.v.maxConcurrent > 0 ? a.v.maxConcurrent - (counts[String(a.v.id)] || 0) : Infinity
      const hb = b.v.maxConcurrent && b.v.maxConcurrent > 0 ? b.v.maxConcurrent - (counts[String(b.v.id)] || 0) : Infinity
      if (ha !== hb) return hb - ha
      return a.i - b.i
    })
    .map(({ v }) => v)
}

/** Convenience: the single best vendor for a request, or null if none. */
export function bestVendor(req: LeadRequest, vendors: VendorLike[]): VendorLike | null {
  return matchVendors(req, vendors)[0] ?? null
}
