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
import { getSoul } from '@/souls'
import { getWork, getAvailableWorks, isWorkAvailable, type WorkRecord } from '@/works/registry'
import { tagRows } from '@/works/availability'
import { loadBookFromPublic, loadBookFromOrigin } from '@/components/Library/bookManifestServer'
// Single source of truth for assembly + the portable-JSON helpers (shared with
// the web readers) — so the content checksum can never drift between surfaces.
import { getWorkJson, absMedia, checksumOf, WORK_JSON_VERSION } from '@/utilities/getWorkJson'
import { getDailyBread, DailyBreadError } from '@/utilities/dailyBread'


/** Serving origin from request headers, e.g. https://platform.spacesangels.com. */
function originFromReq(req: Parameters<PayloadHandler>[0]): string {
  const h = req.headers
  const host = h?.get('x-forwarded-host') || h?.get('host') || ''
  const proto = h?.get('x-forwarded-proto') || 'https'
  return host ? `${proto}://${host}` : ''
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

/**
 * Lightweight catalog summary for the list: manifest fields from the soul, but
 * cover + unitCount from the message-backed DB (NOT the filesystem — the files
 * are gone). `dbInfo` is precomputed once per request by the list handler.
 */
/**
 * The owner of record for a Work. The DB row is authoritative (a portal owner can
 * change it); the manifest's canonical.endeavor is only the seed for a Work that
 * has never been imported on this node.
 */
async function ownerFor(soulId: string, manifestEndeavor?: string | null): Promise<string> {
  return (await getWork(soulId))?.owner || manifestEndeavor || 'platform'
}

function listSummary(soul: WorkRecord, origin: string, dbInfo?: { cover: string | null; unitCount: number }) {
  return {
    id: soul.id,
    title: soul.title,
    subtitle: soul.subtitle,
    description: soul.description,
    status: soul.status,
    statusColor: soul.statusColor,
    tags: soul.tags ?? [],
    type: soul.bookSlug ? 'book' : 'document',
    cover: absMedia(dbInfo?.cover ?? null, origin),
    unitCount: dbInfo?.unitCount ?? 0,
    canonicalOrigin: soul.canonical?.origin ?? null,
    home: soul.owner,
  }
}

/** GET /api/works-ops/list */
export const worksListHandler: PayloadHandler = async (req) => {
  const { payload } = req
  try {
    const tenantSlug = await resolveTenantSlug(req)
    const origin = originFromReq(req)
    const souls = await getAvailableWorks(tenantSlug)

    // Cover + unitCount come from the message-backed content (the filesystem is
    // gone). One scan of the `work-*` channels, grouped by work, gives both.
    // ⚠️ SCALE: at thousands of works, denormalize cover/unitCount onto the works
    // record (write-time) and read those instead of scanning chapter messages.
    const dbInfo = new Map<string, { cover: string | null; unitCount: number; coverOrder: number }>()
    try {
      const res = await payload.find({
        collection: 'messages',
        where: { channel: { like: 'work-' } },
        limit: 5000,
        depth: 0,
        overrideAccess: true,
        select: { channel: true, metadata: true },
      })
      for (const m of res.docs as Array<Record<string, unknown>>) {
        const channel = String(m.channel ?? '')
        if (!channel.startsWith('work-')) continue
        const md = (m.metadata as Record<string, unknown>) || {}
        if (md.kind !== 'work_chapter') continue
        const slug = channel.slice('work-'.length)
        const e = dbInfo.get(slug) ?? { cover: null, unitCount: 0, coverOrder: Number.POSITIVE_INFINITY }
        e.unitCount++
        const ord = (md.order as number) ?? 0
        if (md.image && ord < e.coverOrder) { e.cover = md.image as string; e.coverOrder = ord }
        dbInfo.set(slug, e)
      }
    } catch {
      /* messages hiccup → summaries degrade to cover:null/unitCount:0 */
    }

    const works = souls.map((s) => listSummary(s, origin, dbInfo.get(s.id)))
    return Response.json({ ok: true, version: WORK_JSON_VERSION, total: works.length, tenant: tenantSlug, scoped: Boolean(tenantSlug), works })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[works-list] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

/** GET /api/works-ops/get?soul=<id> — Work JSON v1 assembled from the DB. */
export const worksGetHandler: PayloadHandler = async (req) => {
  const { payload } = req
  const url = new URL(req.url || '', 'http://localhost')
  const soulId = url.searchParams.get('soul') || ''

  const soul = await getWork(soulId)
  if (!soul) return Response.json({ error: 'work not found' }, { status: 404 })

  // Lockdown: a Work not subscribed to this tenant is not readable here.
  const tenantSlug = await resolveTenantSlug(req)
  if (!isWorkAvailable(soul, tenantSlug)) {
    return Response.json({ error: 'work not available on this endeavor' }, { status: 404 })
  }

  try {
    // Single source of truth (shared with the web readers) — DB only, no files.
    const work = await getWorkJson({ payload, soulId, tenantSlug, origin: originFromReq(req) })
    if (!work) return Response.json({ error: 'work not available on this endeavor' }, { status: 404 })
    return Response.json(work)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[works-get] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

/**
 * GET /api/works-ops/checksums — the OFFLINE-SYNC primitive.
 *
 * One cheap call returns the CURRENT content checksum of every Work available to the
 * tenant. A client (Nimue) diffs this against its cached `{ soul → checksum }` map in a
 * single request, then re-pulls only the works whose checksum changed via
 * /works-ops/get?soul=<id>. Works rarely change, so the client can poll this on a slow
 * cadence. Checksums match /get exactly (same getWorkJson source of truth) so the diff
 * is never wrong.
 *
 * Auth: none (read-freely, like list/get). Scope: ?tenant=<slug|id>.
 *
 * ⚠️ SCALE: this assembles each Work to hash it (parity with /get). At many works,
 * read the denormalized `works.checksum` column instead (written at import/seal time).
 */
export const worksChecksumsHandler: PayloadHandler = async (req) => {
  const { payload } = req
  try {
    const tenantSlug = await resolveTenantSlug(req)
    const origin = originFromReq(req)
    const souls = await getAvailableWorks(tenantSlug)

    const works: Array<{ id: string; checksum: string; version: string; type: string; unitCount: number; title: string }> = []
    for (const s of souls) {
      try {
        const work = await getWorkJson({ payload, soulId: s.id, tenantSlug, origin })
        if (work?.checksum) {
          works.push({
            id: s.id,
            checksum: work.checksum,
            version: work.version,
            type: work.type,
            unitCount: work.unitCount ?? 0,
            title: work.title,
          })
        }
      } catch {
        /* a work that fails to assemble is simply omitted — the client keeps its cache */
      }
    }

    return Response.json({ ok: true, version: WORK_JSON_VERSION, tenant: tenantSlug, total: works.length, works })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[works-checksums] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

/**
 * GET /api/works-ops/import?soul=<id> — materialize a DOCUMENT Work's chapters
 * as messages (Phase 2). Idempotent: clears this Work's channel then recreates
 * one message per doc (messageType 'system', metadata.kind 'work_chapter',
 * metadata.order), and upserts the `works` catalog record with
 * storageRef → messages. Chapter messages carry NO attachments, so the Messages
 * workflow/media hooks no-op (no LEO, no analysis). Books not handled (they stay
 * on the manifest reader). Auth: super_admin OR ?key=CRON_SECRET.
 */
export const worksImportHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')
  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(user && ((user as { roles?: string[] }).roles || []).includes('super_admin'))
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })

  const soulId = url.searchParams.get('soul') || ''
  const soul = getSoul(soulId)
  if (!soul) return Response.json({ error: 'work not found' }, { status: 404 })

  // ── Chunking (BOOK works only) ──────────────────────────────────────────────
  // A large book (the Bible = 1189 chapters) can't materialize in one serverless
  // invocation — ~1189 sequential message creates blow past the function timeout
  // (the observed 504, which left a partial + DUPLICATED channel because each
  // re-run stacked on the last). So the book branch processes a PAGE RANGE per
  // call: `?from=N&count=M`. The FIRST chunk (from=0) clears the channel; the
  // LAST chunk (covers the final page) writes the `works` catalog row + checksum.
  // A tiny driver (scripts/import-bible.mjs) loops the ranges. Idempotent overall.
  const fromParam = Number(url.searchParams.get('from'))
  const countParam = Number(url.searchParams.get('count'))
  const chunkFrom = Number.isFinite(fromParam) && fromParam > 0 ? Math.floor(fromParam) : 0
  const chunkCount = Number.isFinite(countParam) && countParam > 0 ? Math.floor(countParam) : 0 // 0 ⇒ all

  try {
    const ownerSlug = await ownerFor(soulId, soul.canonical?.endeavor)
    // Host tenant = where the content messages live. Defaults to the canonical
    // owner; a subscriber node passes ?tenant=<localSlug> to host a local copy
    // (the owner of record stays `ownerSlug`).
    const hostSlug = url.searchParams.get('tenant') || ownerSlug
    const tRes = await payload.find({ collection: 'tenants', where: { slug: { equals: hostSlug } }, limit: 1, depth: 0, overrideAccess: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenant = (tRes.docs as any[])[0]
    if (!tenant) return Response.json({ error: `host tenant '${hostSlug}' not on this node` }, { status: 404 })

    const sRes = await payload.find({ collection: 'spaces', where: { tenant: { equals: tenant.id } }, limit: 1, sort: 'createdAt', depth: 0, overrideAccess: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const space = (sRes.docs as any[])[0]
    if (!space) return Response.json({ error: `no space on '${hostSlug}' to host the work channel` }, { status: 409 })
    const channel = `work-${soulId}`
    const origin = originFromReq(req)

    // Idempotent: clear this Work's channel on the FIRST chunk only. A resumable
    // book import (from>0) must NOT clear — that would wipe earlier chunks.
    if (chunkFrom === 0) {
      await payload.delete({ collection: 'messages', where: { and: [{ space: { equals: space.id } }, { channel: { equals: channel } }] }, overrideAccess: true })
    }

    let chapters = 0
    let checksum = ''
    let imagesUploaded = 0
    const imageErrors: string[] = []
    let storageRef: Record<string, unknown> = { kind: 'messages', space: space.id, channel }
    const type: 'document' | 'book' = soul.bookSlug ? 'book' : 'document'

    if (soul.bookSlug) {
      // ── BOOK → messages (fully portable, no filesystem at read time) ─────────
      // fs-first (works locally); origin/CDN fallback for Vercel, where `public/`
      // is not traced into the API function bundle so the fs read returns null.
      const loaded = loadBookFromPublic(soul.bookSlug) ?? (await loadBookFromOrigin(soul.bookSlug, origin))
      if (!loaded) return Response.json({ error: 'book manifest unreadable' }, { status: 500 })
      const languages = loaded.manifest.languages ?? []
      const langs = languages.map((l) => l.code)
      const baseLang = loaded.baseLanguage
      const pages = loaded.manifest.pages
      const totalPages = pages.length

      // The page range THIS chunk materializes. count=0 ⇒ to the end (one-shot,
      // for small books). The Bible driver passes count to stay under the timeout.
      const end = chunkCount > 0 ? Math.min(chunkFrom + chunkCount, totalPages) : totalPages
      const isFirstChunk = chunkFrom === 0
      const isLastChunk = end >= totalPages

      // Per-language text — fetch from the ORIGIN (CDN-served; non-base langs are
      // not traced into the serverless fs).
      const langText: Record<string, Record<string, string>> = {}
      for (const code of langs) {
        try {
          const r = await fetch(`${origin}/library/${soul.bookSlug}/text/${code}.json`)
          if (r.ok) langText[code] = await r.json()
        } catch { /* skip lang */ }
      }
      langText[baseLang] = langText[baseLang] ?? (loaded.baseText as Record<string, unknown>)

      // Upload page images to media (→ Blob) ONLY for pages in this chunk's range
      // that actually carry an image. Scripture-style books (the Bible) have NO
      // page images, so this loop is a no-op for them — which is most of why the
      // old one-shot import timed out only on real illustrated books, and why the
      // Bible's bottleneck is purely the message-create count (hence chunking).
      const urlByImage: Record<string, string> = {}
      for (let i = chunkFrom; i < end; i++) {
        const p = pages[i]
        if (!p.image || urlByImage[p.image]) continue
        const basename = p.image.split('/').pop() || 'page.webp'
        try {
          let buf: Buffer | null = null
          try { buf = fs.readFileSync(path.join(process.cwd(), 'public', 'library', 'cas', basename)) } catch { buf = null }
          if (!buf) {
            const r = await fetch(`${origin}${p.image}`)
            if (r.ok) buf = Buffer.from(await r.arrayBuffer())
          }
          if (!buf) { imageErrors.push(`${basename}: no bytes`); continue }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const media = await payload.create({ collection: 'media', overrideAccess: true, data: { alt: `${soul.title}`, tenant: tenant.id } as any, file: { data: buf, mimetype: 'image/webp', name: basename, size: buf.length } })
          const u = String((media as { url?: string }).url || '')
          urlByImage[p.image] = u
          if (!u) imageErrors.push(`${basename}: media.url empty`)
        } catch (e) { imageErrors.push(`${basename}: ${e instanceof Error ? e.message : String(e)}`) }
      }
      imagesUploaded = Object.values(urlByImage).filter(Boolean).length

      // One message per page IN THIS CHUNK. Carries the book hierarchy
      // (book/bookName/chapter/ref) when the manifest page has it, so a
      // "collection of books" work (the Bible) can drive a Book → Chapter reader.
       
      const pageWithHierarchy = (p: (typeof pages)[number]) => p as typeof p & { book?: string; bookName?: string; chapter?: number; ref?: string }
      for (let i = chunkFrom; i < end; i++) {
        const p = pages[i]
        const ph = pageWithHierarchy(p)
        const ord = String(p.order)
        const translations: Record<string, unknown> = {}
        for (const code of langs) translations[code] = langText[code]?.[ord] ?? ''
        const baseVal = translations[baseLang]
        await payload.create({
          collection: 'messages',
          overrideAccess: true,
          data: {
            space: space.id, channel, messageType: 'system', visibility: 'tenant',
            content: { type: 'text', text: typeof baseVal === 'string' ? baseVal : '' },
            metadata: {
              kind: 'work_chapter', workSlug: soul.id, order: i,
              slug: loaded.pageSlugs[i], title: loaded.pageTitles[i] || ph.title || null,
              image: p.image ? (urlByImage[p.image] ?? null) : null,
              book: ph.book ?? null, bookName: ph.bookName ?? null,
              chapter: typeof ph.chapter === 'number' ? ph.chapter : null,
              ref: ph.ref ?? null,
              translations,
            },
          },
        })
        chapters++
      }

      // A resumable book import only finalizes (storageRef/checksum/works row) on
      // the LAST chunk. Earlier chunks just report progress + nextFrom and return.
      if (!isLastChunk) {
        return Response.json({
          ok: true, soul: soulId, type: 'book', owner: ownerSlug, space: space.id, channel,
          chunk: { from: chunkFrom, to: end, total: totalPages, cleared: isFirstChunk },
          chapters, nextFrom: end, done: false, imagesUploaded, imageErrors: imageErrors.slice(0, 5),
        })
      }
      storageRef = { kind: 'messages', space: space.id, channel, baseLanguage: baseLang, languages }
      checksum = checksumOf({
        slug: soul.id, type: 'book',
        chapters: pages.map((p, i) => {
          const t = langText[baseLang]?.[String(p.order)]
          return { order: i, slug: loaded.pageSlugs[i], title: loaded.pageTitles[i], text: typeof t === 'string' ? t : JSON.stringify(t ?? '') }
        }),
      })
    } else {
      // ── DOCUMENT → one message per markdown doc ──
      const docsBase = path.join(process.cwd(), 'docs', 'vision', soulId)
      const soulDocs = soul.docs ?? []
      const bodies = soulDocs.map((d) => {
        try { return fs.readFileSync(path.join(docsBase, d.filename), 'utf-8') } catch { return `# ${d.title}\n\n*Document not found.*` }
      })
      for (let i = 0; i < soulDocs.length; i++) {
        const d = soulDocs[i]
        await payload.create({
          collection: 'messages',
          overrideAccess: true,
          data: {
            space: space.id, channel, messageType: 'system', visibility: 'tenant',
            content: { type: 'text', text: bodies[i] },
            metadata: {
              kind: 'work_chapter', workSlug: soulId, order: i,
              chapterSlug: d.id, title: d.title, date: d.date, description: d.description,
              tier: d.tier, badge: d.badge ?? null, badgeColor: d.badgeColor ?? null, image: d.image ?? null,
            },
          },
        })
        chapters++
      }
      checksum = checksumOf({
        slug: soul.id, type: 'document',
        chapters: soulDocs.map((d, i) => ({ order: i, slug: d.id, title: d.title, tier: d.tier, body: bodies[i] })),
      })
    }

    const recData = {
      slug: soul.id, title: soul.title, subtitle: soul.subtitle, description: soul.description,
      type, status: soul.status, statusColor: soul.statusColor,
      tags: tagRows(soul.tags), canonical: soul.canonical ?? null,
      owner: ownerSlug,
      storageRef, checksum, jsonVersion: WORK_JSON_VERSION,
    }
    const existing = await payload.find({ collection: 'works', where: { slug: { equals: soul.id } }, limit: 1, depth: 0, overrideAccess: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ex = (existing.docs as any[])[0]
    // json fields (tags/canonical/subscribers/storageRef) are loosely typed → cast.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = recData as any
    if (ex) await payload.update({ collection: 'works', id: ex.id, data, overrideAccess: true })
    else await payload.create({ collection: 'works', data, overrideAccess: true })

    return Response.json({ ok: true, soul: soulId, type, owner: ownerSlug, space: space.id, channel, chapters, checksum, done: true, imagesUploaded, imageErrors: imageErrors.slice(0, 5) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[works-import] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

/**
 * GET /api/works-ops/pull?soul=<id>&from=<peer-origin>[&tenant=<localSlug>][&fromTenant=<srcSlug>]
 *
 * CROSS-NODE REPLICATION (Works syndication Phase 5). A subscriber node PULLS a
 * Work's content from the peer that hosts it and materializes a LOCAL subscriber
 * copy (messages + works catalog record), so the reader keeps reading purely from
 * the local DB — no render-time cross-node fetch.
 *
 * Why a pull (not the file-based `import`): the on-disk soul files were deleted
 * once Works became message-backed (51d90bc), so `import` can only reconstruct
 * "Document not found" bodies on a node that never had the files. The content now
 * lives only as messages on the hosting node; the only way to seed a new node is
 * to fetch the assembled Work JSON (v1) from that node's `works-ops/get`.
 *
 * Media is referenced BY ABSOLUTE URL from the source (reference-by-default — the
 * subscriber copy points at the origin's media; rel=canonical stays home). A
 * mirror-the-bytes variant can come later (identical path to Audible offline DL).
 *
 * DOCUMENT works only for now; BOOK works (image pages + per-language text) need
 * the media/translation handling and are deferred to the book-nav workstream.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Idempotent (clears + recreates the
 * Work's channel). Both nodes are Vercel-hosted, so this fetch is Vercel→Vercel
 * (never the IONOS WAF path that defeats render-time peer fetches).
 */
export const worksPullHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')
  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(user && ((user as { roles?: string[] }).roles || []).includes('super_admin'))
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })

  const soulId = url.searchParams.get('soul') || ''
  const from = (url.searchParams.get('from') || '').replace(/\/+$/, '')
  if (!soulId) return Response.json({ error: 'soul required' }, { status: 400 })
  if (!from || !/^https?:\/\//.test(from)) return Response.json({ error: 'from (peer origin, https://…) required' }, { status: 400 })

  try {
    const ownerSlug = await ownerFor(soulId)
    const hostSlug = url.searchParams.get('tenant') || ownerSlug
    const fromTenant = url.searchParams.get('fromTenant') || ownerSlug

    // ── Fetch the assembled Work JSON from the hosting peer (Vercel→Vercel) ──
    const srcUrl = `${from}/api/works-ops/get?soul=${encodeURIComponent(soulId)}&tenant=${encodeURIComponent(fromTenant)}`
    let work: Record<string, unknown>
    try {
      const r = await fetch(srcUrl, { headers: { accept: 'application/json' }, cache: 'no-store' })
      if (!r.ok) return Response.json({ error: `peer fetch ${r.status} from ${srcUrl}` }, { status: 502 })
      work = (await r.json()) as Record<string, unknown>
    } catch (e) {
      return Response.json({ error: `peer fetch threw: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 })
    }
    if ((work as { type?: string }).type === 'book') {
      return Response.json({ error: 'book works not yet supported by pull (deferred to book-nav work)' }, { status: 422 })
    }
    const docs = (work.docs as Array<Record<string, unknown>>) || []
    if (!docs.length) return Response.json({ error: 'peer returned no docs' }, { status: 502 })

    // ── Resolve the local host tenant + space + channel ──
    const tRes = await payload.find({ collection: 'tenants', where: { slug: { equals: hostSlug } }, limit: 1, depth: 0, overrideAccess: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tenant = (tRes.docs as any[])[0]
    if (!tenant) return Response.json({ error: `host tenant '${hostSlug}' not on this node` }, { status: 404 })
    const sRes = await payload.find({ collection: 'spaces', where: { tenant: { equals: tenant.id } }, limit: 1, sort: 'createdAt', depth: 0, overrideAccess: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const space = (sRes.docs as any[])[0]
    if (!space) return Response.json({ error: `no space on '${hostSlug}' to host the work channel` }, { status: 409 })
    const channel = `work-${soulId}`

    // ── Idempotent: clear this Work's channel, then recreate from fetched docs ──
    await payload.delete({ collection: 'messages', where: { and: [{ space: { equals: space.id } }, { channel: { equals: channel } }] }, overrideAccess: true })

    let chapters = 0
    for (let i = 0; i < docs.length; i++) {
      const d = docs[i]
      const order = typeof d.order === 'number' ? (d.order as number) : i
      await payload.create({
        collection: 'messages',
        overrideAccess: true,
        data: {
          space: space.id, channel, messageType: 'system', visibility: 'tenant',
          content: { type: 'text', text: String(d.body ?? '') },
          metadata: {
            kind: 'work_chapter', workSlug: soulId, order,
            chapterSlug: d.id ?? null, title: d.title ?? null, date: d.date ?? null,
            description: d.description ?? null, tier: d.tier ?? null,
            badge: d.badge ?? null, badgeColor: d.badgeColor ?? null,
            // Reference media by ABSOLUTE url from the source (subscriber copy).
            image: d.image ?? null,
          },
        },
      })
      chapters++
    }

    // ── Upsert the local works catalog record (preserve source checksum) ──
    const recData = {
      slug: soulId,
      title: work.title ?? soulId,
      subtitle: work.subtitle ?? null,
      description: work.description ?? null,
      type: 'document' as const,
      status: work.status ?? null,
      statusColor: work.statusColor ?? null,
      tags: tagRows(work.tags),
      // canonical home stays the source (SEO authority percolates UP, not to us).
      canonical: (work.canonicalOrigin ? { origin: work.canonicalOrigin } : null) as unknown,
      owner: ownerSlug,
      storageRef: { kind: 'messages', space: space.id, channel },
      checksum: work.checksum ?? '',
      jsonVersion: WORK_JSON_VERSION,
    }
    const existing = await payload.find({ collection: 'works', where: { slug: { equals: soulId } }, limit: 1, depth: 0, overrideAccess: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ex = (existing.docs as any[])[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = recData as any
    if (ex) await payload.update({ collection: 'works', id: ex.id, data, overrideAccess: true })
    else await payload.create({ collection: 'works', data, overrideAccess: true })

    return Response.json({
      ok: true, soul: soulId, from, fromTenant, host: hostSlug,
      space: space.id, channel, chapters,
      checksum: work.checksum ?? '', sourceChecksumPreserved: true,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[works-pull] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Daily Bread — GET /api/works-ops/daily
//
// A deterministic, sequential reading plan over a verse-structured book Work:
// N verses per day (default 3), Genesis 1:1 onward, wrapping at the end of the
// canon. Same date ⇒ same verses on every node and client (see
// utilities/dailyBread.ts — shared with LEO's get_daily_bread tool).
//
//   ?soul=holy-bible   which book work (default holy-bible)
//   ?lang=web|kjv      translation (default: the book's base language)
//   ?date=YYYY-MM-DD   any day's bread (default: today UTC)
//   ?count=1..12       verses per day (default 3)
//
// Auth: none — same "read freely" stance as the rest of the Works surface.
// ─────────────────────────────────────────────────────────────────────────────

export const worksDailyHandler: PayloadHandler = async (req) => {
  const { payload } = req
  try {
    const url = new URL(req.url || '', 'http://localhost')
    const dateParam = url.searchParams.get('date')
    const bread = await getDailyBread({
      soulId: url.searchParams.get('soul') || 'holy-bible',
      lang: url.searchParams.get('lang'),
      date: dateParam,
      count: Number(url.searchParams.get('count') || 3),
      origin: originFromReq(req),
    })

    // Cache until the next UTC midnight (the bread changes at 00:00 UTC).
    const now = new Date()
    const nextMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
    const maxAge = dateParam ? 86_400 : Math.max(60, Math.floor((nextMidnight - now.getTime()) / 1000))

    return Response.json(bread, {
      headers: { 'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=3600` },
    })
  } catch (e) {
    if (e instanceof DailyBreadError) return Response.json({ error: e.message }, { status: e.status })
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[works-daily] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
