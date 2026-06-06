import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getSoul } from '@/souls'
import { BookReader } from '@/components/Library/BookReader'
import { loadBookFromPublic, resolvePageIndex, pageExcerpt } from '@/components/Library/bookManifestServer'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { tenantHeroImage } from '@/utilities/tenantHeroImage'

export const dynamic = 'force-dynamic'

async function originFromHeaders(): Promise<string> {
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || ''
  const proto = h.get('x-forwarded-proto') || 'https'
  return host ? `${proto}://${host}` : ''
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; soul: string; page: string }>
}): Promise<Metadata> {
  const { soul: soulId, page } = await params
  const soul = getSoul(soulId)
  if (!soul?.bookSlug) return {}

  const loaded = loadBookFromPublic(soul.bookSlug)
  if (!loaded) return {}

  const idx = resolvePageIndex(loaded, page)
  const p = loaded.manifest.pages[idx]
  const inferredTitle = loaded.pageTitles[idx]
  const excerpt = pageExcerpt(loaded.baseText[String(p?.order)])
  const description = excerpt || loaded.manifest.subtitle || soul.description || ''

  const origin = await originFromHeaders()
  const canonical = `${origin}/learn/${soulId}/${loaded.pageSlugs[idx]}`

  // Unfurl image fallback chain so EVERY deep link has a pretty banner — not just
  // works (like WDEG) where every page is illustrated:
  //   this page's image → the work's first illustration (its "cover")
  //   → the tenant's home hero (branding.coverImage).
  const toAbs = (u?: string | null): string | undefined =>
    u ? (u.startsWith('http') ? u : `${origin}${u}`) : undefined
  let image = toAbs(p?.image)
  if (!image) image = toAbs(loaded.manifest.pages.find((pg) => pg.image)?.image)
  if (!image) {
    const { tenant } = await resolveTenantFromHeaders()
    image = toAbs(tenantHeroImage(tenant))
  }

  // The unfurl banner is THIS page's illustration.
  const pageTitle = inferredTitle
    ? `${inferredTitle} · ${loaded.manifest.title}`
    : `${loaded.manifest.title} · page ${idx + 1}`

  return {
    title: pageTitle,
    description,
    alternates: { canonical },
    openGraph: {
      title: pageTitle,
      description,
      type: 'article',
      url: canonical,
      siteName: loaded.manifest.title,
      ...(image ? { images: [{ url: image, alt: inferredTitle || loaded.manifest.title }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: pageTitle,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

export default async function BookDeepLinkPage({
  params,
}: {
  params: Promise<{ locale: string; soul: string; page: string }>
}) {
  const { locale, soul: soulId, page } = await params
  setRequestLocale(locale)

  const soul = getSoul(soulId)
  if (!soul) notFound()
  // Deep-link pages are for illustrated/paged book works; document souls keep
  // their `?doc=` model — send their page-shaped URLs back to the soul entry.
  if (!soul.bookSlug) redirect(`/learn/${soulId}`)

  const loaded = loadBookFromPublic(soul.bookSlug)
  if (!loaded) notFound()

  const idx = resolvePageIndex(loaded, page)

  return (
    <BookReader
      manifest={loaded.manifest}
      initialIndex={idx}
      basePath={`/learn/${soulId}`}
      pageSlugs={loaded.pageSlugs}
      title={soul.title}
    />
  )
}
