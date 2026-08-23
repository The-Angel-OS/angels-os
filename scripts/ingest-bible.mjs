/**
 * ingest-bible.mjs — build the canonical Holy Bible Work from public-domain text.
 *
 * The factory, not the prototype: fetches public-domain scripture (WEB + KJV) from
 * bible-api.com and writes, per book:
 *   src/souls/holy-bible/data/<CODE>.json   — verse-addressed, BOTH translations
 *     (intermediate only — not committed; re-fetched by running this script)
 *                                              (the durable source of record)
 *   docs/vision/holy-bible/<code>-<ch>.md    — one markdown doc PER CHAPTER (= a
 *                                              reader page; WEB rendered, verse-
 *                                              numbered) so it renders in the
 *                                              existing document reader today
 * then rebuilds:
 *   src/souls/holy-bible/index.generated.json — ordered chapter list (manifest docs)
 *
 * Usage:
 *   node scripts/ingest-bible.mjs            # default: PHM (schema-first proof)
 *   node scripts/ingest-bible.mjs JHN ROM    # specific books
 *   node scripts/ingest-bible.mjs ALL        # full 66-book ingest
 *
 * Re-runnable: the index is rebuilt from whatever data/*.json exist, in canonical
 * order, so adding books later just adds their files and re-indexes.
 */
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
// Source of record: per-book verse JSON with BOTH translations inline.
const DATA_DIR = resolve(ROOT, 'src/souls/holy-bible/data')
// Reader-consumed book (Ronald's WDEG format): manifest + one text file PER edition.
// A translation is just another language file — text/web.json, text/kjv.json, …
const BOOK_DIR = resolve(ROOT, 'public/library/holy-bible')
const TEXT_DIR = resolve(BOOK_DIR, 'text')
const API = 'https://bible-api.com'

// Canonical 66-book table: OSIS code, display name, API query name, chapter count,
// testament. Order here IS the canonical reading order (Genesis → Revelation).
const BOOKS = [
  ['GEN', 'Genesis', 'genesis', 50, 'OT'], ['EXO', 'Exodus', 'exodus', 40, 'OT'],
  ['LEV', 'Leviticus', 'leviticus', 27, 'OT'], ['NUM', 'Numbers', 'numbers', 36, 'OT'],
  ['DEU', 'Deuteronomy', 'deuteronomy', 34, 'OT'], ['JOS', 'Joshua', 'joshua', 24, 'OT'],
  ['JDG', 'Judges', 'judges', 21, 'OT'], ['RUT', 'Ruth', 'ruth', 4, 'OT'],
  ['1SA', '1 Samuel', '1 samuel', 31, 'OT'], ['2SA', '2 Samuel', '2 samuel', 24, 'OT'],
  ['1KI', '1 Kings', '1 kings', 22, 'OT'], ['2KI', '2 Kings', '2 kings', 25, 'OT'],
  ['1CH', '1 Chronicles', '1 chronicles', 29, 'OT'], ['2CH', '2 Chronicles', '2 chronicles', 36, 'OT'],
  ['EZR', 'Ezra', 'ezra', 10, 'OT'], ['NEH', 'Nehemiah', 'nehemiah', 13, 'OT'],
  ['EST', 'Esther', 'esther', 10, 'OT'], ['JOB', 'Job', 'job', 42, 'OT'],
  ['PSA', 'Psalms', 'psalms', 150, 'OT'], ['PRO', 'Proverbs', 'proverbs', 31, 'OT'],
  ['ECC', 'Ecclesiastes', 'ecclesiastes', 12, 'OT'], ['SNG', 'Song of Solomon', 'song of solomon', 8, 'OT'],
  ['ISA', 'Isaiah', 'isaiah', 66, 'OT'], ['JER', 'Jeremiah', 'jeremiah', 52, 'OT'],
  ['LAM', 'Lamentations', 'lamentations', 5, 'OT'], ['EZK', 'Ezekiel', 'ezekiel', 48, 'OT'],
  ['DAN', 'Daniel', 'daniel', 12, 'OT'], ['HOS', 'Hosea', 'hosea', 14, 'OT'],
  ['JOL', 'Joel', 'joel', 3, 'OT'], ['AMO', 'Amos', 'amos', 9, 'OT'],
  ['OBA', 'Obadiah', 'obadiah', 1, 'OT', 21], ['JON', 'Jonah', 'jonah', 4, 'OT'],
  ['MIC', 'Micah', 'micah', 7, 'OT'], ['NAM', 'Nahum', 'nahum', 3, 'OT'],
  ['HAB', 'Habakkuk', 'habakkuk', 3, 'OT'], ['ZEP', 'Zephaniah', 'zephaniah', 3, 'OT'],
  ['HAG', 'Haggai', 'haggai', 2, 'OT'], ['ZEC', 'Zechariah', 'zechariah', 14, 'OT'],
  ['MAL', 'Malachi', 'malachi', 4, 'OT'],
  ['MAT', 'Matthew', 'matthew', 28, 'NT'], ['MRK', 'Mark', 'mark', 16, 'NT'],
  ['LUK', 'Luke', 'luke', 24, 'NT'], ['JHN', 'John', 'john', 21, 'NT'],
  ['ACT', 'Acts', 'acts', 28, 'NT'], ['ROM', 'Romans', 'romans', 16, 'NT'],
  ['1CO', '1 Corinthians', '1 corinthians', 16, 'NT'], ['2CO', '2 Corinthians', '2 corinthians', 13, 'NT'],
  ['GAL', 'Galatians', 'galatians', 6, 'NT'], ['EPH', 'Ephesians', 'ephesians', 6, 'NT'],
  ['PHP', 'Philippians', 'philippians', 4, 'NT'], ['COL', 'Colossians', 'colossians', 4, 'NT'],
  ['1TH', '1 Thessalonians', '1 thessalonians', 5, 'NT'], ['2TH', '2 Thessalonians', '2 thessalonians', 3, 'NT'],
  ['1TI', '1 Timothy', '1 timothy', 6, 'NT'], ['2TI', '2 Timothy', '2 timothy', 4, 'NT'],
  ['TIT', 'Titus', 'titus', 3, 'NT'], ['PHM', 'Philemon', 'philemon', 1, 'NT', 25],
  ['HEB', 'Hebrews', 'hebrews', 13, 'NT'], ['JAS', 'James', 'james', 5, 'NT'],
  ['1PE', '1 Peter', '1 peter', 5, 'NT'], ['2PE', '2 Peter', '2 peter', 3, 'NT'],
  ['1JN', '1 John', '1 john', 5, 'NT'], ['2JN', '2 John', '2 john', 1, 'NT', 13],
  ['3JN', '3 John', '3 john', 1, 'NT', 14], ['JUD', 'Jude', 'jude', 1, 'NT', 25],
  ['REV', 'Revelation', 'revelation', 22, 'NT'],
].map(([code, name, query, chapters, testament, soleVerses]) => ({ code, name, query, chapters, testament, soleVerses }))

const CODE_ORDER = BOOKS.map((b) => b.code)
const TMP = resolve(ROOT, '.bible-tmp')
const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim()

// Bulk public-domain source: the WHOLE translation in ONE request (no per-chapter
// rate-limiting). getBible v2 — 66 books in canonical order, {chapter,verse,text}.
async function loadBulk(translation) {
  const file = resolve(TMP, `${translation}.json`)
  let raw
  try {
    raw = await readFile(file, 'utf-8')
  } catch {
    const url = `https://api.getbible.net/v2/${translation}.json`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`bulk fetch failed (${res.status}): ${url}`)
    raw = await res.text()
    await mkdir(TMP, { recursive: true })
    await writeFile(file, raw, 'utf-8')
  }
  return JSON.parse(raw).books // [{ nr, name, chapters:[{chapter, verses:[{verse,text}]}] }]
}

/** Build a book's verse JSON (both translations) by slicing the bulk arrays. */
function extractBook(book, webBooks, kjvBooks) {
  const idx = CODE_ORDER.indexOf(book.code) // bulk is canonical order → same index
  const wb = webBooks[idx]
  const kb = kjvBooks[idx]
  const chapters = (wb?.chapters || []).map((wc) => {
    const kjvByV = new Map(
      (kb?.chapters?.find((c) => c.chapter === wc.chapter)?.verses || []).map((v) => [v.verse, clean(v.text)]),
    )
    return {
      chapter: wc.chapter,
      verses: wc.verses.map((v) => ({ v: v.verse, web: clean(v.text), kjv: kjvByV.get(v.verse) || '' })),
    }
  })
  return { code: book.code, name: book.name, testament: book.testament, chapters }
}

/**
 * Build the reader book (Ronald's WDEG format) from whatever data/*.json exist,
 * in canonical order: ONE manifest (chapter pages) + ONE text file per edition,
 * verse-structured. Adding a book = drop its data file and rebuild.
 */
async function buildBook() {
  const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith('.json'))
  const present = new Set(files.map((f) => f.replace('.json', '')))
  const pages = []
  const web = {} // order -> [{v,t}]
  const kjv = {}
  let order = 0
  for (const code of CODE_ORDER) {
    if (!present.has(code)) continue
    const book = BOOKS.find((b) => b.code === code)
    const data = JSON.parse(await readFile(resolve(DATA_DIR, `${code}.json`), 'utf-8'))
    for (const ch of data.chapters) {
      order += 1
      const title = book.chapters === 1 ? book.name : `${book.name} ${ch.chapter}`
      pages.push({ order, title, book: code, bookName: book.name, chapter: ch.chapter, ref: `${code}.${ch.chapter}` })
      web[String(order)] = ch.verses.map((vr) => ({ v: vr.v, t: vr.web }))
      kjv[String(order)] = ch.verses.map((vr) => ({ v: vr.v, t: vr.kjv }))
    }
  }
  const manifest = {
    slug: 'holy-bible',
    title: 'The Holy Bible',
    subtitle: 'World English Bible · King James Version',
    pageCount: pages.length,
    pages,
    languages: [
      { code: 'web', name: 'World English Bible' },
      { code: 'kjv', name: 'King James Version' },
    ],
    defaultLanguage: 'web',
    textBase: '/library/holy-bible/text',
  }
  await writeFile(resolve(BOOK_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2), 'utf-8')
  await writeFile(resolve(TEXT_DIR, 'web.json'), JSON.stringify(web), 'utf-8')
  await writeFile(resolve(TEXT_DIR, 'kjv.json'), JSON.stringify(kjv), 'utf-8')
  console.log(`  book: ${pages.length} chapter-pages across ${present.size} book(s) · editions: web, kjv`)
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true })
  await mkdir(TEXT_DIR, { recursive: true })
  const args = process.argv.slice(2)
  const codes = args.length === 0 ? ['PHM'] : args[0].toUpperCase() === 'ALL' ? CODE_ORDER : args.map((a) => a.toUpperCase())
  console.log(`Ingesting: ${codes.length} book(s) from bulk source`)
  console.log('Loading WEB + KJV (one request each)…')
  const [webBooks, kjvBooks] = await Promise.all([loadBulk('web'), loadBulk('kjv')])
  for (const code of codes) {
    const book = BOOKS.find((b) => b.code === code)
    if (!book) { console.warn(`  ? unknown book code: ${code}`); continue }
    const data = extractBook(book, webBooks, kjvBooks)
    await writeFile(resolve(DATA_DIR, `${book.code}.json`), JSON.stringify(data, null, 2), 'utf-8')
    console.log(`  ✓ ${book.name} — ${data.chapters.length} ch`)
  }
  await buildBook()
  console.log('done. The Holy Bible book is built — open the Library.')
}

main().catch((e) => { console.error(e); process.exit(1) })
