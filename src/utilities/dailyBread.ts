/**
 * dailyBread — the deterministic N-verses-a-day reading plan over a
 * verse-structured book Work (the Bible today; any scripture-style Work later).
 *
 * Sequential through the canon from a fixed epoch, wrapping at the end.
 * Everything derives from the canonical manifest + text files (the same
 * CDN-served statics the reader and importer use), so ANY node or client that
 * asks for the same date gets the SAME verses — no DB, no config, no state.
 *
 * Single source of truth for both GET /api/works-ops/daily and LEO's
 * get_daily_bread tool.
 */
import { getWork } from '@/works/registry'
import { loadBookFromPublic, loadBookFromOrigin } from '@/components/Library/bookManifestServer'

/** Day 1 of the plan. Fixed forever — changing it changes everyone's bread. */
export const DAILY_BREAD_EPOCH_UTC = Date.UTC(2026, 0, 1) // 2026-01-01

interface VerseEntry { v: number; t: string }

export interface DailyBreadVerse extends VerseEntry {
  ref: string | null
  book: string | null
  bookName: string | null
  chapter: number | null
  pageOrder: number
}

export interface DailyBread {
  ok: true
  version: 'daily.v1'
  soul: string
  translation: string
  date: string
  dayNumber: number
  count: number
  /** Human display, e.g. "Genesis 1:1–3". */
  ref: string
  verses: DailyBreadVerse[]
  /** Deep-link target for "read the whole chapter" in any reader client. `ref`
   *  (e.g. "GEN.22") is the stable key — `order` differs by source (manifest is
   *  1-based, the message-backed reader JSON is 0-based), so clients resolve by
   *  ref and only fall back to order. */
  page: { order: number; title: string | null; ref: string | null } | null
  progress: { totalVerses: number; percent: number }
}

export class DailyBreadError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/**
 * Compute the bread for a date. `origin` is the serving origin used for the
 * CDN fallback when `public/` isn't on the local filesystem (Vercel functions).
 * Throws DailyBreadError with an HTTP-ish status on any unavailability.
 */
export async function getDailyBread(opts: {
  soulId?: string
  lang?: string | null
  /** YYYY-MM-DD; defaults to today UTC. */
  date?: string | null
  count?: number
  origin: string
}): Promise<DailyBread> {
  const soulId = opts.soulId || 'holy-bible'
  const countRaw = Number(opts.count ?? 3)
  const count = Number.isFinite(countRaw) ? Math.min(12, Math.max(1, Math.floor(countRaw))) : 3

  const soul = await getWork(soulId)
  if (!soul?.bookSlug) throw new DailyBreadError(`'${soulId}' is not a book work`, 404)

  const loaded = loadBookFromPublic(soul.bookSlug) ?? (await loadBookFromOrigin(soul.bookSlug, opts.origin))
  if (!loaded) throw new DailyBreadError('book manifest unreadable', 503)

  // Resolve the translation text: base language ships with the manifest load;
  // any other edition is a CDN fetch (same path the importer uses).
  let lang = loaded.baseLanguage
  let text: Record<string, unknown> = loaded.baseText
  if (opts.lang && opts.lang !== loaded.baseLanguage) {
    try {
      const r = await fetch(`${opts.origin}/library/${soul.bookSlug}/text/${opts.lang}.json`, { headers: { accept: 'application/json' } })
      if (r.ok) { text = (await r.json()) as Record<string, unknown>; lang = opts.lang }
    } catch { /* fall back to base language */ }
  }

  // The plan's day number. Explicit date must be YYYY-MM-DD; else today UTC.
  let dayMs = Date.now()
  if (opts.date) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(opts.date)
    if (!m) throw new DailyBreadError('date must be YYYY-MM-DD', 400)
    dayMs = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }
  const dayNumber = Math.floor((dayMs - DAILY_BREAD_EPOCH_UTC) / 86_400_000)

  // Walk the canonical page order once, collecting verse counts. Pages whose
  // text is missing (partial ingest) contribute zero and are skipped.
  const pages = loaded.manifest.pages || []
  type PageVerses = { page: (typeof pages)[number]; verses: VerseEntry[] }
  const versed: PageVerses[] = []
  let totalVerses = 0
  for (const p of pages) {
    const arr = text[String(p.order)]
    if (Array.isArray(arr) && arr.length) {
      versed.push({ page: p, verses: arr as VerseEntry[] })
      totalVerses += arr.length
    }
  }
  if (!totalVerses) throw new DailyBreadError('no verse text available', 503)

  // Sequential plan with wrap-around: day N serves global verses
  // [N*count, N*count+count). Negative days (pre-epoch dates) wrap backwards.
  const start = ((dayNumber * count) % totalVerses + totalVerses) % totalVerses
  const picked: DailyBreadVerse[] = []
  let cursor = 0
  for (let pi = 0; pi < versed.length && picked.length < count; pi++) {
    const { page, verses } = versed[pi]
    if (cursor + verses.length <= start && picked.length === 0) { cursor += verses.length; continue }
    const from = picked.length === 0 ? start - cursor : 0
    const ph = page as typeof page & { book?: string; bookName?: string; chapter?: number; ref?: string }
    for (let vi = from; vi < verses.length && picked.length < count; vi++) {
      picked.push({
        ...verses[vi],
        ref: ph.ref ?? null, book: ph.book ?? null, bookName: ph.bookName ?? null,
        chapter: typeof ph.chapter === 'number' ? ph.chapter : null,
        pageOrder: page.order,
      })
    }
    cursor += verses.length
    // Wrap: if we started near the end of the canon, continue from Genesis.
    if (pi === versed.length - 1 && picked.length < count) pi = -1
  }

  const first = picked[0]
  const last = picked[picked.length - 1]
  const sameChapter = first && last && first.ref === last.ref
  const refDisplay = first
    ? sameChapter
      ? `${first.bookName ?? ''} ${first.chapter ?? ''}:${first.v}${last.v !== first.v ? `–${last.v}` : ''}`.trim()
      : `${first.bookName ?? ''} ${first.chapter ?? ''}:${first.v} – ${last.bookName ?? ''} ${last.chapter ?? ''}:${last.v}`.trim()
    : ''

  const firstPage = first ? versed.find((x) => x.page.order === first.pageOrder)?.page : null

  return {
    ok: true, version: 'daily.v1', soul: soulId, translation: lang,
    date: new Date(dayMs).toISOString().slice(0, 10), dayNumber, count,
    ref: refDisplay,
    verses: picked,
    page: firstPage ? { order: firstPage.order, title: firstPage.title ?? null, ref: first?.ref ?? null } : null,
    progress: { totalVerses, percent: Math.round(((start + picked.length) / totalVerses) * 1000) / 10 },
  }
}
