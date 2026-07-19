/**
 * Federation Catalog Endpoint — GET /api/federation/catalog
 *
 * Returns products/services visible to the federation from this Enterprise.
 * Other Angel OS instances call this to discover what we offer.
 *
 * Query params:
 *   ?capability=bookings  — filter by capability
 *   &region=us-east       — filter by region
 *   &q=massage            — text search
 *   &limit=20             — max results (default 20, max 100)
 *   &minRating=4          — minimum rating filter
 *   &maxPrice=5000        — max price in cents
 *   &sort=rating|price|name — sort order (default: rating)
 *
 * Public endpoint — no auth required for browsing.
 * Trust guard applied for tracking/audit purposes when federation headers present.
 *
 * Constitutional Reference: Article VII — Federation marketplace
 */

import type { PayloadHandler } from 'payload'
import { searchCatalog, rankCatalogEntries } from '@/utilities/federationEngine'
import type { FederationCatalogEntry } from '@/utilities/federationEngine'
import { logFederationAction } from '@/federation/auditLog'
import { buildTenantFilter } from '@/utilities/buildTenantFilter'

/**
 * Resolve the host tenant for this request.
 *
 * Strategy (in order):
 *   1. Match tenant by request Host header (exact domain match)
 *   2. Match tenant by subdomain slug (e.g. "shop.angelos.local" → slug "shop")
 *   3. Match tenant by DEFAULT_TENANT_SLUG env var (default: "default")
 *   4. Fallback: first non-platform tenant sorted by id
 *
 * This mirrors the frontend tenant resolution in fetchTenantByDomain.ts
 * but operates within a PayloadHandler context (no separate Payload import needed).
 */
async function resolveHostTenant(
  req: Parameters<PayloadHandler>[0],
): Promise<Record<string, unknown> | undefined> {
  const host = (req.headers?.get('host') || 'localhost').split(':')[0].toLowerCase()

  // 1. Exact domain match (primary domain OR a bound alias in domains[])
  const byDomain = await req.payload.find({
    collection: 'tenants',
    where: { or: [{ domain: { equals: host } }, { 'domains.domain': { equals: host } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (byDomain.docs[0]) return byDomain.docs[0] as unknown as Record<string, unknown>

  // 2. Subdomain slug match (e.g. "shop.angelos.local" → "shop")
  const hostParts = host.split('.')
  if (hostParts.length >= 2) {
    const subSlug = hostParts[0]
    if (subSlug !== 'www' && subSlug !== 'api') {
      const bySlug = await req.payload.find({
        collection: 'tenants',
        where: { slug: { equals: subSlug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (bySlug.docs[0]) return bySlug.docs[0] as unknown as Record<string, unknown>
    }
  }

  // 3. Default tenant slug
  const defaultSlug = process.env.DEFAULT_TENANT_SLUG || 'default'
  const byDefault = await req.payload.find({
    collection: 'tenants',
    where: { slug: { equals: defaultSlug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (byDefault.docs[0]) return byDefault.docs[0] as unknown as Record<string, unknown>

  // No further fallback — exposing a random tenant's catalog is a data leak.
  // If no domain/slug/default match, return undefined → caller handles gracefully.
  return undefined
}

export const federationCatalogHandler: PayloadHandler = async (req) => {
  const startTime = Date.now()
  const url = new URL(req.url || 'http://localhost', 'http://localhost')

  // Parse query params
  const capability = url.searchParams.get('capability') || undefined
  const region = url.searchParams.get('region') || undefined
  const q = url.searchParams.get('q') || undefined
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '20', 10)), 100)
  const minRating = url.searchParams.get('minRating')
    ? parseFloat(url.searchParams.get('minRating')!)
    : undefined
  const maxPrice = url.searchParams.get('maxPrice')
    ? parseInt(url.searchParams.get('maxPrice')!, 10)
    : undefined
  const sortBy = (url.searchParams.get('sort') || 'rating') as 'rating' | 'price' | 'name'

  try {
    // Resolve the host tenant for this request — determines which products to expose.
    // Uses the same resolution chain as the frontend (domain → subdomain → default → fallback).
    const tenant = await resolveHostTenant(req)
    const setup = tenant?.setup as Record<string, unknown> | undefined
    const federationId = (setup?.federationId as string) || 'unknown'

    // Query products with federation visibility — scoped to this instance's tenant.
    // overrideAccess is needed because this is a server-to-server endpoint (no user session),
    // but we MUST scope to the host tenant to prevent cross-tenant data leakage.
    const tenantId = tenant?.id as number | undefined
    const products = await req.payload.find({
      collection: 'products' as any,
      where: {
        and: [
          { _status: { equals: 'published' } },
          buildTenantFilter(tenantId),
          ...(q ? [{ title: { contains: q } }] : []),
        ],
      },
      limit: limit * 2, // Fetch extra for filtering
      depth: 1,
      overrideAccess: true,
    })

    // Transform products to federation catalog entries
    const entries: FederationCatalogEntry[] = products.docs.map((product: any) => {
      const p = product as Record<string, unknown>
      return {
        productId: p.id as number,
        productName: (p.title as string) || (p.name as string) || 'Unnamed Product',
        description: (p.description as string) || (p.shortDescription as string) || '',
        price: (p.price as number) || (p.basePrice as number) || 0,
        currency: 'usd',
        sourceMinistry: federationId,
        sourceTenant: (tenant?.id as number) || 0,
        capabilities: inferCapabilities(p),
        fulfillmentMode: inferFulfillmentMode(p),
        location: {
          city: undefined,
          region: region || undefined,
        },
        rating: (p.averageRating as number) || 0,
      }
    })

    // Apply federation engine filters
    const filtered = searchCatalog(entries, {
      capability,
      maxPrice,
      region,
      minRating,
    })

    // Sort and limit
    const sorted = rankCatalogEntries(filtered, sortBy)
    const result = sorted.slice(0, limit)

    // Audit log (fire-and-forget)
    const callerFedId = req.headers.get('x-federation-id')
    if (callerFedId) {
      logFederationAction(req.payload, {
        action: 'catalog_browse',
        direction: 'inbound',
        sourceFederationId: callerFedId,
        targetAction: `query: capability=${capability || '*'} q=${q || '*'} limit=${limit}`,
        allowed: true,
        responseTimeMs: Date.now() - startTime,
      }).catch(() => {})
    }

    return Response.json({
      entries: result,
      total: filtered.length,
      federationId,
      enterprise: (tenant?.name as string) || 'Angel OS Instance',
      domain: (() => {
        const d = tenant?.domain as string | undefined
        return d && !/^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)/.test(d) ? d : (req.headers?.get('host')?.replace(/:\d+$/, '') || 'localhost')
      })(),
      query: { capability, region, q, limit, minRating, maxPrice, sortBy },
    })
  } catch (err) {
    console.error('[Federation Catalog] Error:', err)
    return Response.json(
      { error: 'Catalog temporarily unavailable', entries: [], total: 0 },
      { status: 500 },
    )
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function inferCapabilities(product: Record<string, unknown>): string[] {
  const caps: string[] = ['products']
  const type = product.type as string | undefined
  const categories = product.categories as Array<{ name?: string }> | undefined

  if (type === 'service' || type === 'booking') caps.push('bookings')
  if (type === 'digital') caps.push('digital-products')
  if (type === 'event') caps.push('events')

  if (categories) {
    for (const cat of categories) {
      if (cat.name) caps.push(cat.name.toLowerCase())
    }
  }

  return [...new Set(caps)]
}

function inferFulfillmentMode(product: Record<string, unknown>): string {
  const type = product.type as string | undefined
  if (type === 'digital') return 'digital'
  if (type === 'service' || type === 'booking') return 'service'
  return 'physical'
}
