/**
 * ingest-bible.mjs — build the canonical Holy Bible Work from public-domain text.
 *
 * The factory, not the prototype: fetches public-domain scripture (WEB + KJV) from
 * bible-api.com and writes, per book:
 *   src/souls/holy-bible/data/<CODE>.json   — verse-addressed, BOTH translations
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
import { mkdir, writeFile, readdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = resolve(ROOT, 'src/souls/holy-bible/data')
const MD_DIR = resolve(ROOT, 'docs/vision/holy-bible')
const INDEX = resolve(ROOT, 'src/souls/holy-bible/index.generated.json')
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Fetch one chapter's verses for a translation. Single-chapter books omit the number. */
async function fetchChapter(book, chapter, translation) {
  // Single-chapter books: bible-api treats "<book> 1" as VERSE 1, so we must use
  // an explicit range "<book> 1:1-<soleVerses>". Multi-chapter: "<book> <ch>".
  const q = book.chapters === 1 ? `${book.query} 1:1-${book.soleVerses}` : `${book.query} ${chapter}`
  const url = `${API}/${encodeURIComponent(q)}?translation=${translation}`
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        return (data.verses || []).map((v) => ({ v: v.verse, text: v.text.trim().replace(/\s+/g, ' ') }))
      }
    } catch {
      /* retry */
    }
    await sleep(500 * (attempt + 1))
  }
  throw new Error(`fetch failed: ${url}`)
}

/** Render a chapter to verse-numbered WEB markdown (the reader page). */
function chapterMarkdown(book, chapter, verses) {
  const title = book.chapters === 1 ? book.name : `${book.name} ${chapter}`
  const body = verses.map((vr) => `**${vr.v}** ${vr.web}`).join(' ')
  return `# ${title}\n\n${body}\n`
}

async function ingestBook(book) {
  const chapters = []
  for (let ch = 1; ch <= book.chapters; ch++) {
    const [web, kjv] = await Promise.all([fetchChapter(book, ch, 'web'), fetchChapter(book, ch, 'kjv')])
    const kjvByV = new Map(kjv.map((x) => [x.v, x.text]))
    const verses = web.map((w) => ({ v: w.v, web: w.text, kjv: kjvByV.get(w.v) || '' }))
    chapters.push({ chapter: ch, verses })
    // Per-chapter markdown page.
    await writeFile(resolve(MD_DIR, `${book.code.toLowerCase()}-${ch}.md`), chapterMarkdown(book, ch, verses), 'utf-8')
    process.stdout.write(`  ${book.code} ${ch}/${book.chapters} (${verses.length} v)\r`)
    await sleep(120) // be polite to the public API
  }
  const data = { code: book.code, name: book.name, testament: book.testament, chapters }
  await writeFile(resolve(DATA_DIR, `${book.code}.json`), JSON.stringify(data, null, 2), 'utf-8')
  console.log(`\n  ✓ ${book.name} — ${chapters.length} ch`)
}

/** Rebuild the ordered chapter index (the manifest's docs) from existing data files. */
async function rebuildIndex() {
  const files = (await readdir(DATA_DIR)).filter((f) => f.endsWith('.json'))
  const present = new Set(files.map((f) => f.replace('.json', '')))
  const docs = []
  for (const code of CODE_ORDER) {
    if (!present.has(code)) continue
    const book = BOOKS.find((b) => b.code === code)
    for (let ch = 1; ch <= book.chapters; ch++) {
      const title = book.chapters === 1 ? book.name : `${book.name} ${ch}`
      docs.push({
        id: `${code.toLowerCase()}-${ch}`,
        filename: `${code.toLowerCase()}-${ch}.md`,
        title,
        tier: 'chapter',
        book: code,
        bookName: book.name,
        chapter: ch,
      })
    }
  }
  await writeFile(INDEX, JSON.stringify({ generatedFrom: [...present], docs }, null, 2), 'utf-8')
  console.log(`  index: ${docs.length} chapters across ${present.size} book(s)`)
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true })
  await mkdir(MD_DIR, { recursive: true })
  const args = process.argv.slice(2)
  const codes = args.length === 0 ? ['PHM'] : args[0].toUpperCase() === 'ALL' ? CODE_ORDER : args.map((a) => a.toUpperCase())
  console.log(`Ingesting: ${codes.join(', ')}`)
  for (const code of codes) {
    const book = BOOKS.find((b) => b.code === code)
    if (!book) { console.warn(`  ? unknown book code: ${code}`); continue }
    await ingestBook(book)
  }
  await rebuildIndex()
  console.log('done. Register the soul (src/souls/index.ts) if not already, then open the Library.')
}

main().catch((e) => { console.error(e); process.exit(1) })
