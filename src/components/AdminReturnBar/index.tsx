'use client'

/**
 * AdminReturnBar — "← Back to <where you came from>" inside the Payload admin.
 *
 * The dashboard sends people into /admin/collections/... to edit a booking, an
 * event, an availability slot. Payload has no idea a dashboard exists, so when
 * they finished they were stranded in the admin and had to navigate home by
 * hand — the most common complaint about an otherwise slick editor.
 *
 * Contract: link into the admin with `?returnTo=/dashboard/appointments` (and
 * optionally `&returnLabel=Appointments`). We stash it in sessionStorage on
 * arrival so the crumb survives the save → list → edit hops Payload does
 * internally, and clear it when it's used.
 *
 * Same-origin paths only: an absolute URL from a query string is an open
 * redirect, so anything not starting with a single "/" is ignored.
 */

import React, { useEffect, useState } from 'react'

const KEY = 'angel:admin:returnTo'

type Crumb = { href: string; label: string }

const isSafePath = (v: string) => v.startsWith('/') && !v.startsWith('//')

export function AdminReturnBar() {
  const [crumb, setCrumb] = useState<Crumb | null>(null)

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const href = params.get('returnTo')
      if (href && isSafePath(href)) {
        const next: Crumb = { href, label: params.get('returnLabel') || 'the dashboard' }
        sessionStorage.setItem(KEY, JSON.stringify(next))
        setCrumb(next)
        return
      }
      const stored = sessionStorage.getItem(KEY)
      if (stored) setCrumb(JSON.parse(stored) as Crumb)
    } catch {
      // A malformed crumb is not worth breaking the admin over.
    }
  }, [])

  if (!crumb) return null

  return (
    <a
      href={crumb.href}
      onClick={() => {
        try {
          sessionStorage.removeItem(KEY)
        } catch {
          /* no-op */
        }
      }}
      style={{
        display: 'block',
        padding: '8px 20px',
        fontSize: 13,
        textDecoration: 'none',
        borderBottom: '1px solid var(--theme-elevation-100)',
        color: 'var(--theme-text)',
      }}
    >
      ← Back to {crumb.label}
    </a>
  )
}
