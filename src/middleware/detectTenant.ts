/**
 * Tenant Detection Middleware
 * 
 * Detects tenant from hostname for multi-tenant wildcard subdomain routing.
 * Supports *.kendev.co pattern with special handling for main platform domains.
 * 
 * Examples:
 *   clearwater-wellness.kendev.co → "clearwater-wellness"
 *   angels-os.kendev.co → null (main platform)
 *   localhost → env.DEFAULT_TENANT_SLUG (development)
 */

/**
 * Subdomains that are platform/infrastructure context, NEVER a tenant slug.
 * A tenant can't be named any of these (and shouldn't want to).
 */
const RESERVED_SUBDOMAINS = new Set(['www', 'platform', 'app', 'admin', 'default', 'api'])

export function detectTenantFromHostname(hostname: string): string | null {
  // Check explicit tenant domain mappings from env
  const mapping = process.env.TENANT_DOMAINS
  if (mapping) {
    const pairs = mapping.split(',').map((s) => s.trim())
    for (const pair of pairs) {
      const [domain, slug] = pair.split(':').map((s) => s.trim())
      if (domain && slug && (hostname === domain || hostname.endsWith(`.${domain}`))) {
        return slug
      }
    }
  }

  // Development — exact localhost is platform context (no tenant).
  // Use *.localhost subdomains (e.g. clearwater-cruisin.localhost) to test
  // tenant-specific pages locally. Set DEFAULT_TENANT_SLUG only if you want
  // bare localhost to always resolve to a specific tenant.
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return process.env.DEFAULT_TENANT_SLUG || null
  }

  // Development subdomain — e.g. clearwater-cruisin.localhost
  // Chrome resolves *.localhost → 127.0.0.1 for local multi-tenant testing.
  // Strip the .localhost TLD to get the tenant slug directly.
  if (hostname.endsWith('.localhost')) {
    const subdomain = hostname.slice(0, -'.localhost'.length)
    return subdomain || process.env.DEFAULT_TENANT_SLUG || 'default'
  }

  // Main platform domains return null (no tenant prefix). spacesangels.com is THE
  // canonical apex (260725 consolidation — every tenant domain lives there);
  // payloadnuke.com still resolves (Merlin's tunnel + old links) and kendev.co is
  // the commercial apex, both served by the same codebase. Tenant lookup is by
  // SUBDOMAIN SLUG, apex-agnostic — so a tenant is reachable at any of them.
  const mainPlatformDomains = [
    'spacesangels.com', 'www.spacesangels.com', 'default.spacesangels.com',
    'payloadnuke.com', 'www.payloadnuke.com', 'platform.payloadnuke.com',
    'kendev.co', 'www.kendev.co', 'discordant.kendev.co',
    'angels-os.kendev.co', 'angel-os.kendev.co', 'angels-os.vercel.app',
  ]
  if (mainPlatformDomains.includes(hostname)) {
    return null
  }

  // Extract subdomain from *.kendev.co pattern
  // e.g., clearwater-wellness.kendev.co → clearwater-wellness
  const parts = hostname.replace(/:\d+$/, '').split('.')

  // Reject bare IP addresses (e.g. 192.168.1.1) — platform context
  if (parts.every((p) => /^\d+$/.test(p))) {
    return process.env.DEFAULT_TENANT_SLUG || null
  }

  // If we have at least 3 parts (subdomain.domain.tld), extract subdomain
  if (parts.length >= 3) {
    // Reserved infrastructure subdomains are PLATFORM context, not tenants — so
    // platform.spacesangels.com behaves exactly like www.spacesangels.com.
    // (Before, only 'www' was skipped, so 'platform' was parsed as a tenant slug
    // → it resolved to a different/empty context: the "Kenneth sees no channels
    // on platform.* but Tyler does on www.*" bug.)
    if (RESERVED_SUBDOMAINS.has(parts[0])) return null
    // For *.kendev.co, take everything before kendev.co
    const subdomain = parts.slice(0, -2).join('-').toLowerCase()
    return subdomain || null
  }

  // Unknown 2-part pattern (e.g. unknown.com) — don't guess, return null
  return null
}
