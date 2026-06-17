/**
 * affectedUrl — the "visual echo" marker shared by the LEO tool layer (producer) and
 * the SSE stream (consumer). When a content mutation runs, executeToolCall appends an
 * <!--affectedUrl:{"url":"…"}--> directive to the tool result naming the PUBLIC surface
 * that changed; leo-stream extracts it and forwards an `affectedUrl` SSE event so a
 * client (Nimue/web) can snapshot that surface before/after and show the change.
 *
 * One module = one source of truth for the marker format, so producer and consumer
 * can never drift. Pure + dependency-free → unit-testable in isolation.
 *
 * @see docs/strategy/COMMS_AND_WORKS_ROADMAP.md (Part C)
 */

/** Marker appended to a mutation tool result. Mirrors the nav directive shape. */
export function affectedUrlDirective(url: string): string {
  return `\n<!--affectedUrl:${JSON.stringify({ url })}-->`
}

/** Map a mutated collection+slug to the PUBLIC URL the change is visible on (or null). */
export function affectedPublicUrl(collection: string, slug?: string): string | null {
  switch (collection) {
    case 'products':
      return slug ? `/products/${slug}` : '/shop'
    case 'posts':
      return slug ? `/posts/${slug}` : '/posts'
    case 'pages':
      // Pages are root-level; the home page lives at '/'.
      return slug ? (slug === 'home' ? '/' : `/${slug}`) : '/'
    // Branding/nav/endeavor changes affect the whole site — home is the representative surface.
    case 'site-settings':
    case 'header':
    case 'endeavors':
      return '/'
    // Media/other collections have no standalone public surface to snapshot.
    default:
      return null
  }
}

/** Pull every affectedUrl out of a set of tool-result strings (deduped, in order). */
export function extractAffectedUrls(toolResultTexts: string[]): string[] {
  const urls: string[] = []
  for (const text of toolResultTexts) {
    // Fresh regex per text — avoids /g lastIndex carryover between strings.
    const re = /<!--affectedUrl:(.*?)-->/g
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      try {
        const u = (JSON.parse(m[1]) as { url?: string })?.url
        if (u && !urls.includes(u)) urls.push(u)
      } catch {
        /* malformed marker — ignore */
      }
    }
  }
  return urls
}
