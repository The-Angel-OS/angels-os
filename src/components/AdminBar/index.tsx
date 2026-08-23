'use client'

import type { PayloadAdminBarProps } from '@payloadcms/admin-bar'

import { cn } from '@/utilities/cn'
import { useSelectedLayoutSegments, useParams, usePathname } from 'next/navigation'
import { PayloadAdminBar } from '@payloadcms/admin-bar'
import React, { useState, useMemo } from 'react'
import Link from 'next/link'

const collectionLabels: Record<string, { plural: string; singular: string }> = {
  pages: { plural: 'Pages', singular: 'Page' },
  posts: { plural: 'Posts', singular: 'Post' },
  projects: { plural: 'Projects', singular: 'Project' },
  products: { plural: 'Products', singular: 'Product' },
  events: { plural: 'Events', singular: 'Event' },
}

/**
 * Collections whose LISTING root offers a "New …" button.
 *
 * Only the ones an owner adds to regularly. Pages are created rarely, and
 * `/` is the home page rather than a listing anyway, so there is no root to
 * put the button on.
 */
const CREATABLE_AT_ROOT = ['posts', 'products', 'events'] as const

/**
 * Route segment → collection, where the URL does not match the collection name.
 *
 * The product LISTING lives at /shop while a product DOCUMENT lives at
 * /products/<slug>, so keying off the segment alone missed the shop entirely —
 * which is the listing an owner adds to most.
 */
const ROUTE_ALIASES: Record<string, string> = { shop: 'products' }

const collectionForSegment = (seg: string): string | undefined =>
  collectionLabels[seg] ? seg : ROUTE_ALIASES[seg]

/**
 * Where the "+ New" button points, or null when it should not appear.
 *
 * Exported so the routing rule can be tested without rendering the bar: the
 * whole point is which URL you land on, and that is easy to get subtly wrong
 * (a document page is not a listing root, /posts/page/2 is not either).
 */
export function newDocHrefFor(segments: string[], pathname: string): string | null {
  const index = segments.findIndex((seg) => Boolean(collectionForSegment(seg)))
  if (index < 0) return null
  // A listing ROOT — the collection segment is the last one. On a document
  // (/posts/my-post) or a pagination page (/posts/page/2) the edit link already
  // has somewhere to go.
  if (index !== segments.length - 1) return null
  const collection = collectionForSegment(segments[index]!)!
  if (!(CREATABLE_AT_ROOT as readonly string[]).includes(collection)) return null
  const label = collectionLabels[collection]!.plural
  return `/admin/collections/${collection}/create?returnTo=${encodeURIComponent(
    pathname || `/${collection}`,
  )}&returnLabel=${encodeURIComponent(label)}`
}

const Title: React.FC = () => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
    <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="16" cy="8" rx="8" ry="3" stroke="#f5a623" strokeWidth="2" fill="none" />
      <path d="M16 14 C10 14, 4 18, 2 26 C6 22, 10 20, 16 20" stroke="#f5a623" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M16 14 C22 14, 28 18, 30 26 C26 22, 22 20, 16 20" stroke="#f5a623" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
    Angel OS
  </span>
)

/**
 * AdminBar — brochure-layer admin toolbar.
 *
 * Shows PayloadAdminBar (auth + edit link) plus:
 * - Current page type indicator (Page, Post, Product)
 * - Dashboard / Admin toggle buttons
 * - Edit link that constructs admin URL from current route segments
 */
export const AdminBar: React.FC<{
  adminBarProps?: PayloadAdminBarProps
  /** Resolved on the server: does this viewer manage the portal being viewed? */
  canManage?: boolean
}> = (props) => {
  const { adminBarProps, canManage = false } = props || {}
  const segments = useSelectedLayoutSegments()
  const params = useParams()
  const pathname = usePathname()
  const locale = (params?.locale as string) || 'en'
  const [show, setShow] = useState(false)

  // Detect current collection from route segments.
  //
  // This used to read `segments[1] ?? segments[0]`, but ?? only falls back on
  // null/undefined — so on /posts/my-post it picked "my-post", which is not a
  // collection, and the bar quietly labelled a post as a Page with no badge.
  // Take the first segment that IS a known collection instead.
  const collectionIndex = (segments || []).findIndex((seg) => Boolean(collectionForSegment(seg)))
  const segmentKey = collectionIndex >= 0 ? collectionForSegment(segments[collectionIndex]!) : undefined
  const collection = segmentKey || 'pages'

  const newDocHref = newDocHrefFor(segments || [], pathname || '')

  // Detect if we're on the brochure vs dashboard
  const isDashboard = pathname?.includes('/dashboard')

  // The server already worked out whether this viewer manages THIS portal —
  // an answer the platform roles array cannot give, since a portal's own
  // tenant_admin holds none of them and was shown no admin bar on their own
  // site. Auth still drives appearance so the bar goes away on sign-out
  // without needing a reload.
  const onAuthChange = React.useCallback(
    (user: unknown) => {
      setShow(Boolean(user) && canManage)
    },
    [canManage],
  )

  // Build page type label from segments
  const pageTypeLabel = useMemo(() => {
    if (!segmentKey) return null
    const labels = collectionLabels[segmentKey]
    return labels ? labels.singular : null
  }, [segmentKey])

  const cmsURL = process.env.NEXT_PUBLIC_SERVER_URL || ''

  return (
    <div
      className={cn('py-2 bg-sidebar text-sidebar-foreground', {
        block: show,
        hidden: !show,
      })}
    >
      <div className="container flex items-center justify-between gap-4">
        <PayloadAdminBar
          {...adminBarProps}
          className="py-2 text-white flex-1"
          classNames={{
            controls: 'font-medium text-white',
            logo: 'text-white',
            user: 'text-white',
          }}
          cmsURL={cmsURL}
          collectionLabels={{
            plural: collectionLabels[collection]?.plural || 'Pages',
            singular: collectionLabels[collection]?.singular || 'Page',
          }}
          logo={<Title />}
          onAuthChange={onAuthChange}
          style={{
            backgroundColor: 'transparent',
            padding: 0,
            position: 'relative',
            zIndex: 'unset',
          }}
        />

        {/* Page type badge + navigation buttons */}
        <div className="flex items-center gap-2 text-xs">
          {/* Current page type indicator */}
          {pageTypeLabel && (
            <span className="rounded px-2 py-1 font-mono text-[10px] uppercase tracking-wider"
              style={{ background: 'rgba(245, 166, 35, 0.15)', color: '#f5a623' }}>
              {pageTypeLabel}
            </span>
          )}

          {/* On a listing root there is no document to edit — offer to add one.
              returnTo hands AdminReturnBar the way back out of the editor. */}
          {newDocHref && (
            <Link
              href={newDocHref}
              className="rounded px-2 py-1 font-semibold transition-opacity hover:opacity-90"
              style={{ background: '#f5a623', color: '#1a1a1a' }}
            >
              + New {collectionLabels[collection]!.singular}
            </Link>
          )}

          {/* Toggle: show Dashboard link when on brochure, show Site link when on dashboard */}
          {isDashboard ? (
            <Link
              href="/"
              className="rounded px-2 py-1 font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              View Site
            </Link>
          ) : (
            <Link
              href={`/${locale}/dashboard`}
              className="rounded px-2 py-1 font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              Dashboard
            </Link>
          )}

          <Link
            href="/admin"
            className="rounded px-2 py-1 font-medium text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            style={{ borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '8px' }}
          >
            Admin
          </Link>
        </div>
      </div>
    </div>
  )
}
