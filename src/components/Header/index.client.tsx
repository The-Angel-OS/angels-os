'use client'
import { CMSLink } from '@/components/Link'
import { Cart } from '@/components/Cart'
import { OpenCartButton } from '@/components/Cart/OpenCart'
import Link from 'next/link'
import React, { Suspense, useMemo } from 'react'

import { MobileMenu } from './MobileMenu'
import type { Header, Media, Tenant } from '@/payload-types'

import { LogoIcon } from '@/components/icons/logo'
import { useAuth } from '@/providers/Auth'
import { usePathname } from 'next/navigation'
import { cn } from '@/utilities/cn'

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

const DASHBOARD_NAV_ITEM = {
  id: 'dashboard',
  link: {
    type: 'custom' as const,
    label: 'Dashboard',
    url: '/dashboard',
    newTab: false,
  },
}

export function HeaderClient({ header, tenant }: Props) {
  const { user } = useAuth()
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
    if (user) {
      if (!urls.has('/dashboard/spaces')) items.push(SPACES_NAV_ITEM)
      if (!urls.has('/dashboard')) items.push(DASHBOARD_NAV_ITEM)
    }
    return items
  }, [navItems, user])
  const tenantLogoUrl = (tenant?.branding?.logo as Media | null)?.url
  const logoUrl = tenantLogoUrl || defaultLogoUrl
  const pathname = usePathname()

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
              <ul className="hidden gap-5 text-xs font-medium uppercase tracking-wider md:flex md:items-center flex-wrap">
                {menu.map((item) => (
                  <li key={item.id}>
                    <CMSLink
                      {...item.link}
                      size={'clear'}
                      className={cn('relative navLink whitespace-nowrap', {
                        active:
                          item.link.url && item.link.url !== '/'
                            ? pathname.includes(item.link.url)
                            : false,
                      })}
                      appearance="nav"
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex justify-end flex-shrink-0 gap-4 items-center">
            {user ? (
              <>
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
