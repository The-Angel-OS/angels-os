/**
 * Federation Discovery — cross-node aggregation (consumer side).
 *
 * The Discovery page shows this node's own network-visible Endeavors. This
 * helper completes the picture by fanning out to each ACTIVE peer Diocese and
 * pulling its public holon directory (`GET /api/federation/holons`, the producer
 * side that already exists on every node). Remote holons are tagged with their
 * origin Enterprise so provenance is visible, and relative media URLs are
 * rewritten against the peer origin so logos/covers resolve.
 *
 * Resilient by design: each peer fetch has a short timeout and failures are
 * skipped (Promise.allSettled), so one slow/offline Diocese never blocks the
 * page. Responses are cached for 60s via the fetch cache.
 *
 * @see src/endpoints/federation-holons.ts — the producer endpoint
 * @see src/app/[locale]/(app)/federation/discover/page.tsx — the consumer
 */
import type { Payload } from 'payload'
import type { FederationHolon } from '@/components/FederationCard'

/** Peer trust states whose Endeavors we surface in Discovery. */
const VISIBLE_PEER_STATUSES = ['active', 'probation', 'vouched', 'full']

const PEER_FETCH_TIMEOUT_MS = 3000
const PEER_CACHE_SECONDS = 60

/** Normalize a stored domain to an https origin (no trailing slash, no scheme dupes). */
function toOrigin(domain: string): string | null {
  const d = domain.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (!d || d.includes('localhost') || d.endsWith('.local')) return null
  return `https://${d}`
}

/** Rewrite a possibly-relative media URL against the peer origin. */
function absolutizeMedia(url: string | null | undefined, origin: string): string | null {
  if (!url) return null
  if (/^https?:\/\//.test(url)) return url
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`
}

/** Map one remote holon (producer shape) into a FederationHolon for the grid. */
function mapRemoteHolon(
  raw: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  peer: { name: string; domain: string; origin: string },
): FederationHolon {
  return {
    // Prefix the id with the peer origin so remote ids never collide with local.
    id: `${peer.domain}:${raw.id}`,
    name: raw.name || 'Unnamed Enterprise',
    tagline: raw.tagline || '',
    description: raw.description || '',
    endeavorType: raw.endeavorType || 'custom',
    holonTypes: Array.isArray(raw.holonTypes) ? raw.holonTypes : [],
    missionStatement: raw.missionStatement || '',
    status: raw.status || 'forming',
    capabilities: Array.isArray(raw.capabilities)
      ? raw.capabilities.map((c: any) => ({ skill: c.skill, description: c.description || '' })) // eslint-disable-line @typescript-eslint/no-explicit-any
      : [],
    region: {
      city: raw.region?.city || '',
      state: raw.region?.state || '',
      country: raw.region?.country || 'US',
    },
    federation: {
      federationId: raw.federation?.federationId || '',
      ministryStatus: raw.federation?.ministryStatus || 'applicant',
    },
    logo: absolutizeMedia(raw.logo, peer.origin),
    coverImage: absolutizeMedia(raw.coverImage, peer.origin),
    // Prefer the producer's per-endeavor storefront URL (deep-links to the
    // specific Endeavor); fall back to the peer Enterprise root.
    storefrontUrl: typeof raw.storefrontUrl === 'string' && raw.storefrontUrl ? raw.storefrontUrl : peer.origin,
    tenant:
      raw.tenant && typeof raw.tenant === 'object'
        ? {
            slug: raw.tenant.slug || '',
            siteName: raw.tenant.siteName || null,
            domain: raw.tenant.domain || null,
          }
        : null,
    origin: { enterprise: peer.name, domain: peer.domain },
  }
}

/** Fetch + map one peer's holons; returns [] on any failure (never throws). */
async function fetchPeerHolons(peer: { name: string; domain: string }): Promise<FederationHolon[]> {
  const origin = toOrigin(peer.domain)
  if (!origin) return []

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PEER_FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`${origin}/api/federation/holons?limit=100`, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      next: { revalidate: PEER_CACHE_SECONDS },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { holons?: unknown[] }
    if (!Array.isArray(data.holons)) return []
    return data.holons.map((h) => mapRemoteHolon(h, { ...peer, origin }))
  } catch {
    // Offline, timeout, or bad response — skip this Diocese silently.
    return []
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Aggregate network-visible holons from all active peer Dioceses.
 * Returns a flat, deduped list (deduped by federationId, then name+origin).
 */
export async function aggregatePeerHolons(payload: Payload): Promise<FederationHolon[]> {
  let peers: { name: string; domain: string }[] = []
  try {
    const result = await payload.find({
      collection: 'federation-peers',
      where: {
        and: [
          { networkVisible: { equals: true } },
          { ministryStatus: { in: VISIBLE_PEER_STATUSES } },
          { domain: { exists: true } },
        ],
      },
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    peers = (result.docs as any[]) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((p) => ({ name: p.name || p.domain, domain: p.domain as string }))
      .filter((p) => p.domain)
  } catch {
    return []
  }

  if (peers.length === 0) return []

  const settled = await Promise.allSettled(peers.map(fetchPeerHolons))
  const all = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []))

  // Dedupe: prefer federationId, fall back to name+origin domain.
  const seen = new Set<string>()
  const deduped: FederationHolon[] = []
  for (const h of all) {
    const key =
      h.federation.federationId || `${h.name.toLowerCase()}@${h.origin?.domain || ''}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(h)
  }
  return deduped
}
