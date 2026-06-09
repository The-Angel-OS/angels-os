import type { Metadata } from 'next'
import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import path from 'path'
import fs from 'fs'
import { getSoul, getAllSouls } from '@/souls'
import { SoulViewer } from './SoulViewer'
import { BookReader } from '@/components/Library/BookReader'
import { loadBookFromPublic } from '@/components/Library/bookManifestServer'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { tenantHeroImage } from '@/utilities/tenantHeroImage'

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
      alternates: { canonical: `${origin}/learn/${soulId}` },
      openGraph: {
        title: soul.title,
        description,
        type: 'book',
        url: `${origin}/learn/${soulId}`,
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
      url: `${origin}/learn/${soulId}`,
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

  // Book works render the illustrated-primer reader. We load the manifest
  // server-side so the reader opens instantly AND so deep-link URL sync has the
  // inferred per-page slugs. Falls back to the client-fetch path if unreadable.
  if (soul.bookSlug) {
    const loaded = loadBookFromPublic(soul.bookSlug)
    if (loaded) {
      return (
        <BookReader
          manifest={loaded.manifest}
          initialIndex={0}
          basePath={`/learn/${soulId}`}
          pageSlugs={loaded.pageSlugs}
          title={soul.title}
        />
      )
    }
    return <BookReader manifestUrl={`/library/${soul.bookSlug}/manifest.json`} title={soul.title} />
  }

  // Resolve active document
  const targetId = activeDocId || soul.defaultDoc
  const activeDoc = soul.docs.find((d) => d.id === targetId) ?? soul.docs[0]

  // Read markdown from docs/vision/{soul.id}/
  const docsBase = path.join(process.cwd(), 'docs', 'vision', soulId)

  // Preload all doc contents for client-side switching (small files, fast)
  const allContents: Record<string, string> = {}
  for (const doc of soul.docs) {
    try {
      const filePath = path.join(docsBase, doc.filename)
      allContents[doc.id] = fs.readFileSync(filePath, 'utf-8')
    } catch {
      allContents[doc.id] = `# ${doc.title}\n\n*Document not found.*`
    }
  }

  return (
    <SoulViewer
      soul={soul}
      activeDocId={activeDoc.id}
      allContents={allContents}
      basePath={`/learn/${soulId}`}
    />
  )
}
