'use client'
import { CMSLink } from '@/components/Link'
import { Cart } from '@/components/Cart'
import { OpenCartButton } from '@/components/Cart/OpenCart'
import { PortalSwitcher, type PortalInfo } from '@/components/PortalSwitcher'
import Link from 'next/link'
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react'

import { MobileMenu } from './MobileMenu'
import type { Header, Media, Tenant } from '@/payload-types'

import { LogoIcon } from '@/components/icons/logo'
import { useAuth } from '@/providers/Auth'
import { usePathname } from 'next/navigation'
import { cn } from '@/utilities/cn'
import { useClickOutside } from '@/hooks/useClickOutside'

// How many primary nav items stay inline before the rest collapse into "More ▾".
const MAX_INLINE_NAV = 6

type Props = {
  header: Header | null
  tenant?: Tenant | null
}

const defaultLogoUrl = '/logo.svg'

const POSTS_NAV_ITEM = {
  id: 'posts',
  link: {
    type: 'custom' as const,
    label: 'Posts',
    url: '/posts',
    newTab: false,
  },
}

const EVENTS_NAV_ITEM = {
  id: 'events',
  link: {
    type: 'custom' as const,
    label: 'Events',
    url: '/events',
    newTab: false,
  },
}

const SPACES_NAV_ITEM = {
  id: 'spaces',
  link: {
    type: 'custom' as const,
    label: 'Spaces',
    url: '/dashboard/spaces',
    newTab: false,
  },
}

const DISCOVER_NAV_ITEM = {
  id: 'discover',
  link: {
    type: 'custom' as const,
    label: 'Discover',
    url: '/federation/discover',
    newTab: false,
  },
}

const BOOK_NAV_ITEM = {
  id: 'book',
  link: {
    type: 'custom' as const,
    label: 'Book',
    url: '/book',
    newTab: false,
  },
}

const DONATE_NAV_ITEM = {
  id: 'donate',
  link: {
    type: 'custom' as const,
    label: 'Donate',
    url: '/donate',
    newTab: false,
  },
}

const DASHBOARD_NAV_ITEM = {
  id: 'dashboard',
  link: {
    type: 'custom' as const,
    label: 'Dashboard',
    url: '/dashboard',
    newTab: false,
  },
}

const LEARN_NAV_ITEM = {
  id: 'learn',
  link: {
    type: 'custom' as const,
    label: 'Learn',
    url: '/learn',
    newTab: false,
  },
}

export function HeaderClient({ header, tenant }: Props) {
  const { user } = useAuth()

  // Fetch the user's portals for the switcher (client-side, only when logged in).
  // Super-admins have global access, so the switcher lists ALL tenants for them —
  // not just rows they happen to have a membership for (which is why an endeavor
  // like WDEG could be missing). Everyone else sees their active memberships.
  const [userPortals, setUserPortals] = useState<PortalInfo[]>([])
  useEffect(() => {
    if (!user?.id) { setUserPortals([]); return }
    const toPortal = (t: any): PortalInfo | null => {
      if (!t || typeof t !== 'object') return null
      return {
        id: t.id,
        name: t.branding?.siteName || t.name || 'Unknown',
        slug: t.slug || '',
        domain: t.domain || '',
        logoUrl: typeof t.branding?.logo === 'object' && t.branding?.logo?.url ? t.branding.logo.url : null,
        primaryColor: t.branding?.primaryColor || null,
      }
    }
    const roles = (user as { roles?: string[] }).roles
    const isSuper = Array.isArray(roles) && roles.includes('super_admin')
    const req = isSuper
      ? fetch(`/api/tenants?limit=100&depth=1&sort=name`)
          .then((r) => r.json())
          .then((data) => (data.docs || []).map(toPortal))
      : fetch(`/api/tenant-memberships?where[user][equals]=${user.id}&where[status][equals]=active&depth=2&limit=50`)
          .then((r) => r.json())
          .then((data) => (data.docs || []).map((m: any) => toPortal(m.tenant)))
    req.then((portals) => setUserPortals(portals.filter(Boolean))).catch(() => {})
  }, [user?.id])

  // Stable reference: use navItems directly from the server-provided header prop.
  // The ?? [] was creating a new array ref every render when header was null,
  // which could cause useMemo to recompute unexpectedly.
  const navItems = header?.navItems
  const menu = useMemo(() => {
    const items = [...(navItems ?? [])]
    const urls = new Set(items.map((i) => i.link?.url))
    // Ensure Posts, Events, Docs always present (even if CMS omits them)
    if (!urls.has('/posts')) items.push(POSTS_NAV_ITEM)
    if (!urls.has('/events')) items.push(EVENTS_NAV_ITEM)
    if (!urls.has('/federation/discover')) items.push(DISCOVER_NAV_ITEM)
    if (!urls.has('/book')) items.push(BOOK_NAV_ITEM)
    // Donate is always visible — every endeavor can receive donations
    if (!urls.has('/donate')) items.push(DONATE_NAV_ITEM)
    if (!urls.has('/learn')) items.push(LEARN_NAV_ITEM)
    // Dashboard & Spaces are always visible — the dashboard layout handles auth redirect
    if (!urls.has('/dashboard/spaces')) items.push(SPACES_NAV_ITEM)
    if (!urls.has('/dashboard')) items.push(DASHBOARD_NAV_ITEM)
    return items
  }, [navItems])
  const tenantLogoUrl = (tenant?.branding?.logo as Media | null)?.url
  const logoUrl = tenantLogoUrl || defaultLogoUrl
  const pathname = usePathname()

  // Keep the primary items inline; collapse the rest into a "More ▾" dropdown so
  // the bar never wraps to a second row regardless of how many nav items exist.
  const primaryItems = menu.slice(0, MAX_INLINE_NAV)
  const overflowItems = menu.slice(MAX_INLINE_NAV)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef<HTMLLIElement>(null)
  useClickOutside(moreRef, () => setMoreOpen(false), moreOpen)
  useEffect(() => setMoreOpen(false), [pathname])

  const navLinkClass = (url?: string | null) =>
    cn('relative navLink whitespace-nowrap', {
      active: url && url !== '/' ? pathname.includes(url) : false,
    })

  return (
    <div className="relative z-20 border-b">
      <nav className="flex items-center md:items-end justify-between container pt-2">
        <div className="block flex-none md:hidden">
          <Suspense fallback={null}>
            <MobileMenu menu={menu} siteName={tenant?.branding?.siteName || tenant?.name || undefined} />
          </Suspense>
        </div>
        <div className="flex w-full items-end justify-between">
          <div className="flex w-full items-end gap-6 md:w-auto md:flex-1 min-w-0">
            <Link className="flex items-center justify-center pt-4 pb-4 flex-shrink-0" href="/">
              {tenantLogoUrl ? (
                <img src={tenantLogoUrl} alt={tenant?.branding?.siteName || tenant?.name || 'Home'} className="h-6 w-auto object-contain" />
              ) : (
                <LogoIcon className="w-6 h-auto" />
              )}
            </Link>
            {menu.length ? (
              <ul className="hidden gap-5 text-xs font-medium uppercase tracking-wider md:flex md:items-center flex-nowrap">
                {primaryItems.map((item) => (
                  <li key={item.id}>
                    <CMSLink
                      {...item.link}
                      size={'clear'}
                      className={navLinkClass(item.link.url)}
                      appearance="nav"
                    />
                  </li>
                ))}

                {overflowItems.length > 0 && (
                  <li className="relative" ref={moreRef}>
                    <button
                      type="button"
                      onClick={() => setMoreOpen((v) => !v)}
                      aria-expanded={moreOpen}
                      aria-haspopup="true"
                      className="navLink flex items-center gap-1 whitespace-nowrap uppercase tracking-wider"
                    >
                      More
                      <svg
                        className={cn('h-3 w-3 transition-transform', moreOpen && 'rotate-180')}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {moreOpen && (
                      <div className="absolute left-0 top-full z-50 mt-2 min-w-44 rounded-md border border-border bg-background py-1 shadow-lg">
                        {overflowItems.map((item) => (
                          <CMSLink
                            key={item.id}
                            {...item.link}
                            appearance="inline"
                            className={cn(
                              'block px-3 py-2 text-xs font-medium uppercase tracking-wider transition-colors hover:bg-muted',
                              item.link.url && item.link.url !== '/' && pathname.includes(item.link.url)
                                ? 'text-foreground'
                                : 'text-muted-foreground hover:text-foreground',
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </li>
                )}
              </ul>
            ) : null}
          </div>

          <div className="flex justify-end flex-shrink-0 gap-4 items-center">
            {user ? (
              <>
                {userPortals.length > 1 && (
                  <div className="hidden md:block">
                    <PortalSwitcher portals={userPortals} currentTenantId={tenant?.id} compact targetPath="/" />
                  </div>
                )}
                <Link href="/dashboard/account" className="hidden md:inline text-sm text-muted-foreground hover:text-foreground transition">
                  Account
                </Link>
                <Link href="/logout" className="hidden md:inline text-sm text-muted-foreground hover:text-foreground transition">
                  Logout
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="hidden md:inline text-sm text-muted-foreground hover:text-foreground transition">
                  Login
                </Link>
                <Link href="/create-account" className="hidden md:inline text-sm font-medium text-primary hover:text-primary/80 transition">
                  Sign Up
                </Link>
              </>
            )}
            <Suspense fallback={<OpenCartButton />}>
              <Cart />
            </Suspense>
          </div>
        </div>
      </nav>
    </div>
  )
}
