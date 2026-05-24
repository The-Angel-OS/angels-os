import { setRequestLocale } from 'next-intl/server'
import { notFound } from 'next/navigation'
import path from 'path'
import fs from 'fs'
import { getSoul, getAllSouls } from '@/souls'
import { SoulViewer } from './SoulViewer'

export const dynamic = 'force-dynamic'

export async function generateStaticParams() {
  return getAllSouls().map((soul) => ({ soul: soul.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; soul: string }>
}) {
  const { soul: soulId } = await params
  const soul = getSoul(soulId)
  if (!soul) return {}
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

  // Resolve active document
  const targetId = activeDocId || soul.defaultDoc
  const activeDoc = soul.docs.find((d) => d.id === targetId) ?? soul.docs[0]

  // Read markdown from docs/vision/{soul.id}/ or docs/vision/rainmaker/
  const docsBase = path.join(process.cwd(), 'docs', 'vision', soulId)
  let content = ''
  try {
    const filePath = path.join(docsBase, activeDoc.filename)
    content = fs.readFileSync(filePath, 'utf-8')
  } catch {
    content = `# ${activeDoc.title}\n\n*Document not found at expected path.*`
  }

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
