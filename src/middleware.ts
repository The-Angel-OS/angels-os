import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'
import { detectTenantFromHostname } from './middleware/detectTenant'

/**
 * Angel OS Multi-Domain + i18n Middleware (Finly Pattern)
 *
 * Combines next-intl locale routing with hostname-based x-tenant-id injection.
 * Tenant detection delegated to detectTenant.ts for wildcard subdomain support.
 * See: https://finly.ch/engineering-blog/678698-zero-code-campaigns-how-we-built-a-multi-domain-lead-gen-engine-for-advisors
 */
const TENANT_HEADER = 'x-tenant-id'

const handleI18nRouting = createMiddleware(routing)

export default async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host')?.split(':')[0] ?? 'localhost'
  const tenantId = detectTenantFromHostname(hostname)

  const requestHeaders = new Headers(request.headers)
  // Only set header if we resolved a tenant (null means platform/admin context)
  if (tenantId) {
    requestHeaders.set(TENANT_HEADER, tenantId)
  }

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
