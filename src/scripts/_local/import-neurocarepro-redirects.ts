/**
 * One-off: seed tenant 22's redirect map from the OLD NeuroCare Pro site's
 * sitemap (neurocarepro.com — WordPress/Yoast sitemap_index.xml).
 *
 * Mapping strategy (best-effort, editable afterward in admin):
 *   1. Exact slug match against the portal's own pages/posts/products → deep link.
 *   2. Section defaults: /product* → /shop · blog-ish (/YYYY/MM/, /blog/) → /posts
 *      · /contact* → /contact · everything else → / (home).
 * Idempotent: skips paths that already have a redirect row.
 *
 *   node_modules/.bin/payload run src/scripts/_local/import-neurocarepro-redirects.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const TENANT = 22
const SITEMAP_INDEX = 'https://neurocarepro.com/sitemap_index.xml'
const NOTE = 'old sitemap import 260722'

const payload = await getPayload({ config })

const fetchXml = async (url: string): Promise<string> => {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${url} -> ${res.status}`)
  return res.text()
}
const locs = (xml: string): string[] => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1])

// 1. Collect every URL from every child sitemap.
const index = await fetchXml(SITEMAP_INDEX)
const childSitemaps = locs(index).filter((u) => u.endsWith('.xml'))
const pageUrls = new Set<string>()
for (const sm of childSitemaps) {
  try {
    for (const u of locs(await fetchXml(sm))) if (!u.endsWith('.xml')) pageUrls.add(u)
  } catch (err) {
    console.warn('SKIP sitemap', sm, err instanceof Error ? err.message : err)
  }
}
console.log(`Old site URLs: ${pageUrls.size} (from ${childSitemaps.length} sitemaps)`)

// 2. Portal content slugs for exact-match deep links.
const slugSet = async (collection: string): Promise<Set<string>> => {
  const r = await payload.find({
    collection: collection as never,
    where: { tenant: { equals: TENANT } } as never,
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })
  return new Set(
    (r.docs as Array<{ slug?: string }>).map((d) => String(d.slug || '').toLowerCase()).filter(Boolean),
  )
}
const [pageSlugs, postSlugs, productSlugs] = await Promise.all([
  slugSet('pages'),
  slugSet('posts'),
  slugSet('products'),
])

const mapTarget = (path: string): string => {
  const last = path.split('/').filter(Boolean).pop() || ''
  if (pageSlugs.has(last)) return `/${last}`
  if (productSlugs.has(last)) return `/products/${last}`
  if (postSlugs.has(last)) return `/posts/${last}`
  if (/^\/(product|shop|store)\b/.test(path)) return '/shop'
  if (/^\/\d{4}\/\d{2}\//.test(path) || /^\/(blog|news|category|tag|author)\b/.test(path)) return '/posts'
  if (/contact/.test(path)) return '/contact'
  return '/'
}

// 3. Upsert rows (skip existing froms).
const existing = await payload.find({
  collection: 'redirects' as never,
  where: { tenant: { equals: TENANT } } as never,
  limit: 1000,
  depth: 0,
  overrideAccess: true,
})
const have = new Set((existing.docs as Array<{ from?: string }>).map((d) => String(d.from || '')))

let created = 0
const tally: Record<string, number> = {}
for (const u of pageUrls) {
  let path: string
  try {
    path = new URL(u).pathname
  } catch {
    continue
  }
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  path = path.toLowerCase()
  if (path === '/' || have.has(path)) continue
  const to = mapTarget(path)
  tally[to] = (tally[to] || 0) + 1
  await payload.create({
    collection: 'redirects' as never,
    data: { from: path, to, enabled: true, note: NOTE, tenant: TENANT } as never,
    overrideAccess: true,
  })
  created++
}
console.log(`Created ${created} redirects.`)
console.log('Destination tally:', JSON.stringify(tally, null, 2))
process.exit(0)
