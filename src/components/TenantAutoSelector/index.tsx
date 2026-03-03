'use client'

/**
 * TenantAutoSelector — Payload Admin Component
 *
 * Automatically sets the `payload-tenant` cookie to the tenant whose slug
 * matches the current hostname subdomain. This ensures that when a user
 * visits a tenant subdomain admin (e.g., cactus-farm.kendev.co/admin),
 * the multi-tenant plugin's data filter automatically scopes to that tenant
 * without requiring the user to manually select it via the tenant selector.
 *
 * Placed in `beforeNav` so it runs silently on every admin page load.
 * Uses sessionStorage to avoid reload loops.
 */
import { useEffect } from 'react'

const COOKIE_NAME = 'payload-tenant'
const SESSION_FLAG_PREFIX = 'tenant_auto_set_'

/** Extract the tenant slug from the current hostname, or null for main domains */
function getSubdomainSlug(): string | null {
  if (typeof window === 'undefined') return null
  const hostname = window.location.hostname

  const mainDomains = [
    'spacesangels.com',
    'www.spacesangels.com',
    'kendev.co',
    'www.kendev.co',
    'angels-os.kendev.co',
    'angel-os.kendev.co',
    'localhost',
    '127.0.0.1',
  ]
  if (mainDomains.includes(hostname)) return null

  // e.g. cactus-farm.localhost → 'cactus-farm'
  if (hostname.endsWith('.localhost')) {
    return hostname.slice(0, -'.localhost'.length) || null
  }

  // e.g. cactus-farm.kendev.co → parts[0] = 'cactus-farm'
  const parts = hostname.split('.')
  if (parts.length >= 3 && parts[0] !== 'www') return parts[0] || null

  return null
}

/** Read the current payload-tenant cookie value */
function getCurrentTenantCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)payload-tenant=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

/** Set the payload-tenant cookie (1-year expiry, path=/) */
function setTenantCookie(value: string): void {
  const maxAge = 60 * 60 * 24 * 365
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/`
}

export function TenantAutoSelector(): null {
  useEffect(() => {
    const slug = getSubdomainSlug()
    if (!slug) return // main domain — let user choose manually

    const sessionFlag = SESSION_FLAG_PREFIX + slug

    // Prevent reload loop: if we already ran this for this slug this session, stop
    if (sessionStorage.getItem(sessionFlag)) return

    const run = async () => {
      try {
        const res = await fetch(
          `/api/tenants?where[slug][equals]=${encodeURIComponent(slug)}&limit=1&depth=0`,
        )
        if (!res.ok) return

        const data = await res.json()
        const tenant = data?.docs?.[0]
        if (!tenant?.id) return

        const tenantId = String(tenant.id)
        const current = getCurrentTenantCookie()

        if (current !== tenantId) {
          // Mark before reload so we don't loop
          sessionStorage.setItem(sessionFlag, '1')
          setTenantCookie(tenantId)
          window.location.reload()
        } else {
          // Cookie already correct — mark so we don't check again this session
          sessionStorage.setItem(sessionFlag, '1')
        }
      } catch {
        // Network error or non-existent tenant — leave cookie as-is
      }
    }

    void run()
  }, [])

  return null
}
