'use client'

import type { PayloadAdminBarProps } from '@payloadcms/admin-bar'

import { cn } from '@/utilities/cn'
import { useSelectedLayoutSegments, useParams, usePathname } from 'next/navigation'
import { PayloadAdminBar } from '@payloadcms/admin-bar'
import React, { useState, useMemo } from 'react'
import { User } from '@/payload-types'
import Link from 'next/link'
import { ADMIN_ROLES } from '@/access/utilities'

const collectionLabels: Record<string, { plural: string; singular: string }> = {
  pages: { plural: 'Pages', singular: 'Page' },
  posts: { plural: 'Posts', singular: 'Post' },
  projects: { plural: 'Projects', singular: 'Project' },
  products: { plural: 'Products', singular: 'Product' },
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
}> = (props) => {
  const { adminBarProps } = props || {}
  const segments = useSelectedLayoutSegments()
  const params = useParams()
  const pathname = usePathname()
  const locale = (params?.locale as string) || 'en'
  const [show, setShow] = useState(false)

  // Detect current collection from route segments
  const segmentKey = segments?.[1] ?? segments?.[0]
  const collection = segmentKey && collectionLabels[segmentKey] ? segmentKey : 'pages'

  // Detect if we're on the brochure vs dashboard
  const isDashboard = pathname?.includes('/dashboard')

  const onAuthChange = React.useCallback((user: unknown) => {
    const typedUser = user as User
    const canSeeAdmin =
      typedUser?.roles &&
      Array.isArray(typedUser.roles) &&
      typedUser.roles.some((r) => ADMIN_ROLES.includes(r))
    setShow(Boolean(canSeeAdmin))
  }, [])

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
