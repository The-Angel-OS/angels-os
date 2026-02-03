import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'

/**
 * Angel OS Multi-Domain + i18n Middleware (Finly Pattern)
 *
 * Combines next-intl locale routing with hostname-based x-tenant-id injection.
 * See: https://finly.ch/engineering-blog/678698-zero-code-campaigns-how-we-built-a-multi-domain-lead-gen-engine-for-advisors
 */
const TENANT_HEADER = 'x-tenant-id'

function resolveTenantFromHostname(hostname: string): string {
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

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return process.env.DEFAULT_TENANT_SLUG || 'default'
  }

  const parts = hostname.replace(/:\d+$/, '').split('.')
  if (parts.length >= 2) {
    return parts.slice(0, -1).join('-').toLowerCase()
  }
  return hostname.toLowerCase()
}

const handleI18nRouting = createMiddleware(routing)

export default async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host')?.split(':')[0] ?? 'localhost'
  const tenantId = resolveTenantFromHostname(hostname)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(TENANT_HEADER, tenantId)

  const modifiedRequest = new NextRequest(request.url, { headers: requestHeaders })
  return handleI18nRouting(modifiedRequest)
}

export const config = {
  matcher: [
    /*
     * Match all pathnames except:
     * - /admin (Payload CMS)
     * - /api (Payload API, Next.js API)
     * - _next, _vercel, static files
     */
    '/((?!admin|api|_next|_vercel|.*\\..*).*)',
  ],
}
