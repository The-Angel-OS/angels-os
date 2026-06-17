'use client'
import { Cart } from '@/components/Cart'
import { OpenCartButton } from '@/components/Cart/OpenCart'
import { PortalSwitcher, type PortalInfo } from '@/components/PortalSwitcher'
import Link from 'next/link'
import React, { Suspense, useEffect, useMemo, useState } from 'react'

import { MobileMenu } from './MobileMenu'
import { AccountMenu } from './AccountMenu'
import type { Header, Media, Tenant } from '@/payload-types'

import { AngelIcon } from '@/components/icons/AngelIcon'
import { useAuth } from '@/providers/Auth'
import { usePresence } from '@/hooks/usePresence'
import { usePathname } from 'next/navigation'
import { cn } from '@/utilities/cn'
import { partitionNavItems } from '@/utilities/navPartition'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu'

// How many primary nav items stay inline before the rest collapse into "More ▾".
const MAX_INLINE_NAV = 6

type Props = {
  header: Header | null
  tenant?: Tenant | null
  /** Shop is first-class only when there are products; else it collapses to More. */
  hasProducts?: boolean
  /** Events is first-class only when there are events; else it collapses to More. */
  hasEvents?: boolean
  /** Posts is first-class only when there are published posts; else it collapses to More. */
  hasPosts?: boolean
  /** Works/Library is first-class only when the tenant has works; else it collapses to More. */
  hasWorks?: boolean
}

const defaultLogoUrl = '/logo.svg'

const HOME_NAV_ITEM = {
  id: 'home',
  link: {
    type: 'custom' as const,
    label: 'Home',
    url: '/',
    newTab: false,
  },
}
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

const WORKS_NAV_ITEM = {
  id: 'works',
  link: {
    type: 'custom' as const,
    label: 'Works',
    url: '/works',
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
    label: 'Discovery', // shuttle nomenclature: Enterprise · Endeavor · Discovery
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

// Resolve an href from a nav item's link, mirroring CMSLink's reference/custom logic.
function resolveHref(link: { type?: string | null; url?: string | null; reference?: any } | undefined): string {
  if (!link) return '#'
  if (link.type === 'reference' && link.reference && typeof link.reference.value === 'object') {
    const rel = link.reference.relationTo
    const slug = link.reference.value?.slug
    if (slug) return `${rel !== 'pages' ? `/${rel}` : ''}/${slug}`
  }
  return link.url || '#'
}

export function HeaderClient({ header, tenant, hasProducts = true, hasEvents = true, hasPosts = true, hasWorks = false }: Props) {
  const { user } = useAuth()

  // Editors get an "Edit this page" link in the Portal Switcher. Gated on an
  // admin-ish global role; the resolver endpoint + Payload admin are the final
  // access gate, so this only decides whether to offer the affordance.
  const canEditContent = useMemo(() => {
    const roles = (user as { roles?: string[] } | null)?.roles
    return Array.isArray(roles) && roles.some((r) => /super_admin|admin|editor|owner/i.test(r))
  }, [user])

  // Presence — marks this user online + counts who else is, site-wide.
  const { count: onlineCount, isOnline } = usePresence({ enabled: Boolean(user) })

  // Fetch the user's portals for the switcher (client-side, only when logged in).
  // Super-admins have global access, so the switcher lists ALL tenants for them —
  // not just rows they happen to have a membership for (which is why an endeavor
  // like WDEG could be missing). Everyone else sees their active + pending
  // memberships (pending so invited users can navigate to the portal and accept).
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
      : fetch(`/api/tenant-memberships?where[user][equals]=${user.id}&where[status][in][0]=active&where[status][in][1]=pending&depth=2&limit=50`)
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
    // Home is always present and always FIRST — the appended defaults below never
    // include it, so when the header doc fails to load (or omits Home) the nav
    // would otherwise have no Home link at all (only the logo). Guarantee it.
    if (!urls.has('/')) items.unshift(HOME_NAV_ITEM)
    // Ensure Posts, Events, Docs always present (even if CMS omits them)
    if (!urls.has('/posts')) items.push(POSTS_NAV_ITEM)
    if (!urls.has('/events')) items.push(EVENTS_NAV_ITEM)
    if (!urls.has('/federation/discover')) items.push(DISCOVER_NAV_ITEM)
    if (!urls.has('/book')) items.push(BOOK_NAV_ITEM)
    // Donate is always visible — every endeavor can receive donations
    if (!urls.has('/donate')) items.push(DONATE_NAV_ITEM)
    if (!urls.has('/works')) items.push(WORKS_NAV_ITEM)
    if (!urls.has('/learn')) items.push(LEARN_NAV_ITEM)
    // Dashboard & Spaces are always visible — the dashboard layout handles auth redirect
    if (!urls.has('/dashboard/spaces')) items.push(SPACES_NAV_ITEM)
    if (!urls.has('/dashboard')) items.push(DASHBOARD_NAV_ITEM)
    return items
  }, [navItems])
  const tenantLogoUrl = (tenant?.branding?.logo as Media | null)?.url
  const logoUrl = tenantLogoUrl || defaultLogoUrl
  const pathname = usePathname()

  // Keep primary items inline; collapse the rest into "More ▾". Dashboard always
  // lives in More; Shop/Posts/Events demote to More until they're populated (then
  // they become first-class automatically, since the flags come from live counts).
  const demoteUrls: string[] = []
  if (!hasProducts) demoteUrls.push('/shop')
  if (!hasEvents) demoteUrls.push('/events')
  if (!hasPosts) demoteUrls.push('/posts')
  if (!hasWorks) demoteUrls.push('/works')
  const { primary: primaryItems, overflow: overflowItems } = partitionNavItems(menu, {
    maxInline: MAX_INLINE_NAV,
    forcePrimaryUrls: ['/federation/discover'], // Discovery is always top-level
    forceOverflowUrls: ['/dashboard'],
    demoteUrls,
  })

  const isActive = (url?: string | null) =>
    url && url !== '/' ? pathname.includes(url) : false

  // Shared classes so NavigationMenu links keep the existing uppercase nav look.
  const navItemClass =
    'navLink h-auto bg-transparent px-0 text-xs font-medium uppercase tracking-wider whitespace-nowrap hover:bg-transparent focus:bg-transparent data-[state=open]:bg-transparent'

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
                <AngelIcon className="h-7 w-7 text-[#f5a623]" />
              )}
            </Link>
            {menu.length ? (
              <NavigationMenu viewport={false} className="hidden md:flex justify-start">
                {/* justify-start (not the shadcn default justify-center) = left-aligned,
                    and direction-aware: it flips to the right under dir="rtl" (Arabic). */}
                <NavigationMenuList className="gap-5 justify-start">
                  {primaryItems.map((item) => {
                    // Hierarchical: any item with children renders as a dropdown
                    // (the parent stays reachable as the first entry), so Pages
                    // hang under Home and any future parent gets the same treatment.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const children: any[] = Array.isArray((item as any).children) ? (item as any).children : []
                    if (children.length > 0) {
                      return (
                        <NavigationMenuItem key={item.id}>
                          <NavigationMenuTrigger className={cn(navigationMenuTriggerStyle(), navItemClass)}>
                            {item.link.label}
                          </NavigationMenuTrigger>
                          <NavigationMenuContent>
                            <ul className={cn('grid gap-0.5 p-2 text-start', children.some((c: { image?: string }) => c.image) ? 'w-72' : 'w-56')}>
                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                              {([item, ...children] as any[]).map((c: any, ci: number) => (
                                <li key={c.id || `${item.id}-c${ci}`}>
                                  <NavigationMenuLink
                                    asChild
                                    active={isActive(c.link?.url)}
                                    // flex-row is required: the shadcn NavigationMenuLink base
                                    // class sets flex-col, which (without an explicit row) stacks
                                    // the thumbnail above a centered label. flex-row restores the
                                    // left-aligned icon+label row that matches the More dropdown.
                                    className="flex flex-row w-full items-center justify-start gap-2 rounded-md px-2 py-1.5 text-start text-xs font-medium uppercase tracking-wider"
                                  >
                                    <Link
                                      href={resolveHref(c.link)}
                                      {...(c.link?.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                    >
                                      {c.image ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={c.image}
                                          alt=""
                                          className="h-8 w-8 flex-shrink-0 rounded object-cover"
                                          // A missing/dead thumbnail variant (older uploads whose
                                          // sizes.thumbnail blob no longer exists) would show a torn-
                                          // image icon. Hide it instead so the label stands alone.
                                          onError={(e) => {
                                            e.currentTarget.style.display = 'none'
                                          }}
                                        />
                                      ) : null}
                                      <span className={cn('min-w-0 truncate text-start', c.image && 'normal-case')}>{c.link?.label}</span>
                                    </Link>
                                  </NavigationMenuLink>
                                </li>
                              ))}
                            </ul>
                          </NavigationMenuContent>
                        </NavigationMenuItem>
                      )
                    }
                    return (
                      <NavigationMenuItem key={item.id}>
                        <NavigationMenuLink
                          asChild
                          active={isActive(item.link.url)}
                          className={cn(navigationMenuTriggerStyle(), navItemClass)}
                        >
                          <Link
                            href={resolveHref(item.link)}
                            {...(item.link.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                          >
                            {item.link.label}
                          </Link>
                        </NavigationMenuLink>
                      </NavigationMenuItem>
                    )
                  })}

                  {overflowItems.length > 0 && (
                    <NavigationMenuItem>
                      <NavigationMenuTrigger className={cn(navigationMenuTriggerStyle(), navItemClass)}>
                        More
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ul className="grid w-56 gap-0.5 p-2 text-start">
                          {overflowItems.map((item) => (
                            <li key={item.id}>
                              <NavigationMenuLink
                                asChild
                                active={isActive(item.link.url)}
                                className="block rounded-md px-3 py-2 text-xs font-medium uppercase tracking-wider text-start"
                              >
                                <Link
                                  href={resolveHref(item.link)}
                                  {...(item.link.newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                                >
                                  {item.link.label}
                                </Link>
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </NavigationMenuContent>
                    </NavigationMenuItem>
                  )}
                </NavigationMenuList>
              </NavigationMenu>
            ) : null}
          </div>

          <div className="flex justify-end flex-shrink-0 gap-4 items-center">
            {user ? (
              <>
                {(userPortals.length > 1 || canEditContent) && (
                  <div className="hidden md:block">
                    <PortalSwitcher
                      portals={userPortals}
                      currentTenantId={tenant?.id}
                      compact
                      targetPath="/"
                      showEditLink={canEditContent}
                    />
                  </div>
                )}
                {onlineCount > 0 && (
                  <span
                    className="hidden items-center gap-1.5 rounded-full bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground lg:inline-flex"
                    title={`${onlineCount} online now`}
                  >
                    <span className="h-2 w-2 rounded-full bg-emerald-500 [animation:pulse_2s_ease-in-out_infinite]" />
                    {onlineCount} online
                  </span>
                )}
                <div className="hidden md:block">
                  <AccountMenu
                    name={(user as { name?: string | null }).name}
                    email={(user as { email?: string | null }).email}
                    online={isOnline}
                  />
                </div>
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
