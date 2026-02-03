import type { ReactNode } from 'react'
import { getLocale } from 'next-intl/server'
import Link from 'next/link'

/**
 * Dashboard layout – Discord-like left nav for Spaces, LEO, workspace apps.
 * @see https://github.com/The-Angel-OS/angel-os/tree/main/src/app/dashboard
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  const prefix = locale === 'en' ? '' : `/${locale}`

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Left nav – channels, LEO, workspace apps – to be built */}
        <aside className="w-60 border-r border-border bg-muted/30 p-4">
          <nav className="space-y-1">
            <Link
              href={`${prefix}/dashboard`}
              className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Overview
            </Link>
            <Link
              href={`${prefix}/dashboard/leo`}
              className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              LEO
            </Link>
            <Link
              href={`${prefix}/dashboard/spaces`}
              className="block rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              Spaces
            </Link>
          </nav>
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
