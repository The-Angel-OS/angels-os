'use client'

/**
 * TenantCookieSync — Dashboard Component
 *
 * Ensures the `payload-tenant` cookie matches the current tenant context.
 * The multi-tenant plugin uses this cookie to scope REST API calls (GET /api/messages,
 * POST /api/media, etc.) to the correct tenant.
 *
 * Without this, the cookie may be stale from a previous session on a different
 * tenant subdomain, causing all client-side API calls to be scoped to the wrong
 * tenant (403 errors, missing messages, failed uploads).
 *
 * The server-side layout resolves the tenant from the x-tenant-id header (set by
 * middleware), then passes the tenant ID here. This component sets the cookie once
 * on mount — fast, invisible, no reload needed.
 */
import { useEffect } from 'react'

const COOKIE_NAME = 'payload-tenant'

export function TenantCookieSync({ tenantId }: { tenantId: string }) {
  useEffect(() => {
    if (!tenantId) return

    // Read current cookie
    const match = document.cookie.match(
      new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`),
    )
    const current = match ? decodeURIComponent(match[1]) : null

    // Only update if different — avoids unnecessary cookie writes
    if (current !== tenantId) {
      const maxAge = 60 * 60 * 24 * 365 // 1 year
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(tenantId)}; max-age=${maxAge}; path=/`
    }
  }, [tenantId])

  return null
}
