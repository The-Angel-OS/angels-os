'use client'

import type { Header } from '@/payload-types'

import { CMSLink } from '@/components/Link'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { useAuth } from '@/providers/Auth'
import { MenuIcon } from 'lucide-react'
import { ThemeToggle } from '@/providers/Theme/ThemeToggle'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import React, { useEffect, useState } from 'react'

interface Props {
  menu: Header['navItems']
  /** URLs the desktop bar pins to the front — /book, /shop, /donate, Join.
   *  Mobile must honour the same order or the endeavor's revenue links end up
   *  buried in a 25-item list. */
  pinnedUrls?: string[]
  /** Owner-hidden urls. `menu` is already filtered by these; the guaranteed
   *  links below need them too, or hiding a route is what puts it on mobile. */
  hiddenUrls?: string[]
  siteName?: string
}

// Previously injected /learn and /works into every site's mobile menu.
// New portals use a clean CMS nav: /learn lives in /dashboard/learn and /works
// is strictly opt-in via tenant.features.works (composed upstream in HeaderClient).
const GUARANTEED_MOBILE_LINKS: Array<{
  id: string
  link: { type: 'custom'; label: string; url: string; newTab: boolean }
}> = []

/**
 * Filter any hidden URLs out of the mobile menu without force-injecting
 * legacy /learn or /works links onto portals that do not use them.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withGuaranteedLinks(menu: any[], hiddenUrls: string[] = []): any[] {
  const base = Array.isArray(menu) ? [...menu] : []
  const hidden = new Set(hiddenUrls)
  const filtered = hidden.size
    ? base.filter((i) => !hidden.has((i as { link?: { url?: string | null } }).link?.url ?? ''))
    : base
  const urls = new Set(filtered.map((i) => (i as { link?: { url?: string | null } }).link?.url))
  for (const extra of GUARANTEED_MOBILE_LINKS) {
    if (!urls.has(extra.link.url) && !hidden.has(extra.link.url)) filtered.push(extra)
  }
  return filtered
}

export function MobileMenu({ menu, pinnedUrls = [], hiddenUrls = [], siteName }: Props) {
  const { user } = useAuth()

  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)

  // Ensure the mission Library is always reachable on mobile (append only what's
  // missing — never duplicate an item the tenant nav already provides).
  const items = React.useMemo(() => {
    const base = withGuaranteedLinks(menu as unknown[], hiddenUrls)

    // Hoist the pinned links to the top, in the order the desktop pins them.
    // A phone shows ~6 items without scrolling; whatever is 16th does not exist.
    if (!pinnedUrls.length) return base
    const rank = new Map(pinnedUrls.map((u, i) => [u, i]))
    const pinned: typeof base = []
    const rest: typeof base = []
    for (const item of base) {
      const u = (item as { link?: { url?: string | null } }).link?.url ?? ''
      if (rank.has(u)) pinned.push(item)
      else rest.push(item)
    }
    pinned.sort(
      (a, b) =>
        (rank.get((a as { link?: { url?: string | null } }).link?.url ?? '') ?? 0) -
        (rank.get((b as { link?: { url?: string | null } }).link?.url ?? '') ?? 0),
    )
    return [...pinned, ...rest]
  }, [menu, pinnedUrls, hiddenUrls])

  const isActive = (url?: string | null) =>
    url && url !== '/' ? pathname?.includes(url) : pathname === '/'

  const closeMobileMenu = () => setIsOpen(false)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
    // Subscribe once — this listener does not depend on `isOpen`, and listing it
    // tore down and re-added the handler on every open and close.
  }, [])

  useEffect(() => {
    setIsOpen(false)
  }, [pathname, searchParams])

  return (
    <Sheet onOpenChange={setIsOpen} open={isOpen}>
      <SheetTrigger
        aria-label="Open menu"
        className="relative flex h-11 w-11 items-center justify-center rounded-md border border-neutral-200 text-black transition-colors dark:border-neutral-700 dark:bg-black dark:text-white"
      >
        <MenuIcon className="h-4" />
      </SheetTrigger>

      {/* h-full + overflow-y-auto so a long nav (many pages + blog entries + the
          appended Library links + account section) scrolls instead of spilling
          off the bottom unreachable. pb keeps the last item clear of the edge. */}
      <SheetContent side="left" className="flex h-full flex-col overflow-y-auto px-4 pb-10">
        <SheetHeader className="px-0 pt-4 pb-0">
          <SheetTitle>{siteName || 'Angel OS'}</SheetTitle>

          <SheetDescription />
        </SheetHeader>

        <div className="py-4">
          {items?.length ? (
            <ul className="flex w-full flex-col">
              {items.map((item) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const children: any[] = Array.isArray((item as any).children) ? (item as any).children : []
                return (
                  <li className="py-2" key={item.id}>
                    <span
                      className={
                        isActive(item.link?.url)
                          ? 'font-semibold text-foreground [&_a]:text-foreground'
                          : ''
                      }
                      // Tells assistive tech which page you're on — the sheet
                      // gave no indication at all before.
                      aria-current={isActive(item.link?.url) ? 'page' : undefined}
                    >
                      <CMSLink {...item.link} appearance="link" />
                    </span>
                    {children.length > 0 && (
                      <ul className="mt-1 ml-3 flex flex-col border-l border-border pl-3">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {children.map((c: any, ci: number) => (
                          <li className="py-1.5" key={c.id || `${item.id}-c${ci}`}>
                            <CMSLink {...c.link} appearance="link" />
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>

        {/* Theme lived ONLY in the site footer, so on a phone changing it meant
            scrolling a whole page. Signed out or in, it belongs in the menu. */}
        <div className="mt-2 border-t border-border pt-3">
          <ThemeToggle />
        </div>

        {user ? (
          <div className="mt-4">
            <h2 className="text-xl mb-4">My account</h2>
            <hr className="my-2" />
            <ul className="flex flex-col gap-2">
              <li>
                <Link href="/orders">Orders</Link>
              </li>
              <li>
                <Link href="/account/addresses">Addresses</Link>
              </li>
              <li>
                <Link href="/account">Manage account</Link>
              </li>
              <li className="mt-6">
                <Button asChild variant="outline">
                  <Link href="/logout">Log out</Link>
                </Button>
              </li>
            </ul>
          </div>
        ) : (
          <div>
            <h2 className="text-xl mb-4">My account</h2>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button asChild className="w-full sm:flex-1" variant="outline">
                <Link href="/login">Log in</Link>
              </Button>
              <span className="text-center text-sm text-muted-foreground sm:text-base">or</span>
              <Button asChild className="w-full sm:flex-1">
                <Link href="/create-account">Create an account</Link>
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
