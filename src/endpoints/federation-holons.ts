/**
 * Federation Holons Endpoint — GET /api/federation/holons
 *
 * Returns Endeavors visible to the federation network.
 * This is the "Enterprise directory" — discover who's in the federation,
 * what they offer, and how to connect.
 *
 * Query params:
 *   ?type=retailer         — filter by holon type
 *   &region=FL             — filter by region (state/country/city)
 *   &q=music               — text search (name, tagline, description)
 *   &status=active         — filter by ministry status (default: all)
 *   &limit=20              — max results (default 20, max 100)
 *
 * Public endpoint — no auth required for browsing.
 * Trust guard applied for tracking/audit purposes when federation headers present.
 *
 * Constitutional Reference: Article VII — Federation marketplace
 */

import type { Payload, PayloadHandler, Where } from 'payload'
import { logFederationAction } from '@/federation/auditLog'

/** Strip a leading/embedded www. so we never emit slug.www.example.com. */
const stripWww = (d: string) => d.replace(/^www\./, '').replace(/\.www\./g, '.')

/**
 * Canonical public storefront URL for an Endeavor, resolved from its tenant on
 * THIS node (the producer knows its own domains). Lets remote Discovery cards
 * deep-link to the specific Endeavor instead of just the peer's root.
 */
function computeStorefrontUrl(
  tenant: { domain?: string | null; slug?: string | null } | null,
  federationDomain: string | null,
): string | null {
  const isReal = (d?: string | null) =>
    !!d && !d.endsWith('.local') && !d.includes('localhost')
  if (isReal(tenant?.domain)) return `https://${stripWww(tenant!.domain as string)}`
  if (isReal(federationDomain)) return `https://${stripWww(federationDomain as string)}`
  return null
}

/** Shape one endeavor doc (resolved at depth:1) into a public-safe holon. */
function shapeHolon(doc: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const tenant = typeof doc.tenant === 'object' && doc.tenant ? doc.tenant : null
  const federationDomain = (doc.federation?.domain as string) || null
  return {
    id: doc.id,
    name: doc.name || 'Unnamed Enterprise',
    tagline: doc.tagline || '',
    description: doc.description || '',
    endeavorType: doc.endeavorType || 'custom',
    holonTypes: doc.holonTypes || [],
    missionStatement: doc.missionStatement || '',
    status: doc.status || 'forming',
    capabilities: (doc.capabilities || []).map((c: any) => ({ skill: c.skill, description: c.description || '' })), // eslint-disable-line @typescript-eslint/no-explicit-any
    region: {
      city: doc.region?.city || '',
      state: doc.region?.state || '',
      country: doc.region?.country || 'US',
    },
    federation: {
      federationId: doc.federation?.federationId || '',
      ministryStatus: doc.federation?.ministryStatus || 'applicant',
    },
    logo: doc.logo?.url || doc.logo?.filename || null,
    coverImage: doc.coverImage?.url || doc.coverImage?.filename || null,
    storefrontUrl: computeStorefrontUrl(tenant, federationDomain),
    tenant: tenant?.slug
      ? { slug: tenant.slug, siteName: tenant.branding?.siteName || null, domain: tenant.domain || null }
      : null,
  }
}

export type LocalHolon = ReturnType<typeof shapeHolon>

/**
 * Build this node's network-visible holons (public-safe shape). Shared by the
 * /api/federation/holons endpoint AND the outbound heartbeat gossip, so peers
 * can cache our endeavors locally rather than fetching at render time (which a
 * WAF/serverless-egress block can defeat — see project_federation_discovery_finding).
 */
export async function buildLocalHolons(
  payload: Payload,
  conditions: Where[] = [{ 'federation.networkVisible': { equals: true } }],
  limit = 100,
): Promise<{ holons: LocalHolon[]; total: number }> {
  const endeavors = await payload.find({
    collection: 'endeavors',
    where: { and: conditions },
    limit,
    depth: 1, // resolve logo/coverImage media + tenant
    overrideAccess: true,
    sort: '-updatedAt',
  })
  return { holons: endeavors.docs.map(shapeHolon), total: endeavors.totalDocs }
}

export const federationHolonsHandler: PayloadHandler = async (req) => {
  const startTime = Date.now()
  const url = new URL(req.url || 'http://localhost', 'http://localhost')

  // Parse query params
  const holonType = url.searchParams.get('type') || undefined
  const region = url.searchParams.get('region') || undefined
  const q = url.searchParams.get('q') || undefined
  const ministryStatus = url.searchParams.get('status') || undefined
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)), 100)

  try {
    // Build where clause — only network-visible Endeavors
    const conditions: Where[] = [
      { 'federation.networkVisible': { equals: true } },
    ]

    // Filter by holon type
    if (holonType) {
      conditions.push({ holonTypes: { contains: holonType } })
    }

    // Filter by region (matches city, state, or country)
    if (region) {
      conditions.push({
        or: [
          { 'region.state': { contains: region } },
          { 'region.country': { contains: region } },
          { 'region.city': { contains: region } },
        ],
      })
    }

    // Text search across name, tagline, description
    if (q) {
      conditions.push({
        or: [
          { name: { contains: q } },
          { tagline: { contains: q } },
          { description: { contains: q } },
        ],
      })
    }

    // Filter by federation ministry status
    if (ministryStatus) {
      conditions.push({ 'federation.ministryStatus': { equals: ministryStatus } })
    }

    const { holons, total } = await buildLocalHolons(req.payload, conditions, limit)

    // Audit log (fire-and-forget)
    const callerFedId = req.headers.get('x-federation-id')
    if (callerFedId) {
      logFederationAction(req.payload, {
        action: 'catalog_browse',
        direction: 'inbound',
        sourceFederationId: callerFedId,
        targetAction: `query: type=${holonType || '*'} region=${region || '*'} q=${q || '*'}`,
        allowed: true,
        responseTimeMs: Date.now() - startTime,
      }).catch(() => {})
    }

    return Response.json({
      holons,
      total,
      query: { type: holonType, region, q, status: ministryStatus, limit },
    })
  } catch (err) {
    console.error('[Federation Holons] Error:', err)
    return Response.json(
      { error: 'Federation directory temporarily unavailable', holons: [], total: 0 },
      { status: 500 },
    )
  }
}
