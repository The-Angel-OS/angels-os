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
import { isWorkAvailable, homeForWork, WORK_SUBSCRIPTIONS } from '@/souls/subscriptions'
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

/**
 * Assemble a DOCUMENT Work's JSON from message-backed chapters (Phase 2).
 * Same response shape as the file path, so the reader is source-agnostic.
 */
async function assembleDocFromMessages(
  req: Parameters<PayloadHandler>[0],
  soul: SoulManifest,
  storage: { space: number; channel: string },
  origin: string,
): Promise<Response> {
  const { payload } = req
  const res = await payload.find({
    collection: 'messages',
    where: { and: [{ space: { equals: storage.space } }, { channel: { equals: storage.channel } }] },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chapters = (res.docs as any[])
    .filter((m) => m.metadata?.kind === 'work_chapter')
    .sort((a, b) => (a.metadata?.order ?? 0) - (b.metadata?.order ?? 0))
  const docs = chapters.map((m) => {
    const md = m.metadata || {}
    const body = typeof m.content === 'string' ? m.content : (m.content?.text ?? '')
    return {
      id: String(md.chapterSlug ?? m.id),
      title: md.title ?? '',
      date: md.date ?? '',
      description: md.description ?? '',
      tier: md.tier ?? 'chapter',
      badge: md.badge ?? null,
      badgeColor: md.badgeColor ?? null,
      image: absMedia(md.image ?? null, origin),
      body,
    }
  })
  const checksum = checksumOf({
    slug: soul.id,
    type: 'document',
    chapters: docs.map((d, i) => ({ order: i, slug: d.id, title: d.title, tier: d.tier, body: d.body })),
  })
  return Response.json({
    ok: true,
    version: WORK_JSON_VERSION,
    checksum,
    source: 'messages',
    ...summarize(soul, origin),
    defaultDoc: soul.defaultDoc,
    links: soul.links ?? [],
    docs,
  })
}

/**
 * Assemble a BOOK Work's JSON from message-backed pages (image by Blob url,
 * base text + per-language translations inline). Same shape as the file path.
 */
async function assembleBookFromMessages(
  req: Parameters<PayloadHandler>[0],
  soul: SoulManifest,
  storage: { space: number; channel: string },
  meta: { baseLanguage?: string; languages?: unknown },
  origin: string,
): Promise<Response> {
  const { payload } = req
  const res = await payload.find({
    collection: 'messages',
    where: { and: [{ space: { equals: storage.space } }, { channel: { equals: storage.channel } }] },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const msgs = (res.docs as any[])
    .filter((m) => m.metadata?.kind === 'work_chapter')
    .sort((a, b) => (a.metadata?.order ?? 0) - (b.metadata?.order ?? 0))
  const pages = msgs.map((m, i) => {
    const md = m.metadata || {}
    return {
      order: md.order ?? i,
      image: absMedia(md.image ?? null, origin),
      title: md.title ?? null,
      slug: md.slug ?? String(i + 1),
      text: typeof m.content === 'string' ? m.content : (m.content?.text ?? ''),
      translations: md.translations ?? {},
    }
  })
  const checksum = checksumOf({
    slug: soul.id,
    type: 'book',
    chapters: pages.map((p, i) => ({ order: i, slug: p.slug, title: p.title, text: p.text })),
  })
  return Response.json({
    ok: true,
    version: WORK_JSON_VERSION,
    checksum,
    source: 'messages',
    ...summarize(soul, origin),
    baseLanguage: meta.baseLanguage ?? 'en',
    languages: meta.languages ?? [],
    pages,
  })
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
    // DB-first: if a works catalog record points at message-backed storage,
    // assemble from messages (book or document). Any miss/error → file source.
    try {
      const wr = await payload.find({ collection: 'works', where: { slug: { equals: soulId } }, limit: 1, depth: 0, overrideAccess: true })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sr = (wr.docs as any[])[0]?.storageRef
      if (sr?.kind === 'messages' && sr.space && sr.channel) {
        const storage = { space: Number(sr.space), channel: String(sr.channel) }
        if (soul.bookSlug) return await assembleBookFromMessages(req, soul, storage, { baseLanguage: sr.baseLanguage, languages: sr.languages }, origin)
        return await assembleDocFromMessages(req, soul, storage, origin)
      }
    } catch {
      /* works table absent / DB hiccup → file fallback below */
    }

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
        source: 'file',
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
      source: 'file',
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

  try {
    const ownerSlug = homeForWork(soulId)
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
    if (!space) return Response.json({ error: `no space on '${ownerSlug}' to host the work channel` }, { status: 409 })
    const channel = `work-${soulId}`
    const origin = originFromReq(req)

    // Idempotent: clear this Work's channel, then recreate.
    await payload.delete({ collection: 'messages', where: { and: [{ space: { equals: space.id } }, { channel: { equals: channel } }] }, overrideAccess: true })

    let chapters = 0
    let checksum = ''
    let imagesUploaded = 0
    const imageErrors: string[] = []
    let storageRef: Record<string, unknown> = { kind: 'messages', space: space.id, channel }
    const type: 'document' | 'book' = soul.bookSlug ? 'book' : 'document'

    if (soul.bookSlug) {
      // ── BOOK → messages + Blob (fully portable, no filesystem at read time) ──
      const loaded = loadBookFromPublic(soul.bookSlug)
      if (!loaded) return Response.json({ error: 'book manifest unreadable' }, { status: 500 })
      const languages = loaded.manifest.languages ?? []
      const langs = languages.map((l) => l.code)
      const baseLang = loaded.baseLanguage

      // Per-language text — fetch from the ORIGIN (CDN-served; non-base langs are
      // not traced into the serverless fs).
      const langText: Record<string, Record<string, string>> = {}
      for (const code of langs) {
        try {
          const r = await fetch(`${origin}/library/${soul.bookSlug}/text/${code}.json`)
          if (r.ok) langText[code] = await r.json()
        } catch { /* skip lang */ }
      }
      langText[baseLang] = langText[baseLang] ?? loaded.baseText

      // Upload each unique page image to media (→ Blob), keyed by image path.
      // fs-first (bundled via outputFileTracingIncludes); self-fetch fallback.
      const urlByImage: Record<string, string> = {}
      for (const p of loaded.manifest.pages) {
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
          // Media is tenant-scoped ("Assigned Tenant") — set the owner tenant
          // explicitly (media has no setTenantFromSpace hook like messages do).
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const media = await payload.create({ collection: 'media', overrideAccess: true, data: { alt: `${soul.title}`, tenant: tenant.id } as any, file: { data: buf, mimetype: 'image/webp', name: basename, size: buf.length } })
          const u = String((media as { url?: string }).url || '')
          urlByImage[p.image] = u
          if (!u) imageErrors.push(`${basename}: media.url empty`)
        } catch (e) { imageErrors.push(`${basename}: ${e instanceof Error ? e.message : String(e)}`) }
      }
      imagesUploaded = Object.values(urlByImage).filter(Boolean).length

      // One message per page. Image is referenced by metadata url (NOT an
      // attachment) so the media-analysis/workflow hooks stay no-op.
      for (let i = 0; i < loaded.manifest.pages.length; i++) {
        const p = loaded.manifest.pages[i]
        const ord = String(p.order)
        const translations: Record<string, string> = {}
        for (const code of langs) translations[code] = langText[code]?.[ord] ?? ''
        await payload.create({
          collection: 'messages',
          overrideAccess: true,
          data: {
            space: space.id, channel, messageType: 'system', visibility: 'tenant',
            content: { type: 'text', text: translations[baseLang] ?? '' },
            metadata: {
              kind: 'work_chapter', workSlug: soul.id, order: i,
              slug: loaded.pageSlugs[i], title: loaded.pageTitles[i] || null,
              image: p.image ? (urlByImage[p.image] ?? null) : null,
              translations,
            },
          },
        })
        chapters++
      }
      storageRef = { kind: 'messages', space: space.id, channel, baseLanguage: baseLang, languages }
      checksum = checksumOf({
        slug: soul.id, type: 'book',
        chapters: loaded.manifest.pages.map((p, i) => ({ order: i, slug: loaded.pageSlugs[i], title: loaded.pageTitles[i], text: langText[baseLang]?.[String(p.order)] ?? '' })),
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

    const sub = WORK_SUBSCRIPTIONS[soulId]
    const recData = {
      slug: soul.id, title: soul.title, subtitle: soul.subtitle, description: soul.description,
      type, status: soul.status, statusColor: soul.statusColor,
      tags: soul.tags ?? [], canonical: soul.canonical ?? null,
      owner: ownerSlug, subscribers: sub?.subscribers ?? [],
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

    return Response.json({ ok: true, soul: soulId, type, owner: ownerSlug, space: space.id, channel, chapters, checksum, imagesUploaded, imageErrors: imageErrors.slice(0, 5) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[works-import] ${msg}`)
    return Response.json({ error: msg }, { status: 500 })
  }
}
