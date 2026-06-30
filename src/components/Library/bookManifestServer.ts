/**
 * bookManifestServer — server-only helpers for the deep-linkable, indexable
 * Library reader. Reads a file-based book's manifest + base-language text so the
 * route can:
 *   - infer a clean chapter-name slug per page (the first line of the page text
 *     IS the title in our books, e.g. "Something's Wrong With The World"),
 *   - resolve a `/learn/<soul>/<n>-<name>` URL back to a page index,
 *   - build per-page SEO metadata (title, description, Open Graph page image).
 *
 * Imported only from server components — uses `fs`. Never import from a client
 * component (it would pull `fs`/`path` into the browser bundle).
 */
import fs from 'fs'
import path from 'path'
import type { BookManifest } from './BookReader'

export interface LoadedBook {
  manifest: BookManifest
  baseLanguage: string
  /** order(string) -> base-language text (a prose string, or a verse array for
   *  scripture-style books). */
  baseText: Record<string, unknown>
  /** Index-aligned with manifest.pages: "<n>-<inferred-name>". */
  pageSlugs: string[]
  /** Index-aligned inferred page titles (first line of the page text). */
  pageTitles: string[]
}

const slugifyTitle = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/['’"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

/** The first non-empty line of a page's text — our books use it as the title. */
function firstLine(text?: string): string {
  if (!text) return ''
  return (
    text
      .split(/\n/)
      .map((s) => s.trim())
      .filter(Boolean)[0] ?? ''
  )
}

/** Build the slug/title-augmented LoadedBook from a manifest + base-language text. */
function buildLoadedBook(manifest: BookManifest, baseText: Record<string, unknown>): LoadedBook {
  const baseLanguage = manifest.defaultLanguage || 'en'
  const pages = manifest.pages || []
  // Prefer the manifest's explicit page title (scripture: "John 3"); else infer
  // from the first line of a prose page. Verse-structured (array) pages always
  // carry a manifest title, so we never call firstLine on a non-string.
  const pageTitles = pages.map((p) => {
    if (p.title) return p.title
    const t = baseText[String(p.order)]
    return typeof t === 'string' ? firstLine(t) : ''
  })
  const pageSlugs = pages.map((_, i) => {
    const name = slugifyTitle(pageTitles[i] || '')
    const human = i + 1 // 1-based page position is the URL's source of truth
    return name ? `${human}-${name}` : `${human}`
  })
  return { manifest, baseLanguage, baseText, pageSlugs, pageTitles }
}

/** Load a file-based book (public/library/<slug>/) with inferred page slugs. */
export function loadBookFromPublic(bookSlug: string): LoadedBook | null {
  try {
    const dir = path.join(process.cwd(), 'public', 'library', bookSlug)
    const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf8')) as BookManifest
    const baseLanguage = manifest.defaultLanguage || 'en'

    let baseText: Record<string, unknown> = {}
    try {
      baseText = JSON.parse(fs.readFileSync(path.join(dir, 'text', `${baseLanguage}.json`), 'utf8'))
    } catch {
      baseText = {}
    }

    return buildLoadedBook(manifest, baseText)
  } catch {
    return null
  }
}

/**
 * Origin (CDN) fallback for loadBookFromPublic. `public/` is served as static
 * assets but is NOT traced into the serverless API function bundle, so the
 * fs-based loader returns null inside /api routes on Vercel. The book files are
 * still reachable over HTTP at `<origin>/library/<slug>/…`, so the import path
 * fetches them instead. Mirrors the per-language-text fetch already in works.ts.
 */
export async function loadBookFromOrigin(bookSlug: string, origin: string): Promise<LoadedBook | null> {
  if (!origin) return null
  try {
    const base = `${origin.replace(/\/+$/, '')}/library/${bookSlug}`
    const mr = await fetch(`${base}/manifest.json`, { headers: { accept: 'application/json' } })
    if (!mr.ok) return null
    const manifest = (await mr.json()) as BookManifest
    const baseLanguage = manifest.defaultLanguage || 'en'

    let baseText: Record<string, unknown> = {}
    try {
      const tr = await fetch(`${base}/text/${baseLanguage}.json`, { headers: { accept: 'application/json' } })
      if (tr.ok) baseText = (await tr.json()) as Record<string, unknown>
    } catch {
      baseText = {}
    }

    return buildLoadedBook(manifest, baseText)
  } catch {
    return null
  }
}

/**
 * Resolve a `<n>-<name>` page param to a page index. The leading integer (1-based
 * position) is authoritative; the name is cosmetic, so a stale/renamed name still
 * resolves correctly. Out-of-range or missing → page 0.
 */
export function resolvePageIndex(loaded: LoadedBook, pageParam?: string): number {
  if (!pageParam) return 0
  const n = parseInt(pageParam, 10)
  if (Number.isFinite(n) && n >= 1 && n <= loaded.manifest.pages.length) return n - 1
  return 0
}

/** A ~155-char description from a page's body (the lines after the title). */
export function pageExcerpt(text?: string, max = 155): string {
  if (!text) return ''
  const lines = text
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean)
  const body = (lines.length > 1 ? lines.slice(1) : lines).join(' ')
  const clean = body.replace(/\s+/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean
}
