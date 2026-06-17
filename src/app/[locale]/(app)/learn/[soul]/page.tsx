import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import path from 'path'
import fs from 'fs'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getSoul, getAllSouls } from '@/souls'
import { isWorkAvailable } from '@/souls/subscriptions'
import { getWorkJson } from '@/utilities/getWorkJson'
import { SoulViewer } from './SoulViewer'
import { BookReader } from '@/components/Library/BookReader'
import { loadBookFromPublic } from '@/components/Library/bookManifestServer'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { tenantHeroImage } from '@/utilities/tenantHeroImage'
import { resolveCanonicalOrigin } from '@/utilities/worksCanonical'

export const dynamic = 'force-dynamic'

export async function generateStaticParams() {
  return getAllSouls().map((soul) => ({ soul: soul.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; soul: string }>
}): Promise<Metadata> {
  const { soul: soulId } = await params
  const soul = getSoul(soulId)
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

  const soul = getSoul(soulId)
  if (!soul) notFound()

  // Lockdown: this Work must be subscribed to the current endeavor.
  const { tenant } = await resolveTenantFromHeaders()
  if (!isWorkAvailable(soulId, tenant?.slug)) notFound()

  // DB-first: assemble the Work from message-backed storage (Blob media + inline
  // translations). File-fallback retained during the transition.
  const payload = await getPayload({ config: configPromise })
  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || ''
  const origin = host ? `${h.get('x-forwarded-proto') || 'https'}://${host}` : ''
  const work = await getWorkJson({ payload, soulId, tenantSlug: tenant?.slug, origin })

  // ── Book works → the illustrated-primer reader ──
  if (soul.bookSlug) {
    if (work?.pages?.length) {
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
        <BookReader
          manifest={manifest}
          inlineTexts={inlineTexts}
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
  const allContents: Record<string, string> = {}
  if (work?.docs?.length) {
    for (const d of work.docs as Array<{ id: string; body: string }>) allContents[d.id] = d.body
  } else {
    const docsBase = path.join(process.cwd(), 'docs', 'vision', soulId)
    for (const doc of soul.docs) {
      try {
        allContents[doc.id] = fs.readFileSync(path.join(docsBase, doc.filename), 'utf-8')
      } catch {
        allContents[doc.id] = `# ${doc.title}\n\n*Document not found.*`
      }
    }
  }
  const targetId = activeDocId || soul.defaultDoc
  const activeDoc = soul.docs.find((d) => d.id === targetId) ?? soul.docs[0]

  return (
    <SoulViewer
      soul={soul}
      activeDocId={activeDoc.id}
      allContents={allContents}
      basePath={`/learn/${soulId}`}
    />
  )
}
