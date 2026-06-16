import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import path from 'path'
import fs from 'fs'
import { getSoul } from '@/souls'
import { isWorkAvailable } from '@/souls/subscriptions'
import { BookReader } from '@/components/Library/BookReader'
import { SoulViewer } from '../SoulViewer'
import { loadBookFromPublic, resolvePageIndex, pageExcerpt } from '@/components/Library/bookManifestServer'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { tenantHeroImage } from '@/utilities/tenantHeroImage'
import { buildWorkCanonicalUrl } from '@/utilities/worksCanonical'

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
  if (!soul) return {}

  const origin = await originFromHeaders()
  const toAbs = (u?: string | null): string | undefined =>
    u ? (u.startsWith('http') ? u : `${origin}${u}`) : undefined

  // ── Book works (WDEG): per-page image → cover → tenant hero ──────────────────
  if (soul.bookSlug) {
    const loaded = loadBookFromPublic(soul.bookSlug)
    if (!loaded) return {}

    const idx = resolvePageIndex(loaded, page)
    const p = loaded.manifest.pages[idx]
    const inferredTitle = loaded.pageTitles[idx]
    const excerpt = pageExcerpt(loaded.baseText[String(p?.order)])
    const description = excerpt || loaded.manifest.subtitle || soul.description || ''
    // Canonical points to the Work's PUBLISHER root (publish-once-canonical), not
    // the serving origin — so a subscriber's copy credits the canonical home.
    const canonical = buildWorkCanonicalUrl(soul.canonical, soulId, loaded.pageSlugs[idx], origin)

    let image = toAbs(p?.image)
    if (!image) image = toAbs(loaded.manifest.pages.find((pg) => pg.image)?.image)
    if (!image) {
      const { tenant } = await resolveTenantFromHeaders()
      image = toAbs(tenantHeroImage(tenant))
    }
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

  // ── Document souls (Answer53, Rainmaker): per-section deep link + OG ──────────
  // Same fallback chain: this section's image → the work's first illustrated
  // section → the tenant home hero. So every chapter unfurls with a banner.
  const doc = soul.docs.find((d) => d.id === page)
  if (!doc) return {}

  const canonical = buildWorkCanonicalUrl(soul.canonical, soulId, doc.id, origin)
  let image = toAbs(doc.image)
  if (!image) image = toAbs(soul.docs.find((d) => d.image)?.image)
  if (!image) {
    const { tenant } = await resolveTenantFromHeaders()
    image = toAbs(tenantHeroImage(tenant))
  }
  const pageTitle = `${doc.title} · ${soul.title}`
  const description = doc.description || soul.subtitle || soul.description || ''

  return {
    title: pageTitle,
    description,
    alternates: { canonical },
    openGraph: {
      title: pageTitle,
      description,
      type: 'article',
      url: canonical,
      siteName: soul.title,
      ...(image ? { images: [{ url: image, alt: doc.title }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: pageTitle,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

export default async function DeepLinkPage({
  params,
}: {
  params: Promise<{ locale: string; soul: string; page: string }>
}) {
  const { locale, soul: soulId, page } = await params
  setRequestLocale(locale)

  const soul = getSoul(soulId)
  if (!soul) notFound()

  // Lockdown: this Work must be subscribed to the current endeavor.
  const { tenant } = await resolveTenantFromHeaders()
  if (!isWorkAvailable(soulId, tenant?.slug)) notFound()

  // ── Book works → the illustrated paged reader ───────────────────────────────
  if (soul.bookSlug) {
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

  // ── Document souls → the chapter, deep-linked at /learn/<soul>/<docId> ───────
  const doc = soul.docs.find((d) => d.id === page)
  if (!doc) redirect(`/learn/${soulId}`)

  const docsBase = path.join(process.cwd(), 'docs', 'vision', soulId)
  const allContents: Record<string, string> = {}
  for (const d of soul.docs) {
    try {
      allContents[d.id] = fs.readFileSync(path.join(docsBase, d.filename), 'utf-8')
    } catch {
      allContents[d.id] = `# ${d.title}\n\n*Document not found.*`
    }
  }

  return (
    <SoulViewer
      soul={soul}
      activeDocId={doc.id}
      allContents={allContents}
      basePath={`/learn/${soulId}`}
    />
  )
}
