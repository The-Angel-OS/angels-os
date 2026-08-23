import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getWork, isWorkAvailable, type WorkDoc } from '@/works/registry'
import { getWorkJson } from '@/utilities/getWorkJson'
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
  const soul = await getWork(soulId)
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
    const rawPageText = loaded.baseText[String(p?.order)]
    const excerpt = pageExcerpt(typeof rawPageText === 'string' ? rawPageText : '')
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
  const { tenant: metaTenant } = await resolveTenantFromHeaders()
  const metaWork = await getWorkJson({
    payload: await getPayload({ config: configPromise }),
    soulId,
    tenantSlug: metaTenant?.slug,
    origin,
  })
  const metaDocs = (metaWork?.docs ?? []) as WorkDoc[]
  const doc = metaDocs.find((d) => d.id === page)
  if (!doc) return {}

  const canonical = buildWorkCanonicalUrl(soul.canonical, soulId, doc.id, origin)
  let image = toAbs(doc.image)
  if (!image) image = toAbs(metaDocs.find((d) => d.image)?.image)
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

  const soul = await getWork(soulId)
  if (!soul) notFound()

  // Lockdown: this Work must be subscribed to the current endeavor.
  const { tenant } = await resolveTenantFromHeaders()
  if (!isWorkAvailable(soul, tenant?.slug)) notFound()

  // Chapters are rows: assembled from message-backed storage (Blob media +
  // inline translations).
  const payload = await getPayload({ config: configPromise })
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || ''
  const origin = host ? `${h.get('x-forwarded-proto') || 'https'}://${host}` : ''
  const work = await getWorkJson({ payload, soulId, tenantSlug: tenant?.slug, origin })

  // ── Book works → the illustrated paged reader ───────────────────────────────
  if (soul.bookSlug) {
    if (work?.pages?.length) {
      const n = parseInt(page, 10)
      const idx = Number.isFinite(n) && n >= 1 && n <= work.pages.length ? n - 1 : 0
      const langs: Array<{ code: string }> = work.languages ?? []
      const inlineTexts: Record<string, Record<string, string>> = {}
      for (const l of langs) {
        inlineTexts[l.code] = {}
        work.pages.forEach((p: { translations?: Record<string, string> }, i: number) => {
          inlineTexts[l.code][String(i)] = p.translations?.[l.code] ?? ''
        })
      }
      const manifest = {
        slug: soulId,
        title: soul.title,
        subtitle: soul.subtitle ?? null,
        pageCount: work.pages.length,
        pages: work.pages.map((p: { image: string | null }, i: number) => ({ order: i, image: p.image ?? undefined })),
        languages: work.languages ?? [],
        defaultLanguage: work.baseLanguage ?? 'en',
      }
      const pageSlugs = work.pages.map((p: { slug: string }) => p.slug)
      return (
        <BookReader manifest={manifest} inlineTexts={inlineTexts} initialIndex={idx} basePath={`/learn/${soulId}`} pageSlugs={pageSlugs} title={soul.title} />
      )
    }
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
  const docs = (work?.docs ?? []) as Array<WorkDoc & { body: string }>
  const doc = docs.find((d) => d.id === page)
  if (!doc) redirect(`/learn/${soulId}`)

  const allContents: Record<string, string> = {}
  for (const d of docs) allContents[d.id] = d.body

  return (
    <SoulViewer
      soul={{ ...soul, docs }}
      activeDocId={doc.id}
      allContents={allContents}
      basePath={`/learn/${soulId}`}
    />
  )
}
