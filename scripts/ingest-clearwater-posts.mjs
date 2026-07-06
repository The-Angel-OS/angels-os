/**
 * ingest-clearwater-posts.mjs — parse the Clearwater transcript dumps into
 * structured Post records (title, publishedOn, youtube URL, description, body).
 *
 * The transcripts in docs/transcripts/*.{txt,md} are scraped YouTube pages, so
 * each carries the video URL + a meta-named title, wrapped in Studio UI noise.
 * This script extracts the signal. It is READ-ONLY by default — it writes NO
 * database records — so we can judge extraction quality before any prod ingest.
 *
 * Usage:
 *   node scripts/ingest-clearwater-posts.mjs                 # dry-run summary + 3 samples
 *   node scripts/ingest-clearwater-posts.mjs --samples 8     # more samples
 *   node scripts/ingest-clearwater-posts.mjs --json out.json # write the full manifest
 *
 * Next step (separate, gated): a posts-ops/ingest endpoint upserts these onto the
 * Clearwater tenant (idempotent by sourceUrl), fed by this manifest.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = resolve(ROOT, 'docs/transcripts')

const args = process.argv.slice(2)
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null
const sampleCount = args.includes('--samples') ? Number(args[args.indexOf('--samples') + 1]) || 3 : 3

const YT = /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/

// UI sentinels — where the scraped description gives way to YouTube chrome.
const CUT = /^(?:Ask|Get answers|Featured places|Transcript|Show transcript|Follow along|Up next|Autoplay|Subscribe|Analytics|Edit video|Promote|More from|Comments)\b/i

/** Parse a leading YYMMDD or YYYYMMDD (optional HHMM) from a filename → ISO date. */
function dateFromName(name) {
  const m = name.match(/^(\d{8}|\d{6})(?:[ _-]+(\d{4}))?/)
  if (!m) return null
  const d = m[1]
  let yyyy, mm, dd
  if (d.length === 8) { yyyy = d.slice(0, 4); mm = d.slice(4, 6); dd = d.slice(6, 8) }
  else { yyyy = '20' + d.slice(0, 2); mm = d.slice(2, 4); dd = d.slice(4, 6) }
  const mi = Number(mm), di = Number(dd)
  if (mi < 1 || mi > 12 || di < 1 || di > 31) return null
  return `${yyyy}-${mm}-${dd}T12:00:00.000Z`
}

/** Human title: strip the date/time prefix + extension, tidy spacing. */
function titleFromName(name) {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/^(?:\d{8}|\d{6})(?:[ _-]+\d{4})?[ _-]*/, '')
    .replace(/\s+/g, ' ')
    .trim() || name.replace(/\.[^.]+$/, '')
}

function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80)
}

/** Strip YouTube boilerplate; return '' when there's no real description. */
function cleanDescription(desc) {
  let d = desc
    .replace(/How this was made[\s\S]*$/i, '')
    .replace(/Auto-dubbed[\s\S]*$/i, '')
    .replace(/\bLearn more\b/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  // YouTube's "no description" placeholder, or too short to be real content.
  if (/^No description has been added/i.test(d)) return ''
  if (d.replace(/\s+/g, ' ').length < 40) return ''
  return d
}

/** Best-effort description: the block after the "N views · date" line, cut at UI. */
function extractDescription(lines, titleLine) {
  // Find the "views" line (e.g. "2 views  Aug 10, 2025") — the description follows it.
  let start = lines.findIndex((l) => /\bviews?\b/i.test(l) && /\d/.test(l))
  if (start < 0) {
    // Fallback: start after the title line.
    start = titleLine >= 0 ? titleLine + 1 : 0
  }
  const out = []
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]
    if (CUT.test(l.trim())) break
    // Stop at the repeated "Clearwater Cruisin' / N subscribers" chrome block.
    if (/^Clearwater Cruisin'?\s*$/.test(l.trim()) && /subscribers/i.test(lines[i + 1] || '')) break
    out.push(l)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

async function main() {
  const all = await readdir(DIR)
  const files = all.filter((f) => ['.txt', '.md'].includes(extname(f).toLowerCase()))

  const records = []
  const noUrl = []
  const seenSlugs = new Map()

  for (const file of files) {
    const raw = await readFile(resolve(DIR, file), 'utf-8')
    const lines = raw.split(/\r?\n/)
    const urlMatch = raw.match(YT)
    const url = urlMatch ? urlMatch[0] : null
    const videoId = urlMatch ? urlMatch[1] : null
    const title = titleFromName(file)
    const publishedOn = dateFromName(file)
    const titleLineIdx = lines.findIndex((l) => l.trim() && titleFromName(l).length > 3 && l.includes(title.split(' ')[0] || ''))
    const description = cleanDescription(extractDescription(lines, titleLineIdx))

    if (!url) noUrl.push(file)

    // Unique slug: disambiguate collisions with a counter.
    let slug = slugify(title)
    const n = (seenSlugs.get(slug) || 0) + 1
    seenSlugs.set(slug, n)
    if (n > 1) slug = `${slug}-${n}`

    // A post needs the video (to embed) AND real text; otherwise it's a
    // whisper-pipeline candidate (Merlin transcribes to fill the description).
    const needsWhisper = !url || description.length === 0

    records.push({
      file,
      title,
      slug,
      publishedOn,
      sourceUrl: url,
      sourceType: 'youtube',
      videoId,
      descriptionChars: description.length,
      description,
      needsWhisper,
    })
  }

  // ── Report ──────────────────────────────────────────────────────────
  console.log(`\n=== Clearwater transcript ingest — DRY RUN (no writes) ===`)
  console.log(`Transcripts scanned : ${files.length}`)
  console.log(`With a video URL    : ${records.filter((r) => r.sourceUrl).length}`)
  console.log(`With a parsed date  : ${records.filter((r) => r.publishedOn).length}`)
  console.log(`With a description  : ${records.filter((r) => r.descriptionChars > 0).length}`)
  const emptyDesc = records.filter((r) => r.descriptionChars === 0).length
  console.log(`Empty description   : ${emptyDesc}  (real text missing after cleanup)`)
  const readyNow = records.filter((r) => !r.needsWhisper).length
  console.log(`Ready to publish now: ${readyNow}  (has URL + real description)`)
  console.log(`Needs whisper pass  : ${records.filter((r) => r.needsWhisper).length}  (Merlin transcribes → fills description)`)
  const dupSlugs = records.length - new Set(records.map((r) => r.slug)).size
  console.log(`Duplicate slugs     : ${dupSlugs}  (after disambiguation)`)
  if (noUrl.length) console.log(`\nNo URL (${noUrl.length}): ${noUrl.slice(0, 5).join(' | ')}${noUrl.length > 5 ? ' …' : ''}`)

  console.log(`\n--- ${sampleCount} sample record(s) ---`)
  for (const r of records.slice(0, sampleCount)) {
    console.log(`\n• ${r.title}`)
    console.log(`  slug:     ${r.slug}`)
    console.log(`  date:     ${r.publishedOn || '(none)'}`)
    console.log(`  url:      ${r.sourceUrl || '(none)'}  [${r.videoId || '-'}]`)
    console.log(`  desc(${r.descriptionChars}): ${r.description.slice(0, 220).replace(/\n/g, ' ')}${r.descriptionChars > 220 ? '…' : ''}`)
  }

  if (jsonOut) {
    await writeFile(resolve(ROOT, jsonOut), JSON.stringify(records, null, 2), 'utf-8')
    console.log(`\nManifest written → ${jsonOut} (${records.length} records)`)
  }
  console.log('')
}

main().catch((e) => { console.error(e); process.exit(1) })
