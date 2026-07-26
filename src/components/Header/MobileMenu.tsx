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
  siteName?: string
}

// Global mission content (the Library + Learn) is served from a static soul
// manifest, not tenant-scoped — so it should be reachable from EVERY site's
// mobile menu, even where the desktop nav demotes it to "More" or a storefront
// suppresses it from the primary chrome. Guarantee these links so there's always
// a way to reach Works on mobile.
const GUARANTEED_MOBILE_LINKS = [
  { id: 'm-learn', link: { type: 'custom' as const, label: 'Learn', url: '/learn', newTab: false } },
  { id: 'm-works', link: { type: 'custom' as const, label: 'Works', url: '/works', newTab: false } },
]

export function MobileMenu({ menu, siteName }: Props) {
  const { user } = useAuth()

  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isOpen, setIsOpen] = useState(false)

  // Ensure the mission Library is always reachable on mobile (append only what's
  // missing — never duplicate an item the tenant nav already provides).
  const items = React.useMemo(() => {
    const base = Array.isArray(menu) ? [...menu] : []
    const urls = new Set(base.map((i) => (i as { link?: { url?: string | null } }).link?.url))
    for (const extra of GUARANTEED_MOBILE_LINKS) {
      if (!urls.has(extra.link.url)) base.push(extra)
    }
    return base
  }, [menu])

  const closeMobileMenu = () => setIsOpen(false)

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) {
        setIsOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isOpen])

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
                    <CMSLink {...item.link} appearance="link" />
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
