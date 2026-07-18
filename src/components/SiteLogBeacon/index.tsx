'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

/**
 * SiteLogBeacon — fires one cookieless page-view beacon per navigation to the
 * native Site Log collector (/api/site-log/collect). Uses navigator.sendBeacon so
 * it survives the page unloading and never blocks rendering. Mounted in the public
 * (app) layout; the server enriches each hit with tenant + Cloudflare geo.
 * @see src/endpoints/site-log-collect.ts
 */
export function SiteLogBeacon() {
  const pathname = usePathname()

  useEffect(() => {
    try {
      const path = pathname || window.location.pathname
      const body = JSON.stringify({ path, referrer: document.referrer || '' })
      const url = '/api/site-log/collect'
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }))
      } else {
        void fetch(url, {
          method: 'POST',
          body,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true,
        }).catch(() => {})
      }
    } catch {
      /* analytics must never break the page */
    }
  }, [pathname])

  return null
}
