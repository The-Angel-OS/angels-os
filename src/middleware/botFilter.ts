/**
 * Edge Bot & Vulnerability Scanner Filter
 *
 * Runs at the top of Next.js middleware BEFORE i18n routing, SSR rendering,
 * or any Payload/Postgres query executes.
 *
 * Goals:
 *   1. Drop vulnerability scanner path probes (/wp-admin, /.env, *.php, etc.)
 *      at the edge in <1ms with a cacheable 404 instead of falling through to
 *      /[locale]/[...slug] and running database lookups.
 *   2. Block AI training scrapers, commercial SEO bulk crawlers, and CLI exploit
 *      scanners that ignore robots.txt from burning Railway CPU/RAM/Postgres I/O.
 *   3. Explicitly allow legitimate search engines (Google, Bing, DuckDuckGo, Apple),
 *      social preview unfurlers (Facebook, X/Twitter, LinkedIn, Slack, Discord),
 *      and payment/uptime webhooks.
 *   4. Rate-limit anonymous high-frequency page scraping per IP.
 */

/**
 * Allowed search engines, social preview bots, and infrastructure monitors.
 * Checked BEFORE BLOCKED_BOT_UA_RE so e.g. Googlebot or Stripe never matches
 * a generic bot/crawler rule.
 */
const ALLOWED_BOT_UA_RE =
  /googlebot|adsbot-google|apis-google|mediapartners-google|google-inspectiontool|googleother|bingbot|adidxbot|msnbot|BingPreview|duckduckbot|applebot|facebookexternalhit|facebot|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|pinterestbot|stripe|uptimerobot|betterstack|pingdom/i

/**
 * AI scrapers, commercial backlink crawlers, and automated vulnerability scanners
 * that ignore robots.txt and run up SSR + database costs.
 */
const BLOCKED_BOT_UA_RE =
  /gptbot|chatgpt-user|oai-searchbot|claudebot|claude-web|anthropic-ai|bytespider|ccbot|perplexitybot|cohere-ai|omgili|diffbot|imagesiftbot|youbot|meta-externalagent|meta-externalfetcher|amazonbot|ai2bot|timpibot|webz\.io|img2dataset|petalbot|ahrefsbot|semrushbot|mj12bot|dotbot|blexbot|dataforseobot|rogerbot|megaindex|serpstatbot|seokicks|sistrix|linkdexbot|barkrowler|babbar|zoominfobot|censys|shodan|internetmeasurement|turnitinbot|sogou|yandexbot|baiduspider|mail\.ru_bot|seznam|sqlmap|nikto|nuclei|nmap|masscan|zgrab|gobuster|dirbuster|feroxbuster|ffuf|wfuzz|acunetix|nessus|openvas|qualys|burpsuite|wpscan|httpx|python-requests|python-urllib|aiohttp|scrapy|go-http-client|libwww-perl|lwp-trivial|mechanize/i

/**
 * Common exploit / CMS scanner probe prefixes and exact paths.
 * None of these exist in Angel OS (Next.js + Payload), so hitting them is
 * 100% automated scanner traffic.
 */
const SCANNER_PATH_RE =
  /^\/(?:[a-z]{2}\/)?(?:wp-admin|wp-login|wp-content|wp-includes|wp-json|xmlrpc\.php|wp-config|wlwmanifest\.xml|\.env|\.git|\.aws|\.ssh|\.vscode|\.htaccess|\.well-known\/security\.txt|phpmyadmin|pma|myadmin|mysql|sqladmin|cgi-bin|vendor\/phpunit|actuator|solr|hudson|jenkins|boaform|HNAP1|GponForm|evox|telescope|_ignition|debug\/default)(?:\/|$|\.)/i

/**
 * Non-Next server script extensions probed by vulnerability scanners.
 */
const SCANNER_EXT_RE = /\.(?:php[0-9]?|phtml|asp|aspx|ashx|jsp|jspx|cgi|pl|env|sql|bak|old|orig|ini|conf|swp)$/i

/**
 * Returns true when the request path is a known scanner/exploit probe that
 * should immediately receive a 404 at the middleware edge.
 */
export function isBlockedScannerPath(pathname: string): boolean {
  if (!pathname) return false
  if (SCANNER_PATH_RE.test(pathname)) return true
  if (SCANNER_EXT_RE.test(pathname)) return true
  return false
}

/**
 * Returns true when the User-Agent belongs to a disallowed scraper, bulk crawler,
 * or vulnerability scanner.
 */
export function isBlockedBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false
  if (ALLOWED_BOT_UA_RE.test(ua)) return false
  return BLOCKED_BOT_UA_RE.test(ua)
}

// ── Anonymous Page Crawl Burst Limiter ────────────────────────────────────────

interface CrawlEntry {
  count: number
  windowStart: number
}

const CRAWL_WINDOW_MS = 60_000
/** Max anonymous public page renders per minute per IP before 429 throttling */
const CRAWL_LIMIT_PER_MINUTE = 90
const MAX_TRACKED_IPS = 5_000

const crawlStore = new Map<string, CrawlEntry>()

/**
 * Lightweight in-memory burst limiter for anonymous public page renders.
 * Prevents disguised scrapers (sending a spoofed Chrome User-Agent) from
 * spidering hundreds of dynamic pages per minute from one IP.
 */
export function checkAnonymousCrawlLimit(
  ip: string | null | undefined,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  if (!ip || ip === 'unknown' || ip === '127.0.0.1' || ip === '::1') {
    return { allowed: true, retryAfterSeconds: 0 }
  }

  // Bound memory if under a distributed flood
  if (crawlStore.size > MAX_TRACKED_IPS) {
    for (const [k, v] of crawlStore) {
      if (now - v.windowStart >= CRAWL_WINDOW_MS) {
        crawlStore.delete(k)
      }
    }
    if (crawlStore.size > MAX_TRACKED_IPS) {
      crawlStore.clear()
    }
  }

  const existing = crawlStore.get(ip)
  if (!existing || now - existing.windowStart >= CRAWL_WINDOW_MS) {
    crawlStore.set(ip, { count: 1, windowStart: now })
    return { allowed: true, retryAfterSeconds: 0 }
  }

  existing.count += 1
  if (existing.count > CRAWL_LIMIT_PER_MINUTE) {
    const retryAfterMs = CRAWL_WINDOW_MS - (now - existing.windowStart)
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    }
  }

  return { allowed: true, retryAfterSeconds: 0 }
}

/** Reset internal store (for unit tests) */
export function _resetCrawlStore(): void {
  crawlStore.clear()
}
