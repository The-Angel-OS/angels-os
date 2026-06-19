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
