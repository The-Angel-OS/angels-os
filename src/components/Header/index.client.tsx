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
  canEditContent?: boolean
  /** Book is first-class only when the tenant has an enabled bookable service. */
  hasBook?: boolean
  /**
   * Whether to show the federation "Discovery" link. Driven by the Endeavor's
   * "Show in Discovery" toggle (endeavor.federation.networkVisible). When
   * undefined (no Endeavor configured yet) we fall back to the businessType
   * inference so un-configured community sites don't lose the link.
   */
  showDiscovery?: boolean
  /**
   * The join page, when this tenant has an active membership plan. Lifted to a
   * top-level primary item for the same reason /book and /shop are: it is how
   * the endeavor earns, so it is never buried in More — or, as it was on
   * Clearwater, nested three deep under Home behind five product listings.
   */
  membership?: { url: string; label: string } | null
  /** Owner overrides on the derived menu: hide, pin, inline cap. */
  navOverrides?: { hidden: string[]; pinned: string[]; maxInline?: number; hideMore?: boolean }
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

export function HeaderClient({ canEditContent: canEditContentProp = false, header, tenant, hasProducts = true, hasEvents = true, hasPosts = true, hasWorks = false, hasBook = true, showDiscovery, membership, navOverrides }: Props) {
  const { user } = useAuth()

  // "Edit this page" is now decided on the SERVER, because the answer depends on
  // the viewer's membership role on THIS portal — not on their platform roles.
  // Reading the roles array alone meant a portal's own tenant_admin never got
  // the affordance on their own site, while a platform editor got it on
  // everyone's. The resolver endpoint and Payload admin remain the real gate;
  // this only decides whether to offer the link.
  const canEditContent = canEditContentProp

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
        isGuardianAngel: Boolean(t.isGuardianAngel),
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
  // A commercial storefront (HVAC, mover, retail, etc.) should NOT surface the
  // platform/mission chrome — Donate, the Works library, and Learn belong to
  // community/ministry endeavors, not a customer-facing shop. Suppressing them
  // here stops that cross-barrier leak. (Dashboard stays — the owner needs to log
  // in — but it always lives in the "More" overflow anyway.) Discovery is handled
  // separately below via its own explicit toggle.
  const businessType = (tenant as { businessType?: string } | null | undefined)?.businessType
  const isStorefront = ['service', 'retail', 'professional_services', 'artisan_maker', 'gift_shop'].includes(businessType || '')
  // The Discovery link is an explicit switch: the Endeavor's "Show in Discovery"
  // toggle (showDiscovery) wins when set. When it's undefined (no Endeavor yet)
  // fall back to the old behavior — visible for any non-storefront community site.
  const discoveryEnabled = showDiscovery ?? !isStorefront
  // A giving org (church/ministry/nonprofit) gets Giving promoted to top-level; for
  // any other community site the link still exists but stays in More until configured.
  // Label flips to "Giving" for a church/ministry, "Donate" otherwise.
  const isGivingOrg = ['ministry', 'nonprofit'].includes(businessType || '')
  const donateItem = useMemo(
    () => (businessType === 'ministry'
      ? { ...DONATE_NAV_ITEM, link: { ...DONATE_NAV_ITEM.link, label: 'Giving' } }
      : DONATE_NAV_ITEM),
    [businessType],
  )
  const menu = useMemo(() => {
    const items = [...(navItems ?? [])]
    const urls = new Set(items.map((i) => i.link?.url))
    // Home is always present and always FIRST — the appended defaults below never
    // include it, so when the header doc fails to load (or omits Home) the nav
    // would otherwise have no Home link at all (only the logo). Guarantee it.
    if (!urls.has('/')) items.unshift(HOME_NAV_ITEM)
    // Ensure Posts, Events always present (even if CMS omits them)
    // Insert right AFTER Home, not appended. forcePrimaryUrls only reorders the
    // desktop split; the mobile sheet renders `menu` in raw order, so pushing it
    // to the end moved the join link from 3rd to 16th of 25 — past every product
    // and post. Position in this array IS the mobile position.
    if (membership && !urls.has(membership.url)) {
      const item = { link: { type: 'custom', label: membership.label, url: membership.url } } as never
      const homeIdx = items.findIndex((i) => i?.link?.url === '/')
      items.splice(homeIdx >= 0 ? homeIdx + 1 : 0, 0, item)
    }
    if (!urls.has('/posts')) items.push(POSTS_NAV_ITEM)
    if (!urls.has('/events')) items.push(EVENTS_NAV_ITEM)
    if (!urls.has('/book')) items.push(BOOK_NAV_ITEM)
    // Discovery is its own switch (Endeavor "Show in Discovery" toggle).
    if (discoveryEnabled && !urls.has('/federation/discover')) items.push(DISCOVER_NAV_ITEM)
    // Mission/platform chrome — community endeavors only, never a commercial storefront.
    if (!isStorefront) {
      if (!urls.has('/donate')) items.push(donateItem)
      if (!urls.has('/works')) items.push(WORKS_NAV_ITEM)
      if (!urls.has('/learn')) items.push(LEARN_NAV_ITEM)
      if (!urls.has('/dashboard/spaces')) items.push(SPACES_NAV_ITEM)
    }
    // Dashboard is always visible — the dashboard layout handles auth redirect.
    if (!urls.has('/dashboard')) items.push(DASHBOARD_NAV_ITEM)
    return items
  }, [navItems, isStorefront, discoveryEnabled, donateItem, membership])
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
  if (!hasBook) demoteUrls.push('/book')
  // Giving promotes to top-level only for a church/ministry/nonprofit; otherwise it
  // lives in More (the link still exists for any community site, just not up front).
  if (!isGivingOrg) demoteUrls.push('/donate')
  // Revenue CTAs stay PRIMARY when populated — booking a service and buying a
  // product are how the endeavor earns, so they're never buried in More past the
  // inline cap. (Populated = the section actually has something to sell/book.)
  const forcePrimaryUrls: string[] = discoveryEnabled ? ['/federation/discover'] : []
  if (hasBook) forcePrimaryUrls.push('/book')
  if (hasProducts) forcePrimaryUrls.push('/shop')
  if (isGivingOrg) forcePrimaryUrls.push('/donate')
  if (membership) forcePrimaryUrls.push(membership.url)
  // The menu above is DERIVED from what the endeavor actually has. These three
  // are the only things derivation can't know, because they're the owner's
  // intent rather than a fact about their content:
  //   hidden    — "I have this, but don't advertise it"
  //   pinned    — "keep this up front regardless of the cap"
  //   maxInline — how many ride the top bar
  // Hidden wins over pinned: an owner who says don't show it means it, even if
  // they pinned it earlier and forgot.
  const hiddenUrls = new Set(navOverrides?.hidden ?? [])
  const visibleMenu = useMemo(
    () => menu.filter((i) => !hiddenUrls.has(i?.link?.url ?? '')),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [menu, navOverrides?.hidden],
  )
  for (const u of navOverrides?.pinned ?? []) {
    if (!hiddenUrls.has(u) && !forcePrimaryUrls.includes(u)) forcePrimaryUrls.push(u)
  }

  const { primary: primaryItems, overflow: overflowItems } = partitionNavItems(visibleMenu, {
    maxInline: navOverrides?.maxInline ?? MAX_INLINE_NAV,
    forcePrimaryUrls,
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
      {/* pb-2 as well as pt-2: with `md:items-end` the right-rail controls were
          pushed flush against the bottom border, and the cart icon rendered
          visibly clipped. Padding both sides gives every control room. */}
      <nav className="flex items-center md:items-end justify-between container pt-1 pb-1">
        <div className="block flex-none md:hidden">
          <Suspense fallback={null}>
            {/* The SAME pins the desktop bar honours. Mobile used to render the
                raw array, so /book, /shop, /donate and Join — the links the
                endeavor actually earns from — landed wherever they happened to
                sit (the Join link was 16th of 25). @see docs/FOOTGUNS.md §2.7 */}
            <MobileMenu
              menu={visibleMenu}
              pinnedUrls={forcePrimaryUrls}
              siteName={tenant?.branding?.siteName || tenant?.name || undefined}
            />
          </Suspense>
        </div>
        <div className="flex w-full items-end justify-between">
          <div className="flex w-full items-end gap-6 md:w-auto md:flex-1 min-w-0">
            <Link className="flex items-center justify-center py-2 flex-shrink-0" href="/">
              {tenantLogoUrl ? (
                /* h-6 rendered a wordmark at 24px — legible, but visually a
                   footnote next to 12px uppercase nav links. h-8/h-10 fills the
                   bar's existing padding without changing its height. */
                <img src={tenantLogoUrl} alt={tenant?.branding?.siteName || tenant?.name || 'Home'} className="h-8 w-auto object-contain md:h-10" />
              ) : (
                <AngelIcon className="h-7 w-7 text-[#f5a623]" />
              )}
            </Link>
            {/* min-w-0 only — NOT overflow-hidden. The clip was added to stop
                the nav painting over the tenant switcher at ~1000px, and it
                clipped the DROPDOWN PANELS too, because they are children of
                this root: Home and More opened onto nothing, on every portal.
                A cosmetic overlap is never worth breaking navigation. Overlap
                is handled by short labels and a sane inline cap instead. */}
            {menu.length ? (
              <NavigationMenu viewport={false} className="hidden md:flex justify-start min-w-0">
                {/* justify-start (not the shadcn default justify-center) = left-aligned,
                    and direction-aware: it flips to the right under dir="rtl" (Arabic). */}
                <NavigationMenuList className="gap-5 justify-start flex-nowrap">
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

                  {!navOverrides?.hideMore && overflowItems.length > 0 && (
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

          <div className="flex shrink-0 items-center justify-end gap-4 py-1">
            {user ? (
              <>
                {/* The portal chooser and "edit this page" used to sit here as
                    their own control. They're inside the account menu now: three
                    controls competing for the right rail is what pushed "MORE"
                    off the nav, and members who aren't admins never had the top
                    bar to switch from. */}
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
                    portals={userPortals}
                    currentTenantId={tenant?.id}
                    canEditContent={canEditContent}
                  />
                </div>
                {/* Mobile: the same control, which previously had NO mobile
                    equivalent at all — switching portals on a phone was
                    impossible. */}
                <div className="md:hidden">
                  <AccountMenu
                    name={(user as { name?: string | null }).name}
                    email={(user as { email?: string | null }).email}
                    online={isOnline}
                    portals={userPortals}
                    currentTenantId={tenant?.id}
                    canEditContent={canEditContent}
                  />
                </div>
              </>
            ) : (
              <>
                <Link href="/login" className="headerAuthLink hidden md:inline text-sm transition">
                  Login
                </Link>
                <Link href="/create-account" className="headerSignUpLink hidden md:inline text-sm font-medium transition">
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
