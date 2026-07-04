'use client'

/**
 * TenantAutoSelector — Payload Admin Component
 *
 * Keeps the admin HOST and the selected TENANT in agreement, both directions:
 *
 * 1. host → tenant: automatically sets the `payload-tenant` cookie to the
 *    tenant whose slug matches the current hostname subdomain, so visiting
 *    cactus-farm.kendev.co/admin scopes the multi-tenant filter without a
 *    manual pick.
 * 2. tenant → host: when the tenant SELECTOR changes to a portal whose
 *    `domain` differs from the current host, follow the selection there
 *    (https://<domain>/admin). Without this, picking another portal in the
 *    chooser leaves you on the old host, and host-derived scoping (upload
 *    "choose existing", relation drawers) shows the WRONG portal's media.
 *    Cross-subdomain SSO carries the session within the same apex.
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

/** True for hosts where cross-domain hopping makes no sense (local dev). */
function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.localhost') ||
    /^(127\.|0\.0\.0\.0|::1)/.test(hostname)
  )
}

export function TenantAutoSelector(): null {
  // tenant → host: follow the tenant selector to the chosen portal's domain.
  useEffect(() => {
    if (isLocalHost(window.location.hostname)) return // dev serves every tenant on one host

    let prev = getCurrentTenantCookie()
    let busy = false

    const check = async () => {
      const current = getCurrentTenantCookie()
      if (busy || current === prev) return
      prev = current
      if (!current) return // "All tenants" — nothing to follow

      busy = true
      try {
        const res = await fetch(`/api/tenants/${encodeURIComponent(current)}?depth=0`)
        if (!res.ok) return
        const tenant = (await res.json()) as { domain?: string | null }
        const domain = (tenant?.domain || '').trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
        if (!domain || isLocalHost(domain)) return
        if (domain === window.location.hostname) return // already home

        // Keep a collection LIST path (it exists on every portal); a document
        // path belongs to the old tenant, so land on the dashboard instead.
        const path = /^\/admin\/collections\/[^/]+\/?$/.test(window.location.pathname)
          ? window.location.pathname
          : '/admin'
        window.location.assign(`https://${domain}${path}`)
      } catch {
        // Unreachable/forbidden tenant — stay put.
      } finally {
        busy = false
      }
    }

    const timer = window.setInterval(() => void check(), 800)
    return () => window.clearInterval(timer)
  }, [])

  // host → tenant: scope the admin to the subdomain's tenant on load.
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
