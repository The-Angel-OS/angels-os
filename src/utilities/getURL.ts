import canUseDOM from './canUseDOM'

/**
 * Get the current request's hostname (tenant-aware)
 * Note: This is a synchronous version that works in more contexts
 */
export const getCurrentHostname = () => {
  if (canUseDOM) {
    return window.location.hostname
  }

  // Server-side: Try to get from process.env or return null
  // The middleware will set proper headers for tenant resolution
  return null
}

/**
 * Get the current request's full URL (tenant-aware)
 */
export const getCurrentURL = () => {
  if (canUseDOM) {
    return window.location.origin
  }

  // Server-side: Use getServerSideURL for consistency
  return getServerSideURL()
}

export const getServerSideURL = () => {
  // First priority: Explicitly set NEXT_PUBLIC_SERVER_URL
  let url = process.env.NEXT_PUBLIC_SERVER_URL

  // Second priority: PAYLOAD_PUBLIC_SERVER_URL (Payload-specific, often set on Vercel)
  if (!url && process.env.PAYLOAD_PUBLIC_SERVER_URL) {
    return process.env.PAYLOAD_PUBLIC_SERVER_URL
  }

  // Third priority: Vercel custom domain (production)
  if (!url && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  // Fourth priority: Vercel deployment URL (preview/development)
  if (!url && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  // Fallback: localhost for local development
  if (!url) {
    url = 'http://localhost:3000'
  }

  return url
}

export const getClientSideURL = () => {
  // Client-side: Use current window location (always tenant-aware)
  if (canUseDOM) {
    return window.location.origin
  }

  // Server-side: Use same logic as getServerSideURL for consistency
  return getServerSideURL()
}

/**
 * The registrable apex this node hangs tenant subdomains off, e.g. "payloadnuke.com"
 * on self-host or "spacesangels.com" on Vercel. Derived from NEXT_PUBLIC_SERVER_URL
 * (same source payload.config.ts uses for CORS) so a provisioned portal's domain is
 * actually reachable at <slug>.<suffix>. Falls back to "angelos.local" only when no
 * server URL is configured at all.
 */
export const getPortalDomainSuffix = (): string => {
  try {
    const host = new URL(getServerSideURL()).hostname.replace(/^(www|platform)\./, '')
    if (host && host !== 'localhost') return host
  } catch {
    /* malformed URL — fall through */
  }
  return 'angelos.local'
}

/**
 * Get tenant-specific URL for a given hostname
 * Useful for generating URLs for specific tenants
 */
export const getTenantURL = (hostname: string, path: string = '') => {
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const baseUrl = `${protocol}://${hostname}`
  return path ? `${baseUrl}${path.startsWith('/') ? path : `/${path}`}` : baseUrl
}

/**
 * Build URL with current tenant context
 * Preserves the current domain/subdomain for multi-tenant routing
 */
export const buildTenantAwareURL = (path: string = '') => {
  const baseUrl = getCurrentURL()
  return path ? `${baseUrl}${path.startsWith('/') ? path : `/${path}`}` : baseUrl
}

/**
 * Get tenant-aware URL using headers (for server components)
 * This version can access request headers when available
 */
export const getTenantAwareURLFromHeaders = (request?: Request) => {
  if (canUseDOM) {
    return window.location.origin
  }

  if (request) {
    const host = request.headers.get('host') || request.headers.get('x-forwarded-host')
    // Cloudflare/proxies may chain proto values (e.g. "https, http") — take the first
    const protocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() || 'https'
    
    if (host) {
      return `${protocol}://${host}`
    }
  }

  return getServerSideURL()
}
