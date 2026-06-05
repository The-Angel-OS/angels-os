/**
 * contentIngest — pull readable content from a URL (article, blog post, Google
 * Doc) or accept pasted/uploaded text, so LEO can turn it into a Work or Post.
 *
 * Server-only (uses jsdom). Safety:
 *   - http(s) only; obvious loopback / private-network / link-local hosts are
 *     refused (basic SSRF guard — literal-host checks, not DNS resolution).
 *   - 15s timeout, ~2 MB cap, follows redirects, sends a normal UA.
 * Google Docs URLs are rewritten to the plaintext export endpoint (works for
 * "anyone with the link"/published docs; private docs simply 403 and we say so).
 */
import { JSDOM } from 'jsdom'

export interface ReadableContent {
  title?: string
  text: string
  sourceUrl: string
  byline?: string
}

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const FETCH_TIMEOUT_MS = 15_000
const UA =
  'Mozilla/5.0 (compatible; AngelOS-LEO/1.0; +https://angelos.app) content-ingest'

/** Reject loopback / private / link-local literal hosts (basic SSRF guard). */
export function isUnsafeHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h === '0.0.0.0' || h === '::1') return true
  if (h === 'metadata' || h.endsWith('.internal') || h.endsWith('.local')) return true
  // IPv4 literals in private / loopback / link-local / CGNAT ranges
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    if (a === 127 || a === 10 || a === 0) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true // link-local (incl. cloud metadata 169.254.169.254)
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
  }
  return false
}

/** Rewrite a Google Docs URL to its plaintext export endpoint, else return as-is. */
export function normalizeSourceUrl(url: string): string {
  const doc = url.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/)
  if (doc && !/\/export\b/.test(url)) {
    return `https://docs.google.com/document/d/${doc[1]}/export?format=txt`
  }
  return url
}

/** Extract readable text + a title from an HTML document via jsdom. */
export function extractReadableFromHtml(html: string, sourceUrl: string): ReadableContent {
  const dom = new JSDOM(html, { url: sourceUrl })
  const doc = dom.window.document

  doc.querySelectorAll('script,style,noscript,nav,header,footer,aside,form,iframe,svg,button').forEach((el) =>
    el.remove(),
  )

  const titleEl = doc.querySelector('h1') || doc.querySelector('title')
  const title = titleEl?.textContent?.trim() || undefined
  const byline =
    doc.querySelector('[rel="author"]')?.textContent?.trim() ||
    doc.querySelector('meta[name="author"]')?.getAttribute('content')?.trim() ||
    undefined

  const root =
    doc.querySelector('article') ||
    doc.querySelector('main') ||
    doc.querySelector('[role="main"]') ||
    doc.body

  // Build paragraph-ish text from block elements, collapsing whitespace.
  const blocks: string[] = []
  root?.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,blockquote,pre').forEach((el) => {
    const t = el.textContent?.replace(/\s+/g, ' ').trim()
    if (t) {
      const tag = el.tagName.toLowerCase()
      if (/^h[1-6]$/.test(tag)) blocks.push(`\n${'#'.repeat(Number(tag[1]))} ${t}`)
      else if (tag === 'li') blocks.push(`- ${t}`)
      else blocks.push(t)
    }
  })

  let text = blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim()
  // Fallback to raw body text if structured extraction came up empty.
  if (!text) text = (root?.textContent || '').replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()

  return { title, text, sourceUrl, byline }
}

/**
 * Fetch a URL and return its readable content. `fetchImpl` is injectable for tests.
 * Throws a user-meaningful Error on unsafe URL, network failure, or empty content.
 */
export async function fetchReadableContent(
  url: string,
  opts: { fetchImpl?: typeof fetch } = {},
): Promise<ReadableContent> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('That does not look like a valid URL.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs can be fetched.')
  }
  if (isUnsafeHost(parsed.hostname)) {
    throw new Error('That host is not allowed.')
  }

  const target = normalizeSourceUrl(url)
  const doFetch = opts.fetchImpl ?? fetch
  const res = await doFetch(target, {
    redirect: 'follow',
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,text/plain,*/*' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error(`That page is not publicly readable (${res.status}). For Google Docs, set sharing to "anyone with the link".`)
    }
    throw new Error(`Could not fetch that page (HTTP ${res.status}).`)
  }

  const contentType = res.headers.get('content-type') || ''
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.byteLength > MAX_BYTES) throw new Error('That page is too large to ingest (over 2 MB).')
  const body = buf.toString('utf8')

  let content: ReadableContent
  if (contentType.includes('text/html') || /^\s*<(?:!doctype|html)/i.test(body)) {
    content = extractReadableFromHtml(body, url)
  } else {
    // text/plain (incl. Google Docs txt export) — use as-is.
    content = { text: body.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim(), sourceUrl: url }
  }

  if (!content.text || content.text.length < 20) {
    throw new Error('No readable text was found at that URL.')
  }
  return content
}
