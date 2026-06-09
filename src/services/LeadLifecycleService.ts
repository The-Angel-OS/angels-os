/**
 * LeadLifecycleService — the failover state machine for the vertical lead network.
 *
 * This is the single highest-leverage brick: capture → route → offer → accept /
 * decline / expire → FAIL OVER to the next ranked vendor → … → accepted | exhausted.
 * One robust core, shared by every vertical (dumpster, towing, pressure-washing,
 * pool, lawn, pest) — a lead never mis-routes and never dead-ends.
 *
 * Distinct from the manufacturing/holon fulfillment flow (orderRoutingEngine +
 * Angel Tokens): that routes makeable products by capability + proximity; THIS
 * routes service demand by service-area + trust via VendorRoutingService, and adds
 * the sequential failover cascade that flow lacks.
 *
 * DESIGN — pure + deterministic, like VendorRoutingService and orderRoutingEngine:
 *   - No LLM, no IO. Every reducer is a pure function of (state, event).
 *   - `now` is passed IN (never Date.now()) so transitions are testable + replayable.
 *   - Persistence-agnostic: a LeadState is a plain JSON object. The endpoint/cron
 *     layer maps it onto storage — seated on Orders.fulfillment (a deliberate
 *     migration, to avoid the dev-push ALTER lock-drift hazard) or the Setting bag.
 *   - `canClaim(state, vendorId)` is the contract the claim endpoint pairs with
 *     can('Claim','lead') — the engine says "this vendor is the active offer"; the
 *     Permission spine says "this user may act for that vendor". Both must be true.
 *
 * @see VendorRoutingService.matchVendors · PermissionService.can
 * @see project_kendev_commercial_arm · docs/architecture/OQTANE_SPINE.md
 */
import { matchVendors, type LeadRequest, type VendorLike } from './VendorRoutingService'

// ── Vocabulary ───────────────────────────────────────────────────────────────

export type LeadStatus =
  | 'new' // captured + routed, no active offer yet
  | 'offered' // actively offered to the vendor at trail[cursor]
  | 'accepted' // a vendor accepted → hand off to fulfillment
  | 'exhausted' // every ranked vendor declined/expired — needs escalation
  | 'unfulfillable' // routing produced zero eligible vendors (no coverage)
  | 'cancelled' // customer/operator cancelled

export type OfferStatus = 'pending' | 'offered' | 'declined' | 'expired' | 'accepted'

/** One rung of the failover ladder — a vendor and how they responded. */
export interface LeadOffer {
  vendorId: string
  status: OfferStatus
  offeredAt?: string
  respondedAt?: string
}

export interface LeadState {
  status: LeadStatus
  request: LeadRequest
  /** Ranked vendor ids (matchVendors order) — the failover sequence. */
  trail: LeadOffer[]
  /** Index of the active/last offer in `trail`; -1 before the first offer. */
  cursor: number
  createdAt: string
  updatedAt: string
}

/** A vendor's response to an active offer. */
export type LeadResponse = 'accepted' | 'declined' | 'expired'

const TERMINAL: ReadonlySet<LeadStatus> = new Set<LeadStatus>([
  'accepted',
  'exhausted',
  'unfulfillable',
  'cancelled',
])

// ── Construction ─────────────────────────────────────────────────────────────

/** A freshly captured lead — routed next via applyRouting(). */
export function initLead(request: LeadRequest, now: string): LeadState {
  return { status: 'new', request, trail: [], cursor: -1, createdAt: now, updatedAt: now }
}

/**
 * Seat a ranked vendor sequence onto the lead. Empty ranking → `unfulfillable`
 * (no coverage). Otherwise every rung starts `pending`; no offer is active until
 * offerNext(). Re-routing is allowed only while non-terminal.
 */
export function applyRouting(state: LeadState, rankedVendorIds: Array<string | number>, now: string): LeadState {
  if (TERMINAL.has(state.status)) {
    throw new Error(`applyRouting: lead is terminal (${state.status})`)
  }
  const trail: LeadOffer[] = rankedVendorIds.map((id) => ({ vendorId: String(id), status: 'pending' }))
  if (trail.length === 0) {
    return { ...state, status: 'unfulfillable', trail, cursor: -1, updatedAt: now }
  }
  return { ...state, status: 'new', trail, cursor: -1, updatedAt: now }
}

/**
 * Advance to the next `pending` vendor and make it the active offer. If none
 * remain, the lead is `exhausted`. Idempotent intent: only the next pending rung
 * is touched.
 */
export function offerNext(state: LeadState, now: string): LeadState {
  if (TERMINAL.has(state.status)) {
    throw new Error(`offerNext: lead is terminal (${state.status})`)
  }
  const nextIdx = state.trail.findIndex((o, i) => i > state.cursor && o.status === 'pending')
  if (nextIdx === -1) {
    return { ...state, status: 'exhausted', updatedAt: now }
  }
  const trail = state.trail.map((o, i) => (i === nextIdx ? { ...o, status: 'offered' as const, offeredAt: now } : o))
  return { ...state, status: 'offered', cursor: nextIdx, trail, updatedAt: now }
}

/**
 * Capture → route → first offer, composing VendorRoutingService. The one call an
 * endpoint makes to open a lead. `activeCounts`/`size` ride on the request.
 */
export function openLead(request: LeadRequest, vendors: VendorLike[], now: string): LeadState {
  const ranked = matchVendors(request, vendors).map((v) => v.id)
  const routed = applyRouting(initLead(request, now), ranked, now)
  return routed.status === 'unfulfillable' ? routed : offerNext(routed, now)
}

// ── Events ───────────────────────────────────────────────────────────────────

/**
 * Record the active offer's response. `accepted` ends the lead; `declined`/`expired`
 * mark the rung and AUTO-FAIL-OVER to the next vendor (or `exhausted`).
 *
 * Throws on misuse — no active offer, or a response from a vendor who is not the
 * current offer. Callers gate first with currentVendorId()/canClaim() + can().
 */
export function respond(state: LeadState, vendorId: string | number, response: LeadResponse, now: string): LeadState {
  if (state.status !== 'offered') {
    throw new Error(`respond: no active offer (status ${state.status})`)
  }
  const active = state.trail[state.cursor]
  if (!active || active.vendorId !== String(vendorId)) {
    throw new Error(`respond: ${vendorId} is not the active offer (${active?.vendorId ?? 'none'})`)
  }

  const trail = state.trail.map((o, i) =>
    i === state.cursor ? { ...o, status: response, respondedAt: now } : o,
  )

  if (response === 'accepted') {
    return { ...state, status: 'accepted', trail, updatedAt: now }
  }
  // declined | expired → fail over to the next ranked vendor.
  return offerNext({ ...state, trail, updatedAt: now }, now)
}

/** Customer/operator cancellation. Allowed any time before a vendor has accepted. */
export function cancelLead(state: LeadState, now: string): LeadState {
  if (state.status === 'accepted') {
    throw new Error('cancelLead: cannot cancel an accepted lead — use the fulfillment cancel path')
  }
  if (state.status === 'cancelled') return state
  return { ...state, status: 'cancelled', updatedAt: now }
}

// ── Queries (selectors the endpoint/cron layer reads) ────────────────────────

/** The active offer, or null when none is outstanding. */
export function currentOffer(state: LeadState): LeadOffer | null {
  return state.status === 'offered' ? state.trail[state.cursor] ?? null : null
}

/** The vendor currently being offered the lead, or null. */
export function currentVendorId(state: LeadState): string | null {
  return currentOffer(state)?.vendorId ?? null
}

export function isTerminal(state: LeadState): boolean {
  return TERMINAL.has(state.status)
}

/**
 * Whether `vendorId` is the lead's active offer — the engine half of the claim
 * gate. Pair with can('Claim','lead', …) so only the rightful vendor's user acts.
 */
export function canClaim(state: LeadState, vendorId: string | number): boolean {
  return currentVendorId(state) === String(vendorId)
}

/** True when the active offer has outlived `ttlMs` — drive timeout failover from a cron. */
export function isOfferExpired(state: LeadState, now: string, ttlMs: number): boolean {
  const offer = currentOffer(state)
  if (!offer?.offeredAt) return false
  return new Date(now).getTime() - new Date(offer.offeredAt).getTime() > ttlMs
}

/** Vendors not yet offered (still `pending`) — how much failover runway remains. */
export function remainingVendorCount(state: LeadState): number {
  return state.trail.filter((o) => o.status === 'pending').length
}
