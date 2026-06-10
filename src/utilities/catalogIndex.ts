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
  /** What kind of offering this is — products and quests are both economic types. */
  kind: 'product' | 'quest'
  /** Item id on the owning node (for the lazy full-doc fetch). */
  id: number | string
  /** Content address — stable cache key; identical items dedupe across nodes. */
  checksum: string
  title: string
  slug?: string
  /** Price in cents (product = buyer pays; quest = payout the quester earns). */
  priceCents?: number
  /** Karma / reputation reward (quests only) — the MMORPG incentive. */
  karma?: number
  /** Capability/category tags for local Discovery filtering. */
  tags: string[]
  /** 'self' | 'network' (product), or 'quest' for quest offerings. */
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
    kind: 'product',
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
 * Map one raw quest doc into an index entry. Quests are a first-class economic
 * type: an Endeavor (often a Guardian Angel) offers them, a quester accepts and
 * completes multi-step geo-verified objectives. They're ALSO the human-facing
 * work-dispatch unit (dumpster delivery, assembly) — the accept-side of the
 * workload/routing/pheromone engines (Suarez Daemon/Freedom holon model).
 */
export function toQuestEntry(q: Record<string, unknown>): CatalogIndexEntry {
  const title = String(q.title || 'Untitled Quest')
  const payout = (q.payout && typeof q.payout === 'object' ? q.payout : {}) as { amount?: number }
  const priceCents = typeof payout.amount === 'number' ? Math.round(payout.amount * 100) : undefined
  const karma = typeof q.reputationReward === 'number' ? (q.reputationReward as number) : undefined
  const tags = [
    ...(typeof q.questType === 'string' && q.questType ? [q.questType as string] : []),
    ...(typeof q.difficulty === 'string' && q.difficulty ? [q.difficulty as string] : []),
  ]
  return {
    kind: 'quest',
    id: q.id as number | string,
    checksum: catalogEntryChecksum({ title, priceCents, fulfillmentMode: 'quest', tags }),
    title,
    slug: typeof q.slug === 'string' ? q.slug : undefined,
    priceCents,
    karma,
    tags,
    fulfillmentMode: 'quest',
  }
}

/**
 * Build the network-visible catalog index for one tenant (an endeavor's tenant):
 * both `networkListing: true` products AND quests — the owner's explicit opt-in
 * to the mesh. Products and quests are both economic offerings; the `kind`
 * discriminator lets Discovery and the dispatch layer treat them appropriately.
 */
export async function buildCatalogIndexForTenant(
  payload: Payload,
  tenantId: number | string,
  limit = MAX_CATALOG_ENTRIES_PER_ENDEAVOR,
): Promise<CatalogIndexEntry[]> {
  const products = await payload.find({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collection: 'products' as any,
    where: { and: [{ tenant: { equals: tenantId } }, { networkListing: { equals: true } }] },
    limit,
    depth: 0,
    overrideAccess: true,
    sort: '-updatedAt',
  })
  const entries: CatalogIndexEntry[] = (products.docs as Array<Record<string, unknown>>).map(toCatalogEntry)

  // Quests ride the same index — they may not exist on every node, so stay non-fatal.
  try {
    const quests = await payload.find({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collection: 'quests' as any,
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { networkListing: { equals: true } },
          { status: { in: ['posted', 'active'] } },
        ],
      },
      limit,
      depth: 0,
      overrideAccess: true,
      sort: '-updatedAt',
    })
    for (const q of quests.docs as Array<Record<string, unknown>>) entries.push(toQuestEntry(q))
  } catch {
    /* quests collection absent on this node — products-only index */
  }

  return entries
}
