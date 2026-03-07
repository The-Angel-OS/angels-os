import type { ReactNode } from 'react'

import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import React from 'react'
import { TenantFonts } from '@/components/TenantFonts'
import { TenantStyles } from '@/components/TenantStyles'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import type { Metadata } from 'next'
import type { Media } from '@/payload-types'
import '../(app)/globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const { tenant } = await resolveTenantFromHeaders()
  const siteName = tenant?.branding?.siteName || tenant?.name || 'Angel OS'
  const logoUrl =
    typeof tenant?.branding?.logo === 'object' &&
    tenant?.branding?.logo !== null
      ? (tenant.branding.logo as Media)?.url
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
  const { tenant } = await resolveTenantFromHeaders()

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
        <link rel="icon" type="image/png" sizes="64x64" href="/favicon.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <GoogleAnalytics />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
