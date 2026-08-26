/**
 * getWorkJson — assemble a Work's JSON from the DB (works catalog record +
 * its chapters). The single source of truth for BOTH the works-ops API and the
 * web /learn readers, so neither touches the filesystem.
 *
 * Chapters come from the `work-chapters` collection. Works whose chapters have
 * not been moved yet fall back to the old message rows, so the reader keeps
 * reading either side of the migration and a rollback needs no code change.
 *
 * Returns null when the Work has no chapters in this node's DB (after file
 * deletion, null simply means "not here").
 *
 * Media is referenced by absolute URL (portable). The checksum is the content
 * address (url-independent) — see docs/planning/WORKS_AS_JSON.md.
 */
import crypto from 'crypto'
import type { Payload } from 'payload'
import { getWork, isWorkAvailable } from '@/works/registry'

export const WORK_JSON_VERSION = 'work.v1'

export function absMedia(url: string | null | undefined, origin: string): string | null {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  if (!origin) return url
  return `${origin}${url.startsWith('/') ? url : `/${url}`}`
}

export function checksumOf(normalized: unknown): string {
  return 'sha256:' + crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}

/** Render a verse-structured translation ({v,t}[]) to verse-numbered markdown. */
function renderVerses(val: unknown): string {
  if (!Array.isArray(val)) return ''
  return (val as Array<{ v?: number; t?: string }>)
    .filter((x) => x && typeof x.t === 'string')
    .map((x) => `**${x.v ?? ''}** ${x.t}`)
    .join('\n\n')
}

interface SoulLike {
  id: string
  rowId?: number
  owner: string
  title: string
  subtitle: string
  description: string
  status: string
  statusColor: string
  tags?: string[]
  defaultDoc?: string
  links?: { label: string; url: string }[]
  bookSlug?: string
  canonical?: { origin?: string }
}

function summarize(soul: SoulLike, origin: string, cover: string | null) {
  return {
    id: soul.id,
    title: soul.title,
    subtitle: soul.subtitle,
    description: soul.description,
    status: soul.status,
    statusColor: soul.statusColor,
    tags: soul.tags ?? [],
    type: soul.bookSlug ? 'book' : 'document',
    cover: absMedia(cover, origin),
    canonicalOrigin: soul.canonical?.origin ?? null,
    home: soul.owner,
  }
}

/** One chapter, normalized — the shape both storages are read INTO. */
interface Chapter {
  id: string
  order: number
  slug: string | null
  title: string | null
  body: string
  image: string | null
  tier: string | null
  badge: string | null
  badgeColor: string | null
  date: string | null
  description: string | null
  book: string | null
  bookName: string | null
  chapter: number | null
  ref: string | null
  translations: Record<string, unknown>
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/** `work-chapters` rows — the storage of record. */
async function chaptersFromRows(
  payload: Payload,
  workRowId: number,
  range?: { from: number; to: number },
): Promise<Chapter[]> {
  const where: Record<string, unknown> = { work: { equals: workRowId } }
  if (range) {
    // The prize: a windowed read. `order` is a COLUMN now, so serving one page of
    // a 1,189-chapter book no longer reads the whole book.
    where.and = [{ order: { greater_than_equal: range.from } }, { order: { less_than: range.to } }]
  }
  const res = await payload.find({
    collection: 'work-chapters',
    where: where as never,
    sort: 'order',
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  return (res.docs as unknown as Array<Record<string, unknown>>).map((r, i) => ({
    id: String(r.slug ?? r.id),
    order: typeof r.order === 'number' ? r.order : Number(r.order) || i,
    slug: str(r.slug),
    title: str(r.title),
    body: typeof r.body === 'string' ? r.body : '',
    image: str(r.image),
    tier: str(r.tier),
    badge: str(r.badge),
    badgeColor: str(r.badgeColor),
    date: str(r.date),
    description: str(r.description),
    book: str(r.book),
    bookName: str(r.bookName),
    chapter: typeof r.chapter === 'number' ? r.chapter : null,
    ref: str(r.ref),
    translations: (r.translations as Record<string, unknown>) ?? {},
  }))
}

/**
 * The old storage: `messages` rows with `metadata.kind = 'work_chapter'`. Kept so
 * a Work whose chapters have not moved (or a rolled-back deploy) still reads.
 */
async function chaptersFromMessages(
  payload: Payload,
  sr: { space?: number; channel?: string },
): Promise<Chapter[]> {
  const res = await payload.find({
    collection: 'messages',
    where: { and: [{ space: { equals: Number(sr.space) } }, { channel: { equals: String(sr.channel) } }] },
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  return (res.docs as unknown as Array<Record<string, unknown>>)
    .map((m) => ({ m, md: (m.metadata as Record<string, unknown>) || {} }))
    .filter((x) => x.md.kind === 'work_chapter')
    .sort((a, b) => ((a.md.order as number) ?? 0) - ((b.md.order as number) ?? 0))
    .map(({ m, md }, i) => ({
      id: String(md.chapterSlug ?? md.slug ?? m.id),
      order: typeof md.order === 'number' ? md.order : i,
      slug: str(md.chapterSlug) ?? str(md.slug),
      title: str(md.title),
      body: typeof m.content === 'string' ? m.content : ((m.content as { text?: string })?.text ?? ''),
      image: str(md.image),
      tier: str(md.tier),
      badge: str(md.badge),
      badgeColor: str(md.badgeColor),
      date: str(md.date),
      description: str(md.description),
      book: str(md.book),
      bookName: str(md.bookName),
      chapter: typeof md.chapter === 'number' ? md.chapter : null,
      ref: str(md.ref),
      translations: (md.translations as Record<string, unknown>) ?? {},
    }))
}

export interface WorkJsonResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

/**
 * Assemble the Work JSON for `soulId` scoped to `tenantSlug`. Returns null if the
 * Work is unavailable to the tenant OR has no chapters in this DB.
 *
 * `range` (books) reads only chapters `from <= order < to`. A ranged result is a
 * WINDOW, not the Work — its `checksum` is empty and `unitCount` is the window's
 * size, so never checksum or gossip one.
 */
export async function getWorkJson(opts: {
  payload: Payload
  soulId: string
  tenantSlug?: string | null
  origin: string
  range?: { from: number; to: number }
}): Promise<WorkJsonResult | null> {
  const { payload, soulId, tenantSlug, origin, range } = opts
  const work = await getWork(soulId)
  if (!work) return null
  if (!isWorkAvailable(work, tenantSlug)) return null
  const soul = work as unknown as SoulLike

  const sr = work.storageRef
  let chapters: Chapter[] = []
  if (soul.rowId) chapters = await chaptersFromRows(payload, soul.rowId, range)
  if (!chapters.length && sr?.space && sr?.channel) chapters = await chaptersFromMessages(payload, sr)
  if (!chapters.length) return null

  const coverFromChapters = chapters.find((c) => c.image)?.image ?? null

  if (soul.bookSlug) {
    const baseLang = String(sr?.baseLanguage ?? 'en')
    const pages = chapters.map((c, i) => ({
      order: c.order ?? i,
      image: absMedia(c.image, origin),
      title: c.title,
      slug: c.slug ?? String(i + 1),
      // Book hierarchy (collection-of-books works like the Bible). Null on flat
      // single-book works; the reader only builds Book → Chapter nav when present.
      book: c.book,
      bookName: c.bookName,
      chapter: c.chapter,
      ref: c.ref,
      // Verse-structured chapters (scripture) store their text as {v,t}[] in
      // `translations`, leaving the body empty — render the base language to
      // markdown so thin clients always get a readable `text`.
      text: c.body || renderVerses(c.translations[baseLang]),
      translations: c.translations,
    }))
    const checksum = range
      ? ''
      : checksumOf({ slug: soul.id, type: 'book', chapters: pages.map((p, i) => ({ order: i, slug: p.slug, title: p.title, text: p.text })) })
    return {
      ok: true, version: WORK_JSON_VERSION, checksum, source: 'rows',
      ...summarize(soul, origin, coverFromChapters),
      unitCount: pages.length,
      baseLanguage: sr?.baseLanguage ?? 'en',
      languages: sr?.languages ?? [],
      pages,
    }
  }

  const docs = chapters.map((c, i) => ({
    id: c.id,
    title: c.title ?? '',
    date: c.date ?? '',
    description: c.description ?? '',
    tier: c.tier ?? 'chapter',
    badge: c.badge,
    badgeColor: c.badgeColor,
    image: absMedia(c.image, origin),
    body: c.body,
    order: i,
  }))
  const checksum = checksumOf({ slug: soul.id, type: 'document', chapters: docs.map((d, i) => ({ order: i, slug: d.id, title: d.title, tier: d.tier, body: d.body })) })
  return {
    ok: true, version: WORK_JSON_VERSION, checksum, source: 'rows',
    ...summarize(soul, origin, coverFromChapters),
    unitCount: docs.length,
    defaultDoc: soul.defaultDoc,
    links: soul.links ?? [],
    docs,
  }
}
