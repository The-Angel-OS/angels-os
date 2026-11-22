/**
 * Lean Public Archive Feed — GET /api/archive-feed
 *
 * Serves lightweight PostCardData pages for infinite-scroll ArchiveBlock grids
 * without transferring full `layout` / `Transcript` block payloads.
 *
 * Query params:
 *   - `tenant`: tenant ID or slug (falls back to x-tenant-id / host headers)
 *   - `categories`: comma-separated category IDs
 *   - `q`: optional search keyword
 *   - `page`: page number (default 1)
 *   - `limit`: items per page (1..36, default 12)
 */
import type { Payload, PayloadHandler, Where } from 'payload'

interface RawMedia {
  id?: number | string
  url?: string | null
  alt?: string | null
  filename?: string | null
  mimeType?: string | null
  width?: number | null
  height?: number | null
}

function shapeMedia(raw: unknown): RawMedia | null {
  if (!raw || typeof raw !== 'object') return null
  const m = raw as RawMedia
  if (!m.url && m.id == null) return null
  return {
    id: m.id,
    url: m.url ?? null,
    alt: m.alt ?? '',
    filename: m.filename ?? null,
    mimeType: m.mimeType ?? null,
    width: m.width ?? null,
    height: m.height ?? null,
  }
}

async function resolveTenantId(
  payload: Payload,
  tenantParam: string,
  req: Parameters<PayloadHandler>[0],
): Promise<number | string | null> {
  if (tenantParam) {
    if (/^\d+$/.test(tenantParam)) return Number(tenantParam)
    const bySlug = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: tenantParam.toLowerCase() } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    return bySlug.docs?.[0]?.id ?? null
  }

  const xTenant = req.headers?.get?.('x-tenant-id')?.trim()
  if (xTenant) {
    const byHeaderSlug = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: xTenant.toLowerCase() } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (byHeaderSlug.docs?.[0]?.id != null) return byHeaderSlug.docs[0].id
  }

  const hostRaw =
    req.headers?.get?.('x-forwarded-host') || req.headers?.get?.('host') || ''
  const domain = hostRaw.split(':')[0]?.trim().toLowerCase()
  if (domain && domain !== 'localhost') {
    const byDomain = await payload.find({
      collection: 'tenants',
      where: {
        or: [
          { domain: { equals: domain } },
          { 'domains.domain': { equals: domain } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (byDomain.docs?.[0]?.id != null) return byDomain.docs[0].id

    const parts = domain.split('.')
    if (parts.length >= 3 && parts[0]) {
      const bySub = await payload.find({
        collection: 'tenants',
        where: { slug: { equals: parts[0] } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (bySub.docs?.[0]?.id != null) return bySub.docs[0].id
    }
  }

  return null
}

export const archiveFeedHandler: PayloadHandler = async (req) => {
  const { payload } = req
  const url = new URL(req.url || '', 'http://localhost')

  const tenantParam = (url.searchParams.get('tenant') || '').trim()
  const categoriesRaw = (url.searchParams.get('categories') || '').trim()
  const q = (url.searchParams.get('q') || '').trim()
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1)
  const limit = Math.max(
    1,
    Math.min(36, Number.parseInt(url.searchParams.get('limit') || '12', 10) || 12),
  )

  try {
    const tenantId = await resolveTenantId(payload, tenantParam, req)
    if (tenantId == null) {
      return Response.json({
        docs: [],
        page,
        totalPages: 1,
        totalDocs: 0,
        hasNextPage: false,
      })
    }

    const rawCatTokens = categoriesRaw
      ? categoriesRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : []

    if (rawCatTokens.includes('-1')) {
      return Response.json({
        docs: [],
        page,
        totalPages: 1,
        totalDocs: 0,
        hasNextPage: false,
      })
    }

    const categoryIds: Array<number | string> = rawCatTokens.map((t) =>
      /^\d+$/.test(t) ? Number(t) : t,
    )

    const whereConditions: Where[] = [
      { tenant: { equals: tenantId } },
      { _status: { equals: 'published' } },
      ...(categoryIds.length > 0 ? ([{ categories: { in: categoryIds } }] as Where[]) : []),
      ...(q
        ? ([
            {
              or: [
                { title: { like: q } },
                { slug: { like: q } },
                { 'geo.locationName': { like: q } },
                { 'geo.category': { like: q } },
              ] as Where[],
            },
          ] as Where[])
        : []),
    ]

    const fetched = await payload.find({
      collection: 'posts',
      where: { and: whereConditions },
      draft: false,
      depth: 2,
      limit,
      page,
      pagination: true,
      overrideAccess: true,
      sort: '-publishedOn',
      select: {
        title: true,
        slug: true,
        publishedOn: true,
        sourceUrl: true,
        sourceType: true,
        access: true,
        categories: true,
        meta: true,
        hero: true,
      },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const docs = (fetched.docs || []).map((doc: any) => {
      const cats = (Array.isArray(doc.categories) ? doc.categories : [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .filter((c: any) => c && typeof c === 'object')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((c: any) => ({
          id: c.id,
          title: c.title ?? undefined,
          slug: c.slug ?? undefined,
        }))

      return {
        id: doc.id,
        slug: doc.slug,
        title: doc.title,
        publishedOn: doc.publishedOn ?? null,
        sourceUrl: doc.sourceUrl ?? null,
        sourceType: doc.sourceType ?? null,
        access: doc.access ?? 'public',
        categories: cats,
        meta: {
          description: doc.meta?.description ?? undefined,
          image: shapeMedia(doc.meta?.image),
        },
        hero: {
          media: shapeMedia(doc.hero?.media),
        },
      }
    })

    const resolvedPage = fetched.page ?? page
    const totalPages = fetched.totalPages ?? 1
    const totalDocs = fetched.totalDocs ?? docs.length
    const hasNextPage = Boolean(fetched.hasNextPage ?? resolvedPage < totalPages)

    return Response.json(
      {
        docs,
        page: resolvedPage,
        totalPages,
        totalDocs,
        hasNextPage,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      },
    )
  } catch (err) {
    console.error('[archive-feed] Error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to load archive feed' },
      { status: 500 },
    )
  }
}
