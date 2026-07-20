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
import { PageComments } from '@/components/ChatControl/PageComments'
import { TenantCookieSync } from '@/components/TenantCookieSync'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { GoogleAnalytics } from '@/components/GoogleAnalytics'
import { fetchTenantByDomain, fetchTenantByExactDomain } from '@/utilities/fetchTenantByDomain'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'
import { fetchDefaultSpaceId } from '@/utilities/fetchDefaultSpaceId'
import { getTenantCachedDoc } from '@/utilities/getTenantCachedDoc'
import type { Metadata } from 'next'
import type { Media } from '@/payload-types'
import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers()
  const tenantSlug = headersList.get('x-tenant-id')
  // Subdomain tenant via x-tenant-id; platform/apex via exact-domain (own branding).
  const tenant = tenantSlug
    ? await fetchTenantBySlug(tenantSlug)
    : await fetchTenantByExactDomain(headersList.get('host') ?? '')
  const siteName = (tenant as any)?.branding?.siteName || (tenant as any)?.name || 'Angel OS'
  const tagline =
    typeof (tenant as any)?.branding?.tagline === 'string'
      ? (tenant as any).branding.tagline
      : ''
  const mediaUrl = (m: unknown): string | null =>
    typeof m === 'object' && m !== null ? ((m as Media)?.url ?? null) : null
  const branding = (tenant as any)?.branding
  // Per-endeavor favicon: uploaded favicon → logo → Angel OS default.
  const faviconUrl = mediaUrl(branding?.favicon) ?? mediaUrl(branding?.logo) ?? '/favicon.png'
  const appleUrl = mediaUrl(branding?.favicon) ?? '/apple-touch-icon.png'

  return {
    title: {
      default: siteName,
      template: `%s | ${siteName}`,
    },
    description:
      tagline ||
      'Angel OS — the cooperative operating system for ethical commerce, community spaces, and AI-assisted workflows.',
    icons: {
      icon: faviconUrl,
      shortcut: faviconUrl,
      apple: appleUrl,
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
  //
  // TENANT ISOLATION: Only resolve a tenant when middleware set x-tenant-id.
  // When x-tenant-id is absent (platform domains like spacesangels.com,
  // angels-os.kendev.co), we are in platform context — tenant MUST stay null.
  // The previous fallback to fetchTenantByDomain(host) caused tenant leakage:
  // it always returned some tenant via DEFAULT_TENANT_SLUG, so platform pages
  // would render with a random tenant's branding, header, and footer.
  let tenant: Awaited<ReturnType<typeof fetchTenantByDomain>> = null
  try {
    if (tenantSlug) {
      tenant = await fetchTenantBySlug(tenantSlug)
      // If slug didn't resolve (e.g. DB timeout), try domain as last resort
      // but ONLY because we know a tenant was intended (header was present)
      if (!tenant) {
        tenant = await fetchTenantByDomain(host)
      }
    } else {
      // Platform/apex domain (no x-tenant-id). Resolve ONLY by EXACT domain match —
      // so a tenant that legitimately owns this apex (the platform tenant for
      // www.spacesangels.com) loads its OWN header/pages/branding. Exact-only means
      // no DEFAULT_TENANT_SLUG fallback, so an unowned apex still stays null (true
      // platform context) — preserving the isolation guarantee above.
      tenant = await fetchTenantByExactDomain(host)
    }
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

  // Fetch SiteSettings for this tenant (announcement bar, social links, GA, maintenance mode)
  let siteSettings: any = null
  try {
    if (tenant?.id) {
      siteSettings = await getTenantCachedDoc('site-settings', tenant.id, 1)()
    }
  } catch {
    // Non-critical — site works without settings
  }

  const announcementBar = siteSettings?.announcementBar
  const showAnnouncement = announcementBar?.enabled && announcementBar?.text

  return (
    <html
      className={[GeistSans.variable, GeistMono.variable].filter(Boolean).join(' ')}
      lang={locale}
      suppressHydrationWarning
    >
      <head>
        <InitTheme tenantDefault={(tenant as any)?.branding?.defaultTheme} />
        <TenantFonts tenant={tenant} />
        <TenantStyles tenant={tenant} />
        {/* Favicon links are emitted by generateMetadata().icons (per-endeavor:
            branding.favicon → logo → /favicon.png). The 512px icon is kept here
            as a static PWA hint. */}
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <GoogleAnalytics />
      </head>
      <body>
        <Providers>
          <AdminBar />
          <LivePreviewListener />

          {/* Announcement Bar — from SiteSettings */}
          {showAnnouncement && (
            <div
              className="text-center text-sm font-medium py-2 px-4"
              style={{ backgroundColor: announcementBar.backgroundColor || '#f5a623', color: '#000' }}
            >
              {announcementBar.link ? (
                <a href={announcementBar.link} className="hover:underline">
                  {announcementBar.text}
                </a>
              ) : (
                announcementBar.text
              )}
            </div>
          )}

          <Header tenant={tenant} />
          <main>{children}</main>
          <Footer tenant={tenant} />
          <FloatingBubble spaceId={defaultSpaceId} />
          <PageComments spaceId={defaultSpaceId} />
          {tenant?.id && <TenantCookieSync tenantId={String(tenant.id)} />}
          {/* Vercel analytics beacons only work on Vercel — off-Vercel (self-host)
              they 404 /_vercel/insights/* and spam the console. Gate to Vercel. */}
          {process.env.VERCEL === '1' && (
            <>
              <Analytics />
              <SpeedInsights />
            </>
          )}
        </Providers>
      </body>
    </html>
  )
}
