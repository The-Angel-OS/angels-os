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
import { getAllSouls, getSoul } from '@/souls'
import { isWorkAvailable, homeForWork, WORK_SUBSCRIPTIONS } from '@/souls/subscriptions'
import { loadBookFromPublic } from '@/components/Library/bookManifestServer'
// Single source of truth for assembly + the portable-JSON helpers (shared with
// the web readers) — so the content checksum can never drift between surfaces.
import { getWorkJson, absMedia, checksumOf, WORK_JSON_VERSION } from '@/utilities/getWorkJson'

type SoulManifest = ReturnType<typeof getAllSouls>[number]

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
function listSummary(soul: SoulManifest, origin: string, dbInfo?: { cover: string | null; unitCount: number }) {
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
    home: homeForWork(soul.id),
  }
}

/** GET /api/works-ops/list */
export const worksListHandler: PayloadHandler = async (req) => {
  const { payload } = req
  try {
    const tenantSlug = await resolveTenantSlug(req)
    const origin = originFromReq(req)
    const souls = getAllSouls().filter((s) => isWorkAvailable(s.id, tenantSlug))

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

  const soul = getSoul(soulId)
  if (!soul) return Response.json({ error: 'work not found' }, { status: 404 })

  // Lockdown: a Work not subscribed to this tenant is not readable here.
  const tenantSlug = await resolveTenantSlug(req)
  if (!isWorkAvailable(soulId, tenantSlug)) {
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
    if (!space) return Response.json({ error: `no space on '${hostSlug}' to host the work channel` }, { status: 409 })
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
