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
    url: '/spaces',
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
  const baseMenu = header?.navItems ?? []
  const menu = useMemo(() => {
    const items = [...baseMenu, EVENTS_NAV_ITEM]
    if (user) {
      items.push(SPACES_NAV_ITEM, DASHBOARD_NAV_ITEM)
    }
    return items
  }, [baseMenu, user])
  const logoUrl =
    (tenant?.branding?.logo as Media | null)?.url ?? defaultLogoUrl
  const pathname = usePathname()

  return (
    <div className="relative z-20 border-b">
      <nav className="flex items-center md:items-end justify-between container pt-2">
        <div className="block flex-none md:hidden">
          <Suspense fallback={null}>
            <MobileMenu menu={menu} />
          </Suspense>
        </div>
        <div className="flex w-full items-end justify-between">
          <div className="flex w-full items-end gap-6 md:w-1/3">
            <Link className="flex w-full items-center justify-center pt-4 pb-4 md:w-auto" href="/">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="h-6 w-auto object-contain" />
              ) : (
                <LogoIcon className="w-6 h-auto" />
              )}
            </Link>
            {menu.length ? (
              <ul className="hidden gap-5 text-xs font-medium uppercase tracking-wider md:flex md:items-center">
                {menu.map((item) => (
                  <li key={item.id}>
                    <CMSLink
                      {...item.link}
                      size={'clear'}
                      className={cn('relative navLink', {
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

          <div className="flex justify-end md:w-1/3 gap-4 items-center">
            {user ? (
              <Link href="/logout" className="hidden md:inline text-sm text-muted-foreground hover:text-foreground transition">
                Logout
              </Link>
            ) : (
              <Link href="/login" className="hidden md:inline text-sm text-muted-foreground hover:text-foreground transition">
                Login
              </Link>
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
