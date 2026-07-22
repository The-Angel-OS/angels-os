import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { resolveRedirect } from '@/utilities/resolveRedirect'

/**
 * Multi-segment catch-all — the migrated-site redirect net.
 *
 * Old WordPress URLs are multi-segment (/product/foo, /2023/05/post-name), so
 * they never reach the single-segment [slug] route; without this they'd hit a
 * bare 404. Real routes always win over a catch-all, so the ONLY traffic here
 * is paths that matched nothing — exactly the set the tenant's redirect map
 * (seeded from the old site's sitemap) exists to rescue.
 */
export default async function CatchAllPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>
}) {
  const { slug } = await params
  const path = '/' + (Array.isArray(slug) ? slug.join('/') : String(slug))

  const { tenantId } = await resolveTenantFromHeaders()
  const payload = await getPayload({ config: configPromise })
  const target = await resolveRedirect(payload, tenantId, path)
  if (target) redirect(target)

  return notFound()
}
