/**
 * webSearch — give LEO eyes on the live web.
 *
 * Provider chain (first-available-wins, mirroring AI_PROVIDER_ORDER): a real
 * search API when a key is present, else a keyless fallback so the tool WORKS
 * out of the box (config-free for the 99%) — just better once a key is added.
 *
 *   MERLIN_SEARCH_URL     → proxy search THROUGH the Merlin node         [preferred]
 *   SEARXNG_URL           → self-hosted SearXNG metasearch (no keys)     [best, owned]
 *   TAVILY_API_KEY        → Tavily (LLM-optimized results + snippets)   [great]
 *   BRAVE_SEARCH_API_KEY  → Brave Search API                            [great]
 *   (none)                → DuckDuckGo Instant Answer (keyless)         [limited]
 *
 * MERLIN_SEARCH_URL routes the query to the Merlin node (a long-lived worker on a
 * RESIDENTIAL IP), which runs the search there and returns results — so Leo Core
 * searches from a real browser/IP instead of a datacenter (dodges cloud-IP blocks)
 * and offloads the work. It's tried FIRST when set, and is fully fail-soft: if
 * Merlin is unreachable or slow it falls straight through to the cascade below, so
 * search never breaks when Merlin is down.
 *   Merlin-side contract (separate repo): POST MERLIN_SEARCH_URL with JSON
 *   { query: string, maxResults: number } → 200 { results: [{title,url,snippet}] }.
 *
 * SearXNG is the owned/self-hosted backbone: run one container (docs/infra/
 * SEARXNG_SELFHOST.md), point SEARXNG_URL at it, and web search is real, free,
 * and key-free forever — the config-free-intelligence stance applied to retrieval.
 *
 * Fail-soft + time-boxed so a slow/blocked provider never hangs LEO's turn.
 *
 * @see src/utilities/leo-data-tools.ts — the `web_search` tool wraps this
 * @see src/utilities/contentIngest.ts — fetchReadableContent (read ONE url deeply)
 */

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
}

export interface WebSearchResponse {
  query: string
  provider: 'merlin' | 'searxng' | 'tavily' | 'brave' | 'duckduckgo' | 'none'
  results: WebSearchResult[]
  /** Optional note (e.g. "add a key for fuller results"). */
  note?: string
}

const TIMEOUT_MS = 8000

async function timedFetch(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function viaMerlin(query: string, max: number, baseUrl: string): Promise<WebSearchResult[]> {
  // Proxy the search through the Merlin node (residential IP + offload). Merlin
  // runs the search and returns normalized results. Contract: POST { query,
  // maxResults } → { results: [{title,url,snippet}] }.
  const res = await timedFetch(baseUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, maxResults: max }),
  })
  if (!res.ok) throw new Error(`Merlin search HTTP ${res.status}`)
  const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; snippet?: string; content?: string }> }
  return (data.results || []).slice(0, max).map((r) => ({
    title: r.title || r.url || 'result',
    url: r.url || '',
    snippet: (r.snippet || r.content || '').slice(0, 500),
  }))
}

async function viaSearxng(query: string, max: number, baseUrl: string): Promise<WebSearchResult[]> {
  // Self-hosted SearXNG. Requires `format: json` enabled in its settings.yml
  // (search.formats) — see docs/infra/SEARXNG_SELFHOST.md.
  const base = baseUrl.replace(/\/+$/, '')
  const res = await timedFetch(
    `${base}/search?q=${encodeURIComponent(query)}&format=json&safesearch=0`,
    { headers: { Accept: 'application/json' } },
  )
  if (!res.ok) throw new Error(`SearXNG HTTP ${res.status}`)
  const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> }
  return (data.results || []).slice(0, max).map((r) => ({
    title: r.title || r.url || 'result',
    url: r.url || '',
    snippet: (r.content || '').slice(0, 500),
  }))
}

async function viaTavily(query: string, max: number, key: string): Promise<WebSearchResult[]> {
  const res = await timedFetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key, query, max_results: max, search_depth: 'basic' }),
  })
  if (!res.ok) throw new Error(`Tavily HTTP ${res.status}`)
  const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> }
  return (data.results || []).slice(0, max).map((r) => ({
    title: r.title || r.url || 'result',
    url: r.url || '',
    snippet: (r.content || '').slice(0, 500),
  }))
}

async function viaBrave(query: string, max: number, key: string): Promise<WebSearchResult[]> {
  const res = await timedFetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${max}`,
    { headers: { Accept: 'application/json', 'X-Subscription-Token': key } },
  )
  if (!res.ok) throw new Error(`Brave HTTP ${res.status}`)
  const data = (await res.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> }
  }
  return (data.web?.results || []).slice(0, max).map((r) => ({
    title: r.title || r.url || 'result',
    url: r.url || '',
    snippet: (r.description || '').replace(/<[^>]+>/g, '').slice(0, 500),
  }))
}

async function viaDuckDuckGo(query: string, max: number): Promise<WebSearchResult[]> {
  // Keyless Instant Answer API — limited (definitions/related topics, not full web
  // results), but works with zero config as a graceful fallback.
  const res = await timedFetch(
    `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&no_redirect=1`,
    { headers: { Accept: 'application/json' } },
  )
  if (!res.ok) throw new Error(`DuckDuckGo HTTP ${res.status}`)
  const data = (await res.json()) as {
    AbstractText?: string
    AbstractURL?: string
    Heading?: string
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string }>
  }
  const out: WebSearchResult[] = []
  if (data.AbstractText && data.AbstractURL) {
    out.push({ title: data.Heading || query, url: data.AbstractURL, snippet: data.AbstractText.slice(0, 500) })
  }
  for (const t of data.RelatedTopics || []) {
    if (out.length >= max) break
    if (t.Text && t.FirstURL) out.push({ title: t.Text.slice(0, 100), url: t.FirstURL, snippet: t.Text.slice(0, 500) })
  }
  return out.slice(0, max)
}

/**
 * Search the web. Picks the best available provider; returns [] (never throws)
 * when everything fails, with `provider: 'none'` and a note.
 */
export async function webSearch(
  query: string,
  opts: { maxResults?: number } = {},
): Promise<WebSearchResponse> {
  const q = (query || '').trim()
  const max = Math.max(1, Math.min(10, Math.round(opts.maxResults ?? 5)))
  if (!q) return { query: q, provider: 'none', results: [], note: 'empty query' }

  const merlin = process.env.MERLIN_SEARCH_URL
  const searxng = process.env.SEARXNG_URL
  const tavily = process.env.TAVILY_API_KEY
  const brave = process.env.BRAVE_SEARCH_API_KEY

  // Merlin node first when configured — residential-IP search + offload. Fully
  // fail-soft: any error/timeout (e.g. Merlin down) falls through to the cascade,
  // so search never breaks.
  if (merlin) {
    try {
      const results = await viaMerlin(q, max, merlin)
      if (results.length) return { query: q, provider: 'merlin', results }
      /* empty → fall through and try another provider */
    } catch {
      /* Merlin unreachable/slow — fall through to owned/keyed/keyless providers */
    }
  }

  // Owned/self-hosted first — free, key-free, and ours to move.
  if (searxng) {
    try {
      return { query: q, provider: 'searxng', results: await viaSearxng(q, max, searxng) }
    } catch {
      /* fall through to the keyed/keyless providers */
    }
  }
  if (tavily) {
    try {
      return { query: q, provider: 'tavily', results: await viaTavily(q, max, tavily) }
    } catch {
      /* fall through */
    }
  }
  if (brave) {
    try {
      return { query: q, provider: 'brave', results: await viaBrave(q, max, brave) }
    } catch {
      /* fall through */
    }
  }
  try {
    const results = await viaDuckDuckGo(q, max)
    return {
      query: q,
      provider: 'duckduckgo',
      results,
      note: results.length
        ? 'Keyless DuckDuckGo results (limited). Set TAVILY_API_KEY or BRAVE_SEARCH_API_KEY for full web search.'
        : 'No keyless results. Set TAVILY_API_KEY or BRAVE_SEARCH_API_KEY for full web search.',
    }
  } catch {
    return { query: q, provider: 'none', results: [], note: 'web search unavailable' }
  }
}
