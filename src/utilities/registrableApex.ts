/**
 * registrableApex — the public apex of a serving host, used to synthesize an
 * Endeavor's storefront URL when its tenant has no explicit domain.
 *
 *   www.spacesangels.com      → spacesangels.com
 *   federation.kendev.co      → kendev.co
 *   clearwater.spacesangels.com → spacesangels.com
 *
 * Naive last-two-labels (fine for our flat TLDs; no co.uk in play). Falls back
 * to spacesangels.com when the host is unknown (e.g. the gossip path with no
 * request). This replaces the hardcoded `PUBLIC_DOMAIN = 'spacesangels.com'`
 * that mislinked every kendev-node endeavor to the wrong apex.
 */
export function registrableApex(host?: string | null): string {
  if (!host) return 'spacesangels.com'
  const h = host.replace(/:\d+$/, '').replace(/^www\./, '').toLowerCase()
  const parts = h.split('.')
  return parts.length > 2 ? parts.slice(-2).join('.') : h
}

/**
 * Storefront URL for an endeavor's tenant, given the serving node's apex.
 * Guards the root tenant (slug === the apex's own label, e.g. `kendev` on
 * `kendev.co`) so we never emit the doubled `kendev.kendev.co` — the root
 * portal IS the apex, not a subdomain of it.
 */
export function synthesizeStorefront(slug: string | null | undefined, nodeApex: string): string | null {
  if (!slug || slug === 'default' || slug === 'platform') return null
  const apexLabel = nodeApex.split('.')[0]
  return slug === apexLabel ? `https://${nodeApex}` : `https://${slug}.${nodeApex}`
}

/** A real, public domain — not a .local dev alias or localhost. */
export const isPublicDomain = (d?: string | null): boolean =>
  !!d && !d.endsWith('.local') && !d.includes('localhost')

/** Strip a leading/embedded www. so we never emit slug.www.example.com. */
const stripWww = (d: string) => d.replace(/^www\./, '').replace(/\.www\./g, '.')

type DomainAlias = { domain?: string | null; isPrimary?: boolean | null }
type TenantLike = {
  domain?: string | null
  slug?: string | null
  domains?: DomainAlias[] | null
}

/**
 * The canonical PUBLIC storefront URL for a tenant on the serving node — the
 * single source of truth for outbound links, OG/canonical, and Discovery cards.
 *
 * Resolution (first match wins):
 *   1. a bound client domain marked `isPrimary` in `domains[]` (BYO custom domain)
 *   2. a real `domain` field (the tenant's claimed primary; `.local` is skipped —
 *      it's the dev/hosts-file alias, not a public URL)
 *   3. the federation domain persisted from a heartbeat (remote producers)
 *   4. synthesized `slug.<nodeApex>` — the config-free default for the 99% who
 *      never bind a domain (root-guarded so kendev never doubles)
 *
 * Inbound routing matches ALL bound domains (see detectTenant); only the
 * `isPrimary` one becomes the canonical OUTBOUND URL, so an unflagged alias can
 * resolve a request without hijacking the tenant's canonical identity.
 */
export function tenantStorefrontUrl(
  tenant: TenantLike | null,
  nodeApex: string,
  federationDomain?: string | null,
): string | null {
  const primaryAlias = (tenant?.domains || []).find(
    (a) => a?.isPrimary && isPublicDomain(a?.domain),
  )?.domain
  if (primaryAlias) return `https://${stripWww(primaryAlias)}`
  if (isPublicDomain(tenant?.domain)) return `https://${stripWww(tenant!.domain as string)}`
  if (isPublicDomain(federationDomain)) return `https://${stripWww(federationDomain as string)}`
  return synthesizeStorefront(tenant?.slug, nodeApex)
}
