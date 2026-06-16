/**
 * Works API — public, read-only surface over the file-based Library (souls).
 *
 *   GET /api/works-ops/list            → summaries of every Work
 *   GET /api/works-ops/get?soul=<id>   → one Work's manifest + content
 *
 * Why this exists: Works (the Library) are file-based souls — markdown docs in
 * `docs/vision/<soul>/` and illustrated book manifests in `public/library/<slug>/`,
 * read off the server filesystem by the web reader. A thin client (Nimue, the
 * Android app — a Capacitor static export) cannot touch the filesystem, so it
 * needs an HTTP surface. These handlers expose the SAME content the web reader
 * renders, shaped for a generic reader client.
 *
 * Auth: NONE. The Library is "read freely, no account required" — public by
 * design. Registered as Payload endpoints so they inherit the Payload CORS
 * allowlist (native-client origins https://localhost etc. already covered).
 *
 * Image URLs are returned RELATIVE (as authored). A client prefixes them with
 * the serving origin (Nimue's absUrl()).
 *
 * Message-based Works (life-log → timeline) will plug into the same response
 * shape later; this endpoint is the file-based seed.
 */
import type { PayloadHandler } from 'payload'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { getAllSouls, getSoul } from '@/souls'
import { isWorkAvailable, homeForWork } from '@/souls/subscriptions'
import { loadBookFromPublic } from '@/components/Library/bookManifestServer'

type SoulManifest = ReturnType<typeof getAllSouls>[number]

/** Work JSON interchange version (see docs/planning/WORKS_AS_JSON.md). */
const WORK_JSON_VERSION = 'work.v1'

/** Serving origin from request headers, e.g. https://platform.spacesangels.com. */
function originFromReq(req: Parameters<PayloadHandler>[0]): string {
  const h = req.headers
  const host = h?.get('x-forwarded-host') || h?.get('host') || ''
  const proto = h?.get('x-forwarded-proto') || 'https'
  return host ? `${proto}://${host}` : ''
}

/**
 * Absolutize a (possibly relative) media URL against the serving origin. The
 * portable Work JSON must carry ABSOLUTE urls — a relative path is meaningless
 * once the JSON leaves its origin node (media-by-reference; storage is a per-node
 * adapter). Already-absolute urls pass through.
 */
function absMedia(url: string | null | undefined, origin: string): string | null {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  if (!origin) return url
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`
}

/**
 * Content address for a Work — sha256 over a normalized payload that EXCLUDES
 * absolute urls, so the same authored Work hashes identically regardless of which
 * node serves it or where its media lives. This is the handle catalog gossip rides.
 */
function checksumOf(normalized: unknown): string {
  return 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}

/**
 * Resolve the tenant SLUG this request is acting as, for Work scoping.
 *
 * Nimue hits the NODE host (platform.spacesangels.com) for every platform-node
 * endeavor, so hostname can't tell the endeavors apart — the client must pass
 * `?tenant=<slug|id>`. Numeric ⇒ resolve to slug. Falls back to the x-tenant-id
 * header / hostname (works for the web, where the subdomain IS the tenant).
 * Returns null when nothing resolves (unscoped: super_admin / dev) ⇒ no filter.
 */
async function resolveTenantSlug(req: Parameters<PayloadHandler>[0]): Promise<string | null> {
  const url = new URL(req.url || '', 'http://localhost')
  const param = url.searchParams.get('tenant')
  if (param) {
    if (/^\d+$/.test(param)) {
      try {
        const t = await req.payload.findByID({ collection: 'tenants', id: Number(param), depth: 0, overrideAccess: true })
        return (t as { slug?: string })?.slug ?? null
      } catch {
        return null
      }
    }
    return param
  }
  // Header / hostname fallback (web).
  const header = req.headers?.get('x-tenant-id')
  if (header) return header
  return null
}

/** Best-effort cover image for a Work — first illustrated page/doc, if any. */
function coverFor(soul: SoulManifest): string | null {
  if (soul.bookSlug) {
    const loaded = loadBookFromPublic(soul.bookSlug)
    const page = loaded?.manifest.pages?.find((p) => p.image)
    return page?.image ?? null
  }
  const doc = soul.docs?.find((d) => d.image)
  return doc?.image ?? null
}

function summarize(soul: SoulManifest, origin = '') {
  const isBook = Boolean(soul.bookSlug)
  let pageCount = 0
  if (isBook) {
    const loaded = loadBookFromPublic(soul.bookSlug as string)
    pageCount = loaded?.manifest.pageCount ?? loaded?.manifest.pages?.length ?? 0
  }
  return {
    id: soul.id,
    title: soul.title,
    subtitle: soul.subtitle,
    description: soul.description,
    status: soul.status,
    statusColor: soul.statusColor,
    tags: soul.tags ?? [],
    type: isBook ? 'book' : 'document',
    cover: absMedia(coverFor(soul), origin),
    unitCount: isBook ? pageCount : soul.docs?.length ?? 0,
    canonicalOrigin: soul.canonical?.origin ?? null,
    home: homeForWork(soul.id),
  }
}

/** GET /api/works-ops/list */
export const worksListHandler: PayloadHandler = async (req) => {
  const { payload } = req
  try {
    const tenantSlug = await resolveTenantSlug(req)
    const origin = originFromReq(req)
    const works = getAllSouls()
      .filter((s) => isWorkAvailable(s.id, tenantSlug))
      .map((s) => summarize(s, origin))
    return Response.json({ ok: true, version: WORK_JSON_VERSION, total: works.length, tenant: tenantSlug, scoped: Boolean(tenantSlug), works })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[works-list] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

/** GET /api/works-ops/get?soul=<id> */
export const worksGetHandler: PayloadHandler = async (req) => {
  const { payload } = req
  const url = new URL(req.url || '', 'http://localhost')
  const soulId = url.searchParams.get('soul') || ''

  const soul = getSoul(soulId)
  if (!soul) return Response.json({ error: 'work not found' }, { status: 404 })

  // Lockdown: a Work not subscribed to this tenant is not readable here (deep
  // links 404 too, not just hidden from the list).
  const tenantSlug = await resolveTenantSlug(req)
  if (!isWorkAvailable(soulId, tenantSlug)) {
    return Response.json({ error: 'work not available on this endeavor' }, { status: 404 })
  }
  const origin = originFromReq(req)

  try {
    // ── Book works → manifest + base-language text + inferred chapter slugs ──
    if (soul.bookSlug) {
      const loaded = loadBookFromPublic(soul.bookSlug)
      if (!loaded) return Response.json({ error: 'book manifest missing' }, { status: 404 })
      const pages = loaded.manifest.pages.map((p, i) => ({
        order: p.order,
        image: absMedia(p.image, origin),
        title: loaded.pageTitles[i] || p.title || null,
        slug: loaded.pageSlugs[i],
        text: loaded.baseText[String(p.order)] ?? p.markdown ?? '',
      }))
      // Content address excludes urls → stable across nodes/storage.
      const checksum = checksumOf({
        slug: soul.id,
        type: 'book',
        chapters: pages.map((p) => ({ order: p.order, slug: p.slug, title: p.title, text: p.text })),
      })
      return Response.json({
        ok: true,
        version: WORK_JSON_VERSION,
        checksum,
        ...summarize(soul, origin),
        baseLanguage: loaded.baseLanguage,
        languages: loaded.manifest.languages ?? [],
        pages,
      })
    }

    // ── Document souls → manifest docs + markdown contents ──────────────────
    const docsBase = path.join(process.cwd(), 'docs', 'vision', soulId)
    const docs = (soul.docs ?? []).map((d) => {
      let body = ''
      try {
        body = fs.readFileSync(path.join(docsBase, d.filename), 'utf-8')
      } catch {
        body = `# ${d.title}\n\n*Document not found.*`
      }
      return {
        id: d.id,
        title: d.title,
        date: d.date,
        description: d.description,
        tier: d.tier,
        badge: d.badge ?? null,
        badgeColor: d.badgeColor ?? null,
        image: absMedia(d.image, origin),
        body,
      }
    })

    // Content address excludes urls → stable across nodes/storage.
    const checksum = checksumOf({
      slug: soul.id,
      type: 'document',
      chapters: docs.map((d, i) => ({ order: i, slug: d.id, title: d.title, tier: d.tier, body: d.body })),
    })

    return Response.json({
      ok: true,
      version: WORK_JSON_VERSION,
      checksum,
      ...summarize(soul, origin),
      defaultDoc: soul.defaultDoc,
      links: soul.links ?? [],
      docs,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[works-get] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
