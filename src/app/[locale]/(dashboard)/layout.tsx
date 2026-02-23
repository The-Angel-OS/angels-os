import type { ReactNode } from 'react'
import { headers } from 'next/headers'

import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import React from 'react'
import { TenantFonts } from '@/components/TenantFonts'
import { TenantStyles } from '@/components/TenantStyles'
import { fetchTenantByDomain } from '@/utilities/fetchTenantByDomain'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'
import type { Metadata } from 'next'
import type { Media } from '@/payload-types'
import '../(app)/globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  const tenant = tenantSlug ? await fetchTenantBySlug(tenantSlug) : null
  const siteName = (tenant as any)?.branding?.siteName || (tenant as any)?.name || 'Angel OS'
  const logoUrl =
    typeof (tenant as any)?.branding?.logo === 'object' &&
    (tenant as any)?.branding?.logo !== null
      ? ((tenant as any).branding.logo as Media)?.url
      : null

  return {
    title: {
      default: `Dashboard | ${siteName}`,
      template: `%s | ${siteName}`,
    },
    ...(logoUrl ? { icons: { icon: logoUrl } } : {}),
  }
}

/**
 * Dashboard route group layout.
 *
 * This layout provides the HTML shell + Providers for ALL dashboard pages
 * but does NOT include brochure chrome (Header, Footer, FloatingBubble).
 * The dashboard has its own sidebar nav in dashboard/layout.tsx.
 */
export default async function DashboardGroupLayout({ children }: { children: ReactNode }) {
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  const host = headersList.get('host') ?? ''

  const tenant =
    (tenantSlug ? await fetchTenantBySlug(tenantSlug) : null) ??
    (await fetchTenantByDomain(host))

  return (
    <html
      className={[GeistSans.variable, GeistMono.variable].filter(Boolean).join(' ')}
      lang="en"
      suppressHydrationWarning
    >
      <head>
        <InitTheme />
        <TenantFonts tenant={tenant} />
        <TenantStyles tenant={tenant} />
        <link href="/favicon.ico" rel="icon" sizes="32x32" />
        <link href="/favicon.svg" rel="icon" type="image/svg+xml" />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
