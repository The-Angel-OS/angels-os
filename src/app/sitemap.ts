/**
 * Dynamic Sitemap — /sitemap.xml
 *
 * Generates a sitemap for search engine indexing.
 * Includes static pages plus dynamic content (pages, posts, products, and the
 * Library — every public Work and its chapters).
 *
 * TENANT-SCOPED: Only includes content for the current tenant (resolved from
 * Host header / x-tenant-id). Uses overrideAccess: true with explicit tenant
 * filter — never leaks content from other tenants into the sitemap.
 *
 * Referenced by robots.ts which declares sitemap location.
 *
 * @see src/app/[locale]/(app)/robots.ts — robots.txt with sitemap reference
 */
import type { MetadataRoute } from 'next'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { headers } from 'next/headers'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { getAvailableWorks } from '@/works/registry'

// Per-request, per-tenant (resolved from the Host header) — must NOT be prerendered
// at build (that would bake one tenant's sitemap AND require a live DB during the
// container build). force-dynamic makes it correct AND decouples the build from the DB.
export const dynamic = 'force-dynamic'

/**
 * The origin comes from the REQUEST, not from an env var.
 *
 * `NEXT_PUBLIC_SERVER_URL` bakes at build time, and it is unset in the container
 * build — so every portal on this node was serving a sitemap full of
 * `http://localhost:3000`, which is worse than having no sitemap at all. It is
 * also wrong in principle here: this route is force-dynamic and per-tenant, so
 * the whole point is that each portal's sitemap carries ITS OWN host. The reader
 * already resolves origin this way (`originFromHeaders` in learn/[soul]/[page]).
 */
async function originFromHeaders(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || ''
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  if (host) return `${proto}://${host}`
  return process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000'
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const payload = await getPayload({ config: configPromise })
  const baseUrl = await originFromHeaders()

  // Resolve tenant from request headers — ensures we only index THIS tenant's content
  const { tenantFilter } = await resolveTenantFromHeaders()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]

  // Dynamic pages — tenant-scoped
  const pagesResult = await payload.find({
    collection: 'pages',
    where: {
      and: [
        { _status: { equals: 'published' } },
        tenantFilter,
      ],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    select: { slug: true, updatedAt: true },
  })

  const pages: MetadataRoute.Sitemap = pagesResult.docs
    .filter((doc: any) => doc.slug && doc.slug !== 'home')
    .map((doc: any) => ({
      url: `${baseUrl}/${doc.slug}`,
      lastModified: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }))

  // Blog posts — tenant-scoped
  const postsResult = await payload.find({
    collection: 'posts',
    where: {
      and: [
        { _status: { equals: 'published' } },
        tenantFilter,
      ],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    select: { slug: true, updatedAt: true },
  })

  const posts: MetadataRoute.Sitemap = postsResult.docs
    .filter((doc: any) => doc.slug)
    .map((doc: any) => ({
      url: `${baseUrl}/posts/${doc.slug}`,
      lastModified: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

  // Products — tenant-scoped
  const productsResult = await payload.find({
    collection: 'products',
    where: {
      and: [
        { _status: { equals: 'published' } },
        tenantFilter,
      ],
    },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    select: { slug: true, updatedAt: true },
  })

  const products: MetadataRoute.Sitemap = productsResult.docs
    .filter((doc: any) => doc.slug)
    .map((doc: any) => ({
      url: `${baseUrl}/products/${doc.slug}`,
      lastModified: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
      changeFrequency: 'daily' as const,
      priority: 0.8,
    }))

  // ── The Library ──────────────────────────────────────────────────────────
  // 1,189 Bible chapters plus WDEG and the rest were invisible to search: the
  // sitemap indexed pages, posts and products and nothing else. Chapters are
  // rows now, so this is one query.
  //
  // ponytail: one file, not a sitemap index. The cap is 50,000 URLs and this is
  // ~1,250 — split it when a portal actually approaches the limit.
  //
  // Only PUBLIC works: submitting a page to Google that answers with a paywall
  // is how you earn a soft-404. @see gateWork.ts
  const library: MetadataRoute.Sitemap = []
  try {
    const { tenant } = await resolveTenantFromHeaders()
    const available = await getAvailableWorks((tenant as { slug?: string } | null)?.slug ?? null)
    const bySlug = new Map(available.map((w) => [w.id, w]))

    if (bySlug.size) {
      const rows = await payload.find({
        collection: 'works',
        where: { and: [{ slug: { in: [...bySlug.keys()] } }, { access: { equals: 'public' } }] },
        limit: 0,
        pagination: false,
        depth: 0,
        overrideAccess: true,
        select: { slug: true, updatedAt: true },
      })

      const ids = rows.docs.map((d) => d.id)
      const chapters = ids.length
        ? await payload.find({
            collection: 'work-chapters',
            where: { work: { in: ids } },
            limit: 0,
            pagination: false,
            depth: 0,
            overrideAccess: true,
            sort: 'order',
            select: { work: true, slug: true, updatedAt: true },
          })
        : { docs: [] as Array<Record<string, unknown>> }

      const slugById = new Map(rows.docs.map((d) => [d.id, (d as { slug?: string }).slug]))

      for (const d of rows.docs) {
        const slug = (d as { slug?: string }).slug
        if (!slug) continue
        library.push({
          url: `${baseUrl}/learn/${slug}`,
          lastModified: (d as { updatedAt?: string }).updatedAt
            ? new Date((d as { updatedAt?: string }).updatedAt!)
            : new Date(),
          changeFrequency: 'monthly' as const,
          priority: 0.7,
        })
      }

      for (const c of chapters.docs as Array<Record<string, unknown>>) {
        const chapterSlug = typeof c.slug === 'string' ? c.slug : ''
        const workId = typeof c.work === 'object' && c.work
          ? (c.work as { id?: number }).id
          : (c.work as number | undefined)
        const workSlug = workId != null ? slugById.get(workId) : undefined
        if (!chapterSlug || !workSlug) continue
        library.push({
          url: `${baseUrl}/learn/${workSlug}/${chapterSlug}`,
          lastModified: typeof c.updatedAt === 'string' ? new Date(c.updatedAt) : new Date(),
          changeFrequency: 'yearly' as const,
          priority: 0.5,
        })
      }
    }
  } catch {
    // A sitemap missing the Library beats a sitemap that 500s.
  }

  return [...staticPages, ...pages, ...posts, ...products, ...library]
}
