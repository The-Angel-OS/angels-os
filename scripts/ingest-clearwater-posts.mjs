/**
 * ingest-clearwater-posts.mjs — build structured Post records for Clearwater
 * Cruisin' from two assets, READ-ONLY (writes NO database records):
 *
 *   1. The Viewstats DOM dump (docs/transcripts/_260705 … Viewstats.txt, last
 *      line) — the canonical VIDEO LIST: every card carries the videoId, full
 *      title, duration, views, and an hqdefault thumbnail. This is the spine.
 *   2. The transcript files (docs/transcripts/*.{txt,md}) — scraped YouTube
 *      pages that carry a video URL + a real DESCRIPTION for a subset. Matched
 *      into the list by videoId (falling back to a normalized title).
 *
 * Result: one record per video — ready-to-publish when it has a description,
 * else flagged needsWhisper (Merlin transcribes → fills it). This is the safe
 * front half; a gated posts-ops/ingest endpoint upserts the manifest onto the
 * Clearwater tenant (idempotent by sourceUrl) next.
 *
 * Usage:
 *   node scripts/ingest-clearwater-posts.mjs                 # summary + 4 samples
 *   node scripts/ingest-clearwater-posts.mjs --samples 12
 *   node scripts/ingest-clearwater-posts.mjs --json out.json # write the manifest
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = resolve(ROOT, 'docs/transcripts')
const VIEWSTATS = '_260705 2341 Youtube Video List from Viewstats Dom Blob.txt'

const args = process.argv.slice(2)
const jsonOut = args.includes('--json') ? args[args.indexOf('--json') + 1] : null
const sampleCount = args.includes('--samples') ? Number(args[args.indexOf('--samples') + 1]) || 4 : 4

const YT = /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/
const CUT = /^(?:Ask|Get answers|Featured places|Transcript|Show transcript|Follow along|Up next|Autoplay|Subscribe|Analytics|Edit video|Promote|More from|Comments)\b/i

function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&nbsp;/g, ' ')
}

function slugify(s) {
  return s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80)
}

/** Normalized title key for fuzzy transcript↔card matching. */
function titleKey(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 40)
}

function dateFromName(name) {
  const m = name.match(/^(\d{8}|\d{6})(?:[ _-]+(\d{4}))?/)
  if (!m) return null
  const d = m[1]
  const [yyyy, mm, dd] = d.length === 8
    ? [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8)]
    : ['20' + d.slice(0, 2), d.slice(2, 4), d.slice(4, 6)]
  const mi = Number(mm), di = Number(dd)
  if (mi < 1 || mi > 12 || di < 1 || di > 31) return null
  return `${yyyy}-${mm}-${dd}T12:00:00.000Z`
}

function titleFromName(name) {
  return name.replace(/\.[^.]+$/, '')
    .replace(/^(?:\d{8}|\d{6})(?:[ _-]+\d{4})?[ _-]*/, '')
    .replace(/\s+/g, ' ').trim() || name.replace(/\.[^.]+$/, '')
}

function cleanDescription(desc) {
  let d = desc
    .replace(/How this was made[\s\S]*$/i, '')
    .replace(/Auto-dubbed[\s\S]*$/i, '')
    .replace(/\bLearn more\b/gi, '')
    .replace(/\n{3,}/g, '\n\n').trim()
  if (/^No description has been added/i.test(d)) return ''
  if (d.replace(/\s+/g, ' ').length < 40) return ''
  return d
}

function extractDescription(lines) {
  let start = lines.findIndex((l) => /\bviews?\b/i.test(l) && /\d/.test(l))
  if (start < 0) start = 0
  const out = []
  for (let i = start + 1; i < lines.length; i++) {
    const l = lines[i]
    if (CUT.test(l.trim())) break
    if (/^Clearwater Cruisin'?\s*$/.test(l.trim()) && /subscribers/i.test(lines[i + 1] || '')) break
    out.push(l)
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/** Parse the Viewstats DOM blob → [{videoId, kind, title, duration, meta, thumbnail}] */
function parseDom(blob) {
  const parts = blob.split(/<a href="\/@clearwatercruisin\//).slice(1)
  const cards = []
  const seen = new Set()
  for (const p of parts) {
    const idm = p.match(/^(videos|shorts)\/([A-Za-z0-9_-]{11})/)
    if (!idm) continue
    const videoId = idm[2]
    if (seen.has(videoId)) continue
    seen.add(videoId)
    const duration = (p.match(/font-semibold text-white[^>]*>([^<]+)</) || [])[1] || null
    const title = decodeEntities((p.match(/line-clamp-2[^>]*>([^<]*)</) || [])[1] || '').trim()
    const meta = decodeEntities((p.match(/text-vs-sub-text">([^<]+)</) || [])[1] || '').trim()
    cards.push({
      videoId,
      kind: idm[1] === 'shorts' ? 'short' : 'video',
      title,
      duration,
      meta, // e.g. "6 views • 4 hours ago"
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    })
  }
  return cards
}

async function loadTranscripts() {
  const files = (await readdir(DIR)).filter((f) => ['.txt', '.md'].includes(extname(f).toLowerCase()) && !f.startsWith('_'))
  const byId = new Map()
  const byTitle = new Map()
  const list = []
  for (const file of files) {
    const raw = await readFile(resolve(DIR, file), 'utf-8')
    const urlMatch = raw.match(YT)
    const description = cleanDescription(extractDescription(raw.split(/\r?\n/)))
    const rec = {
      file,
      videoId: urlMatch ? urlMatch[1] : null,
      title: titleFromName(file),
      publishedOn: dateFromName(file),
      description,
    }
    if (rec.videoId) byId.set(rec.videoId, rec)
    byTitle.set(titleKey(rec.title), rec)
    list.push(rec)
  }
  return { byId, byTitle, list, count: files.length }
}

async function main() {
  const vs = await readFile(resolve(DIR, VIEWSTATS), 'utf-8')
  const domBlob = (vs.match(/<div class="videos-grid">[\s\S]*/) || [vs])[0]
  const cards = parseDom(domBlob)
  const { byId, byTitle, list: transcripts, count: transcriptCount } = await loadTranscripts()

  const seenSlugs = new Map()
  const records = []
  const matchedTranscripts = new Set()

  const addSlug = (title, fallback) => {
    let slug = slugify(title) || fallback
    const n = (seenSlugs.get(slug) || 0) + 1
    seenSlugs.set(slug, n)
    return n > 1 ? `${slug}-${n}` : slug
  }

  for (const c of cards) {
    const t = byId.get(c.videoId) || byTitle.get(titleKey(c.title))
    if (t) matchedTranscripts.add(t.file)
    const title = (t?.title && t.title.length >= c.title.length ? t.title : c.title) || c.title
    const description = t?.description || ''
    records.push({
      videoId: c.videoId,
      kind: c.kind,
      title,
      slug: addSlug(title, c.videoId),
      origin: 'dom',
      duration: c.duration,
      viewsMeta: c.meta,
      publishedOn: t?.publishedOn || null,
      sourceUrl: `https://www.youtube.com/watch?v=${c.videoId}`,
      sourceType: 'youtube',
      thumbnail: c.thumbnail,
      descriptionChars: description.length,
      description,
      hasTranscript: !!t,
      needsWhisper: description.length === 0,
    })
  }

  // ── Superset: fold in transcripts whose video isn't in the loaded DOM ──
  // (older uploads Viewstats didn't render). They already carry a description
  // and often a videoId, so they're publishable now — the DOM just doesn't
  // list them yet. Keyed off matchedTranscripts so we never double-count.
  for (const t of transcripts) {
    if (matchedTranscripts.has(t.file)) continue
    const title = t.title
    records.push({
      videoId: t.videoId, // may be null (the 73 no-URL scrapes → whisper)
      kind: 'video',
      title,
      slug: addSlug(title, t.videoId || slugify(t.file)),
      origin: 'transcript',
      duration: null,
      viewsMeta: null,
      publishedOn: t.publishedOn,
      sourceUrl: t.videoId ? `https://www.youtube.com/watch?v=${t.videoId}` : null,
      sourceType: 'youtube',
      thumbnail: t.videoId ? `https://i.ytimg.com/vi/${t.videoId}/hqdefault.jpg` : null,
      descriptionChars: t.description.length,
      description: t.description,
      hasTranscript: true,
      needsWhisper: t.description.length === 0 || !t.videoId,
    })
  }

  // ── Report ──────────────────────────────────────────────────────────
  const fromDom = records.filter((r) => r.origin === 'dom').length
  const fromTx = records.filter((r) => r.origin === 'transcript').length
  console.log(`\n=== Clearwater video SUPERSET — DRY RUN (no writes) ===`)
  console.log(`Total unique records: ${records.length}   (${fromDom} from DOM + ${fromTx} transcript-only)`)
  console.log(`With a videoId+URL  : ${records.filter((r) => r.videoId).length}`)
  console.log(`With a thumbnail    : ${records.filter((r) => r.thumbnail).length}`)
  console.log(`With a description  : ${records.filter((r) => r.descriptionChars > 0).length}`)
  console.log(`Ready to publish now: ${records.filter((r) => !r.needsWhisper).length}  (has URL + real description)`)
  console.log(`Needs whisper pass  : ${records.filter((r) => r.needsWhisper).length}  (no description and/or no URL → Merlin)`)
  console.log(`Full channel is ~1,363 — the Data API (Merlin) fills the rest beyond these two capped sources.`)

  console.log(`\n--- ${sampleCount} sample record(s) ---`)
  for (const r of records.slice(0, sampleCount)) {
    console.log(`\n• ${r.title}  ${r.kind === 'short' ? '(Short)' : ''}`)
    console.log(`  slug:  ${r.slug}   date: ${r.publishedOn || '(from DOM: ' + r.viewsMeta + ')'}`)
    console.log(`  url:   ${r.sourceUrl}   dur: ${r.duration || '-'}`)
    console.log(`  thumb: ${r.thumbnail}`)
    console.log(`  desc(${r.descriptionChars}${r.hasTranscript ? '' : ', no transcript'}): ${r.description.slice(0, 200).replace(/\n/g, ' ')}${r.descriptionChars > 200 ? '…' : ''}`)
  }

  if (jsonOut) {
    await writeFile(resolve(ROOT, jsonOut), JSON.stringify(records, null, 2), 'utf-8')
    console.log(`\nManifest written → ${jsonOut} (${records.length} records)`)
  }
  console.log('')
}

main().catch((e) => { console.error(e); process.exit(1) })
