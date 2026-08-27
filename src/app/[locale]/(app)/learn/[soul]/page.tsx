import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getWork, isWorkAvailable, type WorkDoc } from '@/works/registry'
import { gateWorkBySlug } from '@/utilities/gateWork'
import { AccessPanel } from '@/components/CoursePlayer/AccessPanel'
import { getWorkJson } from '@/utilities/getWorkJson'
import { buildTextWindow } from '@/utilities/workTextWindow'
import { SoulViewer } from './SoulViewer'
import { BookReader } from '@/components/Library/BookReader'
import { loadBookFromPublic } from '@/components/Library/bookManifestServer'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { tenantHeroImage } from '@/utilities/tenantHeroImage'
import { resolveCanonicalOrigin } from '@/utilities/worksCanonical'

export const dynamic = 'force-dynamic'

// ponytail: the catalog is a DB read now, so there is nothing to enumerate at
// build time — the route is force-dynamic anyway.
export async function generateStaticParams() {
  return []
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; soul: string }>
}): Promise<Metadata> {
  const { soul: soulId } = await params
  const soul = await getWork(soulId)
  if (!soul) return {}

  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || ''
  const origin = host ? `${h.get('x-forwarded-proto') || 'https'}://${host}` : ''
  const toAbs = (u?: string | null): string | undefined =>
    u ? (u.startsWith('http') ? u : `${origin}${u}`) : undefined
  // Canonical/og:url point to the Work's publisher root (publish-once-canonical);
  // images stay on the serving origin (the local copy renders its own assets).
  const canonicalUrl = `${resolveCanonicalOrigin(soul.canonical, origin)}/learn/${soulId}`
  // Always land on a pretty unfurl: preferred image → tenant home hero.
  const resolveImage = async (preferred?: string | null): Promise<string | undefined> => {
    const direct = toAbs(preferred)
    if (direct) return direct
    const { tenant } = await resolveTenantFromHeaders()
    return toAbs(tenantHeroImage(tenant))
  }

  // Book works: the cover (first page) is the share image; spider the work.
  if (soul.bookSlug) {
    const loaded = loadBookFromPublic(soul.bookSlug)
    const cover = loaded?.manifest.pages?.[0]?.image
    const image = await resolveImage(cover)
    const description = loaded?.manifest.subtitle || soul.description || ''
    return {
      title: soul.title,
      description,
      alternates: { canonical: canonicalUrl },
      openGraph: {
        title: soul.title,
        description,
        type: 'book',
        url: canonicalUrl,
        ...(image ? { images: [{ url: image, alt: soul.title }] } : {}),
      },
      twitter: { card: image ? 'summary_large_image' : 'summary', title: soul.title, description, ...(image ? { images: [image] } : {}) },
    }
  }

  // Non-book soul — still give it a pretty unfurl from the tenant home hero.
  const image = await resolveImage(null)
  const title = `${soul.title} — Soul Viewer`
  return {
    title,
    description: soul.description,
    openGraph: {
      title,
      description: soul.description,
      url: canonicalUrl,
      ...(image ? { images: [{ url: image, alt: soul.title }] } : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description: soul.description, ...(image ? { images: [image] } : {}) },
  }
}

export default async function SoulPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; soul: string }>
  searchParams: Promise<{ doc?: string }>
}) {
  const { locale, soul: soulId } = await params
  const { doc: activeDocId } = await searchParams
  setRequestLocale(locale)

  const soul = await getWork(soulId)
  if (!soul) notFound()

  // Lockdown: this Work must be subscribed to the current endeavor.
  const { tenant } = await resolveTenantFromHeaders()
  if (!isWorkAvailable(soul, tenant?.slug)) notFound()

  // The Work is assembled from message-backed storage (Blob media + inline
  // translations) — the chapters are rows, not files.
  const payload = await getPayload({ config: configPromise })

  // The paywall's other door. `works.access` was enforced only by the CoursePlayer
  // block, so a Work put up for sale still served its whole text at its own
  // canonical URL. @see gateWork.ts
  const gated = await gateWorkBySlug(payload, soulId)
  if (gated && !gated.gate.allowed) {
    return (
      <div className="container py-16">
        <AccessPanel title={gated.work.title ?? soul.title} reason={gated.gate.reason} product={gated.product} />
      </div>
    )
  }
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || ''
  const origin = host ? `${h.get('x-forwarded-proto') || 'https'}://${host}` : ''
  const work = await getWorkJson({ payload, soulId, tenantSlug: tenant?.slug, origin })

  // ── Book works → the illustrated-primer reader ──
  if (soul.bookSlug) {
    if (work?.pages?.length) {
      // A WINDOW of one language, not every page in every language: the whole
      // Bible in the HTML made this a 9.65 MB response. BookReader fetches the
      // rest from /api/works-ops/text as the reader moves.
      const inlineTexts = buildTextWindow(work.pages, 0, work.baseLanguage ?? 'en')
      const manifest = {
        slug: soulId,
        title: soul.title,
        subtitle: soul.subtitle ?? null,
        pageCount: work.pages.length,
        // Carry the hierarchy fields through. Dropping them here left `isCollection`
        // false on every DB-backed book, so the Book -> Chapter nav never rendered and
        // the Bible was a bare 1/1189 pager. @see BookReader.pageBook
        pages: work.pages.map(
          (
            p: {
              image: string | null
              title?: string | null
              book?: string | null
              bookName?: string | null
              chapter?: number | null
              ref?: string | null
            },
            i: number,
          ) => ({
            order: i,
            image: p.image ?? undefined,
            title: p.title ?? undefined,
            book: p.book ?? undefined,
            bookName: p.bookName ?? undefined,
            chapter: p.chapter ?? undefined,
            ref: p.ref ?? undefined,
          }),
        ),
        languages: work.languages ?? [],
        defaultLanguage: work.baseLanguage ?? 'en',
      }
      const pageSlugs = work.pages.map((p: { slug: string }) => p.slug)
      return (
        <BookReader
          manifest={manifest}
          inlineTexts={inlineTexts}
          textSlug={soulId}
          initialIndex={0}
          basePath={`/learn/${soulId}`}
          pageSlugs={pageSlugs}
          title={soul.title}
        />
      )
    }
    // file fallback
    const loaded = loadBookFromPublic(soul.bookSlug)
    if (loaded) {
      return (
        <BookReader manifest={loaded.manifest} initialIndex={0} basePath={`/learn/${soulId}`} pageSlugs={loaded.pageSlugs} title={soul.title} />
      )
    }
    return <BookReader manifestUrl={`/library/${soul.bookSlug}/manifest.json`} title={soul.title} />
  }

  // ── Document works → SoulViewer ──
  const docs = (work?.docs ?? []) as Array<WorkDoc & { body: string }>
  if (!docs.length) notFound()
  const allContents: Record<string, string> = {}
  for (const d of docs) allContents[d.id] = d.body

  const targetId = activeDocId || soul.defaultDoc
  const activeDoc = docs.find((d) => d.id === targetId) ?? docs[0]!

  return (
    <SoulViewer
      soul={{ ...soul, docs }}
      activeDocId={activeDoc.id}
      allContents={allContents}
      basePath={`/learn/${soulId}`}
    />
  )
}
