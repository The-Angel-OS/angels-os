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
import { loadBookFromPublic } from '@/components/Library/bookManifestServer'

type SoulManifest = ReturnType<typeof getAllSouls>[number]

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

function summarize(soul: SoulManifest) {
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
    cover: coverFor(soul),
    unitCount: isBook ? pageCount : soul.docs?.length ?? 0,
    canonicalOrigin: soul.canonical?.origin ?? null,
  }
}

/** GET /api/works-ops/list */
export const worksListHandler: PayloadHandler = async (req) => {
  const { payload } = req
  try {
    const works = getAllSouls().map(summarize)
    return Response.json({ ok: true, total: works.length, works })
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

  try {
    // ── Book works → manifest + base-language text + inferred chapter slugs ──
    if (soul.bookSlug) {
      const loaded = loadBookFromPublic(soul.bookSlug)
      if (!loaded) return Response.json({ error: 'book manifest missing' }, { status: 404 })
      const pages = loaded.manifest.pages.map((p, i) => ({
        order: p.order,
        image: p.image ?? null,
        title: loaded.pageTitles[i] || p.title || null,
        slug: loaded.pageSlugs[i],
        text: loaded.baseText[String(p.order)] ?? p.markdown ?? '',
      }))
      return Response.json({
        ok: true,
        ...summarize(soul),
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
        image: d.image ?? null,
        body,
      }
    })

    return Response.json({
      ok: true,
      ...summarize(soul),
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
