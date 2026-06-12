/**
 * Resolve Edit — GET /api/edit-ops/resolve?path=<pathname>&tenantId=<id>
 *
 * Maps a public-facing path to the Payload admin editor for the document it
 * renders, so a logged-in editor can jump straight from "viewing" to "editing"
 * (e.g. from the Portal Switcher's "Edit this page" link). Read-only.
 *
 * Editable public routes → collection:
 *   /                  → pages (slug 'home')
 *   /<slug>            → pages
 *   /posts/<slug>      → posts
 *   /products/<slug>   → products
 *   /events/<slug>     → events
 *
 * Auth: requires a logged-in user (cookie). Anonymous → { editable:false }.
 * The Payload admin remains the final access gate on the returned URL.
 */
import type { PayloadHandler } from 'payload'

const NOUN: Record<string, string> = {
  pages: 'page',
  posts: 'post',
  products: 'product',
  events: 'event',
}

/** First path segments that are NOT a top-level Page slug. */
const NON_PAGE_PREFIXES = new Set([
  'posts', 'products', 'shop', 'events', 'federation', 'learn', 'account',
  'orders', 'checkout', 'dashboard', 'login', 'logout', 'create-account',
  'forgot-password', 'find-order', 'invite', 'tenant-invite', 'unsubscribe',
  'kiosk', 'spaces', 'admin', 'api', 'makers', 'book', 'donate',
])

/** Parse a (locale-stripped) pathname into a {collection, slug} editable target. */
export function parsePath(path: string): { collection: string; slug: string } | null {
  // Strip query/hash + a leading locale segment (/en, /es, ...).
  let p = path.split('?')[0].split('#')[0]
  p = p.replace(/^\/[a-z]{2}(?=\/|$)/, '')
  const segs = p.split('/').filter(Boolean)

  if (segs.length === 0) return { collection: 'pages', slug: 'home' }

  if (segs.length === 2) {
    if (segs[0] === 'posts') return { collection: 'posts', slug: segs[1] }
    if (segs[0] === 'products' || segs[0] === 'shop') return { collection: 'products', slug: segs[1] }
    if (segs[0] === 'events') return { collection: 'events', slug: segs[1] }
  }

  // Single segment that isn't a reserved route → a top-level Page.
  if (segs.length === 1 && !NON_PAGE_PREFIXES.has(segs[0])) {
    return { collection: 'pages', slug: segs[0] }
  }

  return null
}

export const resolveEditHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')
  const path = url.searchParams.get('path') || '/'
  const tenantId = url.searchParams.get('tenantId')

  // Only logged-in users get edit links.
  if (!user) return Response.json({ editable: false })

  const target = parsePath(path)
  if (!target) return Response.json({ editable: false })

  try {
    const where: Record<string, unknown> = { slug: { equals: target.slug } }
    if (tenantId) where.tenant = { equals: Number(tenantId) }

    const res = await payload.find({
      collection: target.collection as 'pages',
      where: where as never,
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const doc = res.docs?.[0] as { id: number | string } | undefined
    if (!doc) return Response.json({ editable: false })

    return Response.json({
      editable: true,
      collection: target.collection,
      id: doc.id,
      adminUrl: `/admin/collections/${target.collection}/${doc.id}`,
      label: `Edit this ${NOUN[target.collection] || 'item'}`,
    })
  } catch (e) {
    payload.logger?.error?.(`[resolve-edit] ${e instanceof Error ? e.message : String(e)}`)
    return Response.json({ editable: false })
  }
}
