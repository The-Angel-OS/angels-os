/**
 * Public Geo-Posts API — GET /api/geo-posts?tenant=nde|uap|mlb&limit=250
 *
 * Returns lean `AtlasPlace[]` pin records directly from published `Posts`
 * that have `geo.latitude` and `geo.longitude` populated.
 *
 * Makes `Posts` the single source of truth for:
 *   - 3D Globe Atlas pins across all portals (MLB, UAP, NDE, Jon Levi)
 *   - `/posts` search engine & `/posts/[slug]` full dossiers
 *   - Live ingestion from NDERF / Greer / YouTube without redeploys
 */
import type { PayloadHandler } from 'payload'

export const geoPostsHandler: PayloadHandler = async (req) => {
  const { payload } = req
  const url = new URL(req.url || '', 'http://localhost')
  const tenantSlug = (url.searchParams.get('tenant') || '').trim().toLowerCase()
  const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') || 250)))

  try {
    // Resolve tenant ID from slug or Host header
    let tenantId: number | string | undefined
    if (tenantSlug) {
      const tRes = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: tenantSlug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      tenantId = tRes.docs[0]?.id
    }

    const whereClause: Record<string, unknown> = {
      and: [
        { _status: { equals: 'published' } },
        { 'geo.latitude': { exists: true } },
        { 'geo.longitude': { exists: true } },
        ...(tenantId ? [{ tenant: { equals: tenantId } }] : []),
      ],
    }

    const postsRes = await payload.find({
      collection: 'posts',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      where: whereClause as any,
      limit,
      depth: 0,
      sort: '-updatedAt',
      overrideAccess: true,
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const places = (postsRes.docs || []).map((doc: any) => {
      const geo = doc.geo || {}
      const meta = (geo.meta && typeof geo.meta === 'object' ? geo.meta : {}) as Record<string, unknown>
      const locParts = String(geo.locationName || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)

      return {
        id: `post-${doc.id}`,
        slug: doc.slug,
        name: doc.title,
        city: locParts[0] || null,
        state: locParts[1] || null,
        country: locParts[2] || null,
        latitude: String(geo.latitude),
        longitude: String(geo.longitude),
        category: String(geo.category || 'ARCHIVE').toUpperCase(),
        existence: String(
          meta.blindnessRating || meta.classification || meta.eraWindow || 'PUBLISHED DOSSIER',
        ),
        construction: geo.eventDate ? String(geo.eventDate) : null,
        photo: null,
        sourceUrl: doc.sourceUrl || `/posts/${doc.slug}`,
        postUrl: `/posts/${doc.slug}`,
        description:
          doc.meta?.description ||
          String(meta.summary || `Full dossier available at /posts/${doc.slug}`),
        status: 'current',
      }
    })

    return Response.json(
      {
        tenant: tenantSlug || 'all',
        count: places.length,
        asOf: new Date().toISOString(),
        places,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      },
    )
  } catch (err) {
    console.error('[geo-posts] Error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
