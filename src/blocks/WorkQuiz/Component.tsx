import React from 'react'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { getWorkJson } from '@/utilities/getWorkJson'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { WorkQuiz } from '@/components/WorkQuiz'

export type WorkQuizProps = {
  work?: string | null
  chapter?: string | null
}

/** Every ```quiz fence in a chunk of chapter markdown. */
function quizFences(md: string): string[] {
  return [...md.matchAll(/```quiz\s*\n([\s\S]*?)```/g)].map((m) => m[1])
}

/**
 * The quiz lives in the Work's chapter markdown — this block just surfaces it on
 * a page. Same renderer as the reader, so a quiz never has two versions.
 *
 * ponytail: no quiz field on the block. Content authored twice drifts.
 */
export const WorkQuizBlockComponent: React.FC<WorkQuizProps> = async ({ work, chapter }) => {
  if (!work) return null

  const h = await headers()
  const host = h.get('x-forwarded-host') || h.get('host') || ''
  const origin = host ? `${h.get('x-forwarded-proto') || 'https'}://${host}` : ''

  const { tenant } = await resolveTenantFromHeaders()
  const payload = await getPayload({ config: configPromise })
  const json = await getWorkJson({
    payload,
    soulId: work,
    tenantSlug: tenant?.slug ?? null,
    origin,
  })
  if (!json) return null

  // Books expose `pages` (slug + text), documents expose `docs` (id + body).
  const units: Array<{ id: string; md: string }> = Array.isArray(json.pages)
    ? json.pages.map((p: { slug?: string; text?: string }) => ({ id: String(p.slug ?? ''), md: p.text ?? '' }))
    : Array.isArray(json.docs)
      ? json.docs.map((d: { id?: string; body?: string }) => ({ id: String(d.id ?? ''), md: d.body ?? '' }))
      : []

  const wanted = chapter?.trim()
  const sources = units
    .filter((u) => !wanted || u.id === wanted)
    .flatMap((u) => quizFences(u.md).map((src) => ({ src, chapter: u.id })))

  if (!sources.length) return null

  return (
    <div className="container">
      {sources.map((s, i) => (
        <WorkQuiz key={`${s.chapter}-${i}`} source={s.src} soulId={work} chapter={s.chapter} />
      ))}
    </div>
  )
}
