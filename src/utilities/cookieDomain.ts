/**
 * cookieDomainForHost — the registrable apex to scope the auth cookie to, so a
 * session is shared across ALL subdomains of whatever domain you're on (the
 * DNN-style "log in once, roam every portal subdomain" experience).
 *
 * Per-request, NOT a static env value — so it works automatically for
 * spacesangels.com, kendev.co, AND any vendor's own custom domain + its
 * subdomains. The platform's ease is replicable by everyone, including the
 * "geeky neighbor" standing up portals for people on their own domains.
 *
 * Returns `.<apex>` (e.g. ".spacesangels.com", ".vendor.com", ".vendor.co.uk")
 * or null when a Domain attribute must NOT be set:
 *   - localhost / *.localhost (browsers reject Domain on localhost)
 *   - bare IPs
 *   - platform/preview suffixes where each subdomain is its own site
 *     (*.vercel.app etc. are on the Public Suffix List — `.vercel.app` is rejected)
 *
 * Tenant isolation is enforced at the DATA layer (access control), not the
 * cookie — one identity across all portals; what you can SEE is gated per tenant.
 */

// Multi-part public suffixes where the registrable domain is the last THREE
// labels (e.g. vendor.co.uk, not co.uk). Small, common set — a full Public
// Suffix List is overkill here.
const MULTI_PART_TLDS = new Set([
  'co.uk', 'org.uk', 'gov.uk', 'ac.uk', 'me.uk',
  'com.au', 'net.au', 'org.au',
  'co.nz', 'co.za', 'co.jp', 'com.br', 'com.mx',
])

// Suffixes where each host is its OWN site — never set a shared Domain. (Cookies
// for these are rejected by browsers per the Public Suffix List.)
const HOST_ONLY_SUFFIXES = ['vercel.app', 'vercel.sh', 'netlify.app', 'pages.dev', 'workers.dev']

export function cookieDomainForHost(host: string | null | undefined): string | null {
  if (!host) return null
  const h = host.split(':')[0].trim().toLowerCase()
  if (!h) return null

  // localhost + dev subdomains → host-only.
  if (h === 'localhost' || h.endsWith('.localhost')) return null
  // Bare IPv4 / any IPv6 → host-only.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':')) return null
  // Platform/preview suffixes → host-only.
  if (HOST_ONLY_SUFFIXES.some((s) => h === s || h.endsWith(`.${s}`))) return null

  const labels = h.split('.')
  if (labels.length < 2) return null

  const lastTwo = labels.slice(-2).join('.')
  const apex =
    MULTI_PART_TLDS.has(lastTwo) && labels.length >= 3 ? labels.slice(-3).join('.') : lastTwo

  return `.${apex}`
}
