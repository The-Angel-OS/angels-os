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

  // Book works: the cover (first page) is the share image; spider the work.
  if (soul.bookSlug) {
    const loaded = loadBookFromPublic(soul.bookSlug)
    const h = await headers()
    const host = h.get('x-forwarded-host') || h.get('host') || ''
    const origin = host ? `${h.get('x-forwarded-proto') || 'https'}://${host}` : ''
    const cover = loaded?.manifest.pages?.[0]?.image
    const image = cover ? (cover.startsWith('http') ? cover : `${origin}${cover}`) : undefined
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

  return {
    title: `${soul.title} — Soul Viewer`,
    description: soul.description,
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
    />
  )
}
