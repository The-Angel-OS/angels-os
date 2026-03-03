/**
 * Street Signs — Federation Product Gossip Protocol
 *
 * Street Signs is a lightweight gossip protocol that lets federation nodes
 * share high-level product summaries with each other via heartbeat payloads.
 * Every node eventually learns what every other node offers — without polling.
 *
 * Design:
 *   - Each node builds a compact `StreetSignsPayload` from its local products
 *   - The payload is included in the outbound heartbeat (federation-heartbeat-cron)
 *   - When receiving a heartbeat, the incoming street signs are cached locally
 *   - LEO can query the cache instantly (no outbound HTTP) via discover_federation_products
 *
 * Cache:
 *   - In-memory Map keyed by peerId (federationId)
 *   - `buildStreetSigns` results are cached for 5 minutes to avoid re-querying
 *     on every heartbeat cycle
 *
 * Sprint 39 — Federation Street Signs Gossip
 *
 * @see src/endpoints/federation-heartbeat-cron.ts — outbound (includes streetSigns)
 * @see src/endpoints/federation-heartbeat.ts      — inbound  (caches streetSigns)
 * @see src/utilities/leo-data-tools.ts            — discover_federation_products tool
 */

import type { Payload } from 'payload'

// ── Types ────────────────────────────────────────────────────────────────────

/** A single product summary for gossip. */
export interface StreetSign {
  productTitle: string
  category: string
  priceMin: number // cents
  priceMax: number // cents
  capabilities: string[]
}

/** Compact product summary a node broadcasts in its heartbeat. */
export interface StreetSignsPayload {
  /** Total number of products this node has. */
  productCount: number
  /** Top 5 category names by product count. */
  topCategories: string[]
  /** Up to 10 featured products (newest / highest-rated). */
  featured: StreetSign[]
  /** ISO timestamp when this payload was last built. */
  lastUpdated: string
}

/** An entry in the peer signs cache. */
interface CacheEntry {
  peerId: string
  peerName?: string
  peerDomain?: string
  signs: StreetSignsPayload
  receivedAt: string
}

// ── In-memory caches ─────────────────────────────────────────────────────────

/** Map<federationId, CacheEntry> — all peer street signs received via heartbeat. */
const peerSignsCache = new Map<string, CacheEntry>()

/** Locally-built street signs — cached for 5 minutes so we don't query products on every heartbeat. */
let localSignsCache: StreetSignsPayload | null = null
let localSignsCacheExpiry = 0
const LOCAL_CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

// ── Build ─────────────────────────────────────────────────────────────────────

/**
 * Build a `StreetSignsPayload` from this node's local products.
 * Results are cached for 5 minutes — safe to call on every heartbeat.
 *
 * @param payload - Payload instance
 * @param _tenantId - Tenant ID (reserved for future multi-tenant filtering)
 */
export async function buildStreetSigns(
  payload: Payload,
  _tenantId?: number | string,
): Promise<StreetSignsPayload> {
  // Return cached result if still fresh
  const now = Date.now()
  if (localSignsCache && now < localSignsCacheExpiry) {
    return localSignsCache
  }

  try {
    // Fetch products — we only need a lightweight query
    const result = await payload.find({
      collection: 'products' as any,
      limit: 50,
      depth: 0,
      sort: '-createdAt',
      overrideAccess: true,
    })

    const products = result.docs as unknown as Array<Record<string, unknown>>
    const totalCount = result.totalDocs

    // ── Compute category counts ─────────────────────────────────────────────
    const categoryCounts = new Map<string, number>()
    for (const p of products) {
      const cat = extractCategory(p)
      categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1)
    }
    const topCategories = [...categoryCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat]) => cat)

    // ── Build featured products (up to 10) ─────────────────────────────────
    const featured: StreetSign[] = products.slice(0, 10).map((p) => {
      const priceInCents = Math.round((p.priceInUSD as number || 0) * 100)
      return {
        productTitle: (p.title as string) || 'Untitled',
        category: extractCategory(p),
        priceMin: priceInCents,
        priceMax: priceInCents, // single price — min === max for simple products
        capabilities: extractCapabilities(p),
      }
    })

    const payload_result: StreetSignsPayload = {
      productCount: totalCount,
      topCategories,
      featured,
      lastUpdated: new Date().toISOString(),
    }

    // Cache locally
    localSignsCache = payload_result
    localSignsCacheExpiry = now + LOCAL_CACHE_TTL_MS

    return payload_result
  } catch {
    // Products collection not available — return empty summary
    const empty: StreetSignsPayload = {
      productCount: 0,
      topCategories: [],
      featured: [],
      lastUpdated: new Date().toISOString(),
    }
    localSignsCache = empty
    localSignsCacheExpiry = now + LOCAL_CACHE_TTL_MS
    return empty
  }
}

// ── Cache operations ──────────────────────────────────────────────────────────

/**
 * Store street signs received from a federation peer.
 *
 * @param peerId - The peer's federationId (used as cache key)
 * @param signs - The `StreetSignsPayload` from the incoming heartbeat
 * @param peerName - Optional display name of the peer
 * @param peerDomain - Optional domain of the peer
 */
export function mergeStreetSignsForPeer(
  peerId: string,
  signs: StreetSignsPayload,
  peerName?: string,
  peerDomain?: string,
): void {
  peerSignsCache.set(peerId, {
    peerId,
    peerName,
    peerDomain,
    signs,
    receivedAt: new Date().toISOString(),
  })
}

/**
 * Retrieve the cached street signs for a specific peer.
 *
 * @param peerId - The peer's federationId
 * @returns The cached entry, or null if no signs received yet
 */
export function getStreetSignsForPeer(peerId: string): CacheEntry | null {
  return peerSignsCache.get(peerId) ?? null
}

/**
 * Get all cached peer street signs — used by the LEO tool.
 *
 * @returns Array of all cache entries
 */
export function getAllPeerStreetSigns(): CacheEntry[] {
  return [...peerSignsCache.values()]
}

/**
 * Clear the local products cache — useful in tests.
 */
export function clearLocalSignsCache(): void {
  localSignsCache = null
  localSignsCacheExpiry = 0
}

/**
 * Clear all peer signs caches — useful in tests.
 */
export function clearAllSignsCaches(): void {
  clearLocalSignsCache()
  peerSignsCache.clear()
}

// ── Private helpers ───────────────────────────────────────────────────────────

function extractCategory(product: Record<string, unknown>): string {
  if (product.category && typeof product.category === 'object') {
    const cat = product.category as Record<string, unknown>
    return (cat.title as string) || (cat.name as string) || 'Uncategorised'
  }
  if (typeof product.category === 'string') {
    return product.category
  }
  return 'Uncategorised'
}

function extractCapabilities(product: Record<string, unknown>): string[] {
  const capabilities: string[] = []

  // Try `capabilities` field directly
  if (Array.isArray(product.capabilities)) {
    for (const c of product.capabilities) {
      if (typeof c === 'string') capabilities.push(c)
      else if (typeof c === 'object' && c !== null) {
        const name = (c as Record<string, unknown>).name || (c as Record<string, unknown>).value
        if (typeof name === 'string') capabilities.push(name)
      }
    }
  }

  // Try `requiredCapabilities` (used by the order routing engine)
  if (Array.isArray(product.requiredCapabilities)) {
    for (const c of product.requiredCapabilities) {
      if (typeof c === 'string' && !capabilities.includes(c)) capabilities.push(c)
    }
  }

  return capabilities
}
