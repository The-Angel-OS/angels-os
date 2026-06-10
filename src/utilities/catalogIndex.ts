/**
 * Catalog Index — the compact, content-addressed gossip payload for federated
 * product discovery. The "Gnutella file list" without Gnutella's flooding.
 *
 * Each network-listed product becomes a SUMMARY entry (never the full doc),
 * carrying a SHA-256 checksum so the item is content-addressed: a peer caches
 * the index locally, Discovery searches it with zero live traffic, and only when
 * a user opens an item is the full doc pulled lazily by checksum and cached
 * forever (immutable). Identical items across nodes dedupe by checksum.
 *
 * Producer-only: this builds OUR index. It rides inside the existing endeavor
 * gossip (each endeavor carries its `catalog[]`), so it needs no new column —
 * the peer's heartbeat handler caches `endeavors` verbatim today.
 */
import type { Payload } from 'payload'
import crypto from 'crypto'

export interface CatalogIndexEntry {
  /** Product id on the owning node (for the lazy full-doc fetch). */
  id: number | string
  /** Content address — stable cache key; identical items dedupe across nodes. */
  checksum: string
  title: string
  slug?: string
  /** Price in cents (integer) for compact, currency-neutral comparison. */
  priceCents?: number
  /** Capability/category tags for local Discovery filtering. */
  tags: string[]
  /** 'self' | 'network' — whether the mesh may route fulfillment. */
  fulfillmentMode: string
}

/** Bound the per-endeavor payload so a heartbeat never balloons. */
export const MAX_CATALOG_ENTRIES_PER_ENDEAVOR = 50

/**
 * Deterministic content address over the fields a consumer cares about. Sorted
 * keys → same input yields the same checksum on every node (cross-node dedupe).
 */
export function catalogEntryChecksum(parts: {
  title: string
  priceCents?: number
  fulfillmentMode: string
  tags: string[]
}): string {
  const canonical = JSON.stringify({
    fulfillmentMode: parts.fulfillmentMode,
    priceCents: parts.priceCents ?? null,
    tags: [...parts.tags].sort(),
    title: parts.title,
  })
  return crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 32)
}

/** Map one raw product doc into a compact, content-addressed index entry. */
export function toCatalogEntry(p: Record<string, unknown>): CatalogIndexEntry {
  const title = String(p.title || 'Untitled')
  const priceUSD = typeof p.priceInUSD === 'number' ? (p.priceInUSD as number) : undefined
  const priceCents = priceUSD != null ? Math.round(priceUSD * 100) : undefined
  const reqCaps = Array.isArray(p.requiredCapabilities) ? (p.requiredCapabilities as Array<{ skill?: string }>) : []
  const tags = reqCaps.map((c) => c?.skill).filter((s): s is string => Boolean(s))
  const fulfillmentMode = String(p.fulfillmentMode || 'self')
  return {
    id: p.id as number | string,
    checksum: catalogEntryChecksum({ title, priceCents, fulfillmentMode, tags }),
    title,
    slug: typeof p.slug === 'string' ? p.slug : undefined,
    priceCents,
    tags,
    fulfillmentMode,
  }
}

/**
 * Build the network-visible catalog index for one tenant (an endeavor's tenant).
 * Only `networkListing: true` products — the owner's explicit opt-in to the mesh.
 */
export async function buildCatalogIndexForTenant(
  payload: Payload,
  tenantId: number | string,
  limit = MAX_CATALOG_ENTRIES_PER_ENDEAVOR,
): Promise<CatalogIndexEntry[]> {
  const res = await payload.find({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collection: 'products' as any,
    where: { and: [{ tenant: { equals: tenantId } }, { networkListing: { equals: true } }] },
    limit,
    depth: 0,
    overrideAccess: true,
    sort: '-updatedAt',
  })
  return (res.docs as Array<Record<string, unknown>>).map(toCatalogEntry)
}
