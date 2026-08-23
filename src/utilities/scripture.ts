/**
 * scripture.ts — resolve a Bible reference against the canonical Holy Bible Work.
 *
 * One door of three (reader · [[ref]] resolver · LEO lookup) over the same
 * verse-addressed source. Reads the per-book JSON via a BUNDLED dynamic import
 * (no fs at runtime — the data ships in the chunk, lazy-loaded per book), so it
 * honors the "release = 0 filesystem artifacts" rule. When the Bible content
 * migrates into Payload storage, only `loadBook()` changes.
 *
 * @see public/library/holy-bible/ (manifest.json + text/<lang>.json), built by
 * scripts/ingest-bible.mjs. The verses of record are DB rows: the messages of the
 * `work-holy-bible` channel.
 */

export type Translation = 'web' | 'kjv'

/** Normalized book-name / abbreviation → OSIS code. */
const BOOK_CODES: Record<string, string> = (() => {
  const rows: Array<[string, string[]]> = [
    ['GEN', ['genesis', 'gen', 'gn']], ['EXO', ['exodus', 'exo', 'ex']],
    ['LEV', ['leviticus', 'lev', 'lv']], ['NUM', ['numbers', 'num', 'nm']],
    ['DEU', ['deuteronomy', 'deut', 'deu', 'dt']], ['JOS', ['joshua', 'josh', 'jos']],
    ['JDG', ['judges', 'judg', 'jdg']], ['RUT', ['ruth', 'rut', 'ru']],
    ['1SA', ['1 samuel', '1samuel', '1 sam', '1sa', 'i samuel']], ['2SA', ['2 samuel', '2samuel', '2 sam', '2sa', 'ii samuel']],
    ['1KI', ['1 kings', '1kings', '1 kgs', '1ki', 'i kings']], ['2KI', ['2 kings', '2kings', '2 kgs', '2ki', 'ii kings']],
    ['1CH', ['1 chronicles', '1chronicles', '1 chr', '1ch']], ['2CH', ['2 chronicles', '2chronicles', '2 chr', '2ch']],
    ['EZR', ['ezra', 'ezr']], ['NEH', ['nehemiah', 'neh']], ['EST', ['esther', 'est']],
    ['JOB', ['job']], ['PSA', ['psalms', 'psalm', 'ps', 'psa']], ['PRO', ['proverbs', 'prov', 'pro', 'pr']],
    ['ECC', ['ecclesiastes', 'eccl', 'ecc', 'qoheleth']], ['SNG', ['song of solomon', 'song of songs', 'song', 'canticles', 'sng', 'sos']],
    ['ISA', ['isaiah', 'isa', 'is']], ['JER', ['jeremiah', 'jer']], ['LAM', ['lamentations', 'lam']],
    ['EZK', ['ezekiel', 'ezek', 'ezk']], ['DAN', ['daniel', 'dan']], ['HOS', ['hosea', 'hos']],
    ['JOL', ['joel', 'joe', 'jol']], ['AMO', ['amos', 'amo']], ['OBA', ['obadiah', 'obad', 'oba']],
    ['JON', ['jonah', 'jon']], ['MIC', ['micah', 'mic']], ['NAM', ['nahum', 'nah', 'nam']],
    ['HAB', ['habakkuk', 'hab']], ['ZEP', ['zephaniah', 'zeph', 'zep']], ['HAG', ['haggai', 'hag']],
    ['ZEC', ['zechariah', 'zech', 'zec']], ['MAL', ['malachi', 'mal']],
    ['MAT', ['matthew', 'matt', 'mat', 'mt']], ['MRK', ['mark', 'mrk', 'mk']],
    ['LUK', ['luke', 'luk', 'lk']], ['JHN', ['john', 'jhn', 'jn']],
    ['ACT', ['acts', 'act']], ['ROM', ['romans', 'rom', 'rm']],
    ['1CO', ['1 corinthians', '1corinthians', '1 cor', '1co']], ['2CO', ['2 corinthians', '2corinthians', '2 cor', '2co']],
    ['GAL', ['galatians', 'gal']], ['EPH', ['ephesians', 'eph']],
    ['PHP', ['philippians', 'phil', 'php']], ['COL', ['colossians', 'col']],
    ['1TH', ['1 thessalonians', '1thessalonians', '1 thess', '1th']], ['2TH', ['2 thessalonians', '2thessalonians', '2 thess', '2th']],
    ['1TI', ['1 timothy', '1timothy', '1 tim', '1ti']], ['2TI', ['2 timothy', '2timothy', '2 tim', '2ti']],
    ['TIT', ['titus', 'tit']], ['PHM', ['philemon', 'phlm', 'phm']],
    ['HEB', ['hebrews', 'heb']], ['JAS', ['james', 'jas', 'jm']],
    ['1PE', ['1 peter', '1peter', '1 pet', '1pe']], ['2PE', ['2 peter', '2peter', '2 pet', '2pe']],
    ['1JN', ['1 john', '1john', '1 jn', '1jn']], ['2JN', ['2 john', '2john', '2 jn', '2jn']],
    ['3JN', ['3 john', '3john', '3 jn', '3jn']], ['JUD', ['jude', 'jud']],
    ['REV', ['revelation', 'revelations', 'rev', 'apocalypse']],
  ]
  const m: Record<string, string> = {}
  for (const [code, names] of rows) {
    m[code.toLowerCase()] = code
    for (const n of names) m[n] = code
  }
  return m
})()

const normBook = (s: string): string =>
  s.toLowerCase().replace(/^(i{1,3})\s+/, (_, r) => `${r.length} `).replace(/\./g, '').replace(/\s+/g, ' ').trim()

export interface ParsedRef {
  code: string
  bookName: string
  chapter: number
  verseStart?: number
  verseEnd?: number
}

/** Parse "John 3:16", "Philemon 1:6", "Romans 8:28-30", "Psalm 23", "1 John 4:8". */
export function parseReference(input: string): ParsedRef | null {
  const ref = (input || '').trim()
  // book (may lead with a digit), chapter, optional :verse(-verse)
  const m = ref.match(/^([1-3]?\s?[A-Za-z. ]+?)\s*(\d+)(?::(\d+)(?:\s*[-–]\s*(\d+))?)?\s*$/)
  if (!m) return null
  const code = BOOK_CODES[normBook(m[1])]
  if (!code) return null
  const chapter = Number(m[2])
  if (!Number.isFinite(chapter) || chapter < 1) return null
  const verseStart = m[3] ? Number(m[3]) : undefined
  const verseEnd = m[4] ? Number(m[4]) : undefined
  return { code, bookName: m[1].trim(), chapter, verseStart, verseEnd }
}

// Source verses from the reader's CDN-served library (manifest + per-language text),
// the SAME reliable path Daily Bread uses. A bundled dynamic import of the per-book
// JSON is NOT traced into the Vercel serverless function (nested dynamic + variable
// path), so it returned null in prod and BOTH scripture tools silently failed. The
// manifest maps a "PSA.32" ref → page order; each text file is page-keyed arrays of
// { v, t }. Pure fetch — no fs, no bundled import — so this stays client-safe.
type ManifestPage = { order: number; ref?: string; book?: string; bookName?: string; chapter?: number }
type LibText = Record<string, Array<{ v: number; t: string }>>

const _cache: { manifest?: ManifestPage[]; text: Record<string, LibText> } = { text: {} }

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { headers: { accept: 'application/json' } })
    return r.ok ? ((await r.json()) as T) : null
  } catch {
    return null
  }
}

async function loadManifestPages(base: string): Promise<ManifestPage[] | null> {
  if (_cache.manifest) return _cache.manifest
  const m = await fetchJson<{ pages?: ManifestPage[] }>(`${base}/library/holy-bible/manifest.json`)
  if (m?.pages?.length) return (_cache.manifest = m.pages)
  return null
}

async function loadText(base: string, transFile: string): Promise<LibText | null> {
  if (_cache.text[transFile]) return _cache.text[transFile]
  const t = await fetchJson<LibText>(`${base}/library/holy-bible/text/${transFile}.json`)
  if (t) return (_cache.text[transFile] = t)
  return null
}

export interface ScriptureResult {
  ok: boolean
  reference?: string
  translation?: Translation
  verses?: Array<{ v: number; t: string }>
  text?: string
  truncated?: boolean
  error?: string
}

const MAX_VERSES = 60

/** Resolve a reference to verse text in the requested translation. */
export async function lookupScripture(
  input: string,
  translation: Translation = 'web',
  origin: string = process.env.NEXT_PUBLIC_SERVER_URL || '',
): Promise<ScriptureResult> {
  const parsed = parseReference(input)
  if (!parsed) return { ok: false, error: `Could not parse the reference "${input}". Try "John 3:16" or "Psalm 23".` }

  const base = origin.replace(/\/+$/, '')
  if (!base) return { ok: false, error: 'Scripture source is not configured.' }

  const pages = await loadManifestPages(base)
  if (!pages) return { ok: false, error: 'The scripture library is unavailable right now.' }
  const page = pages.find((p) => p.ref === `${parsed.code}.${parsed.chapter}`)
  if (!page) return { ok: false, error: `${parsed.bookName} has no chapter ${parsed.chapter}.` }

  const text = await loadText(base, translation === 'kjv' ? 'kjv' : 'web')
  if (!text) return { ok: false, error: 'The scripture text is unavailable right now.' }
  const chapterVerses = text[String(page.order)]
  if (!Array.isArray(chapterVerses) || chapterVerses.length === 0) {
    return { ok: false, error: `No text available for ${parsed.bookName} ${parsed.chapter}.` }
  }

  let verses = chapterVerses
  if (parsed.verseStart != null) {
    const end = parsed.verseEnd ?? parsed.verseStart
    verses = verses.filter((vr) => vr.v >= parsed.verseStart! && vr.v <= end)
    if (verses.length === 0) return { ok: false, error: `${parsed.bookName} ${parsed.chapter} has no verse ${parsed.verseStart}.` }
  }

  const bookName = page.bookName || parsed.bookName
  const truncated = verses.length > MAX_VERSES
  const out = (truncated ? verses.slice(0, MAX_VERSES) : verses).map((vr) => ({ v: vr.v, t: vr.t }))

  const refLabel =
    parsed.verseStart != null
      ? `${bookName} ${parsed.chapter}:${parsed.verseStart}${parsed.verseEnd && parsed.verseEnd !== parsed.verseStart ? `-${parsed.verseEnd}` : ''}`
      : `${bookName} ${parsed.chapter}`

  const text2 = out.map((vr) => `${vr.v} ${vr.t}`).join(' ')
  return { ok: true, reference: refLabel, translation, verses: out, text: text2, truncated }
}
