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

  // Second priority: Vercel custom domain (production)
  if (!url && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }

  // Third priority: Vercel deployment URL (preview/development)
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
    const protocol = request.headers.get('x-forwarded-proto') || 'https'
    
    if (host) {
      return `${protocol}://${host}`
    }
  }

  return getServerSideURL()
}
