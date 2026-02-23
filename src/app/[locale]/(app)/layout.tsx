import type { ReactNode } from 'react'
import { getLocale } from 'next-intl/server'
import { headers } from 'next/headers'

import { AdminBar } from '@/components/AdminBar'
import { Footer } from '@/components/Footer'
import { Header } from '@/components/Header'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { Providers } from '@/providers'
import { InitTheme } from '@/providers/Theme/InitTheme'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import React from 'react'
import { TenantFonts } from '@/components/TenantFonts'
import { TenantStyles } from '@/components/TenantStyles'
import { FloatingBubble } from '@/components/ChatControl/FloatingBubble'
import { fetchTenantByDomain } from '@/utilities/fetchTenantByDomain'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'
import { fetchDefaultSpaceId } from '@/utilities/fetchDefaultSpaceId'
import type { Metadata } from 'next'
import type { Media } from '@/payload-types'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  const tenant = tenantSlug ? await fetchTenantBySlug(tenantSlug) : null
  const siteName = (tenant as any)?.branding?.siteName || (tenant as any)?.name || 'Angel OS'
  const tagline =
    typeof (tenant as any)?.branding?.tagline === 'string'
      ? (tenant as any).branding.tagline
      : ''
  const logoUrl =
    typeof (tenant as any)?.branding?.logo === 'object' &&
    (tenant as any)?.branding?.logo !== null
      ? ((tenant as any).branding.logo as Media)?.url
      : null

  return {
    title: {
      default: siteName,
      template: `%s | ${siteName}`,
    },
    description:
      tagline ||
      'Angel OS — the cooperative operating system for ethical commerce, community spaces, and AI-assisted workflows.',
    icons: {
      icon: logoUrl ?? '/favicon.png',
      apple: '/apple-touch-icon.png',
    },
  }
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale()
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  const host = headersList.get('host') ?? ''

  // Graceful tenant resolution — if the DB is temporarily unavailable the layout
  // still renders (header/footer will simply be empty).
  let tenant: Awaited<ReturnType<typeof fetchTenantByDomain>> = null
  try {
    tenant =
      (tenantSlug ? await fetchTenantBySlug(tenantSlug) : null) ??
      (await fetchTenantByDomain(host))
  } catch (err) {
    console.error('[AppLayout] Tenant resolution failed — rendering without tenant:', err)
  }

  // Resolve the default space for this tenant (for the floating chat bubble)
  let defaultSpaceId: string | undefined
  try {
    const rawSpaceId = tenant?.id ? await fetchDefaultSpaceId(tenant.id) : undefined
    defaultSpaceId = rawSpaceId != null ? String(rawSpaceId) : undefined
  } catch (err) {
    console.error('[AppLayout] Default space resolution failed:', err)
  }

  return (
    <html
      className={[GeistSans.variable, GeistMono.variable].filter(Boolean).join(' ')}
      lang={locale}
      suppressHydrationWarning
    >
      <head>
        <InitTheme />
        <TenantFonts tenant={tenant} />
        <TenantStyles tenant={tenant} />
        <link rel="icon" type="image/png" sizes="64x64" href="/favicon.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </head>
      <body>
        <Providers>
          <AdminBar />
          <LivePreviewListener />

          <Header tenant={tenant} />
          <main>{children}</main>
          <Footer tenant={tenant} />
          <FloatingBubble spaceId={defaultSpaceId} />
        </Providers>
      </body>
    </html>
  )
}
