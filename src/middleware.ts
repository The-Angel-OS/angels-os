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
 *
 * Matcher covers /api routes so that x-tenant-id is propagated to all Payload
 * API handlers and custom endpoints. For /api paths we skip next-intl's i18n
 * routing (which would incorrectly redirect API calls) and only inject the
 * tenant header, then pass straight through.
 */
const TENANT_HEADER = 'x-tenant-id'

const handleI18nRouting = createMiddleware(routing)

export default async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host')?.split(':')[0] ?? 'localhost'

  // Redirect legacy default. subdomain to www.
  if (hostname === 'default.spacesangels.com' || hostname.startsWith('default.')) {
    const wwwHost = hostname.replace(/^default\./, 'www.')
    const url = request.nextUrl.clone()
    url.host = wwwHost
    return NextResponse.redirect(url, 301)
  }

  const tenantId = detectTenantFromHostname(hostname)

  const requestHeaders = new Headers(request.headers)
  // Only set header if we resolved a tenant (null means platform/admin context)
  if (tenantId) {
    requestHeaders.set(TENANT_HEADER, tenantId)
  }

  // Propagate real client IP from Cloudflare for downstream rate limiting
  const cfIp = request.headers.get('cf-connecting-ip')
  if (cfIp) {
    requestHeaders.set('x-real-ip', cfIp)
  }

  // For /api and /admin routes: inject tenant header and pass through.
  // Do NOT run i18n routing — it would incorrectly locale-redirect these paths.
  // /admin needs x-tenant-id so the PayloadAdminLEO component and
  // any server-side admin rendering know the current tenant context.
  if (
    request.nextUrl.pathname.startsWith('/api') ||
    request.nextUrl.pathname.startsWith('/admin')
  ) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  const modifiedRequest = new NextRequest(request.url, { headers: requestHeaders })
  return handleI18nRouting(modifiedRequest)
}

export const config = {
  matcher: [
    /*
     * Match all pathnames except:
     * - _next, _vercel, static files
     * - /api/auth/complete, /api/auth/set-cookie (OAuth cookie endpoints —
     *   must be fully excluded so middleware never wraps/interferes with
     *   their Set-Cookie headers. See attempt #10 in auth/complete/route.ts)
     * NOTE: Both /api and /admin ARE included so that x-tenant-id is injected
     * into all Payload API requests and the admin panel. The /admin path is
     * handled like /api (header injection, no i18n routing) so that the
     * PayloadAdminLEO component and admin server rendering know the tenant.
     */
    '/((?!_next|_vercel|api/auth/complete|api/auth/set-cookie|.*\\..*).*)',
  ],
}
