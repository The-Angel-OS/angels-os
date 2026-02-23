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

  // Development fallback
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return process.env.DEFAULT_TENANT_SLUG || 'default'
  }

  // Main platform domains return null (no tenant prefix)
  const mainPlatformDomains = [
    'spacesangels.com', 'www.spacesangels.com',
    'angels-os.kendev.co', 'angel-os.kendev.co', 'angels-os.vercel.app',
  ]
  if (mainPlatformDomains.includes(hostname)) {
    return null
  }

  // Extract subdomain from *.kendev.co pattern
  // e.g., clearwater-wellness.kendev.co → clearwater-wellness
  const parts = hostname.replace(/:\d+$/, '').split('.')
  
  // If we have at least 3 parts (subdomain.domain.tld), extract subdomain
  if (parts.length >= 3) {
    // For *.kendev.co, take everything before kendev.co
    const subdomain = parts.slice(0, -2).join('-').toLowerCase()
    return subdomain || null
  }

  // Fallback: use whole hostname as tenant slug
  return hostname.toLowerCase()
}
