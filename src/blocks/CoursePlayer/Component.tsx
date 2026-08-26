import React from 'react'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { normalizeCourse } from '@/utilities/courseContent'
import { getWorkProgress } from '@/utilities/workProgress'
import { CoursePlayer } from '@/components/CoursePlayer'
import { AccessPanel } from '@/components/CoursePlayer/AccessPanel'
import { resolveTrainingAccess } from '@/utilities/trainingAccess'

export type CoursePlayerProps = { work?: string | null }

/**
 * Loads the course + the reader's saved position, and gates it.
 *
 * The gate is the point: this block used to render the course to anyone who
 * could load the page, trusting whoever placed it to have gated the page. That
 * is fine until someone links straight to it.
 */
export const CoursePlayerBlockComponent: React.FC<CoursePlayerProps> = async ({ work }) => {
  if (!work) return null

  const payload = await getPayload({ config: configPromise })
  const res = await payload.find({
    collection: 'works',
    where: { slug: { equals: work } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = res.docs?.[0] as
    | { id: number; title?: string; content?: unknown; access?: string | null; product?: number | null; owner?: string | null }
    | undefined
  if (!doc) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let user: any = null
  let tenantId: number | string | null = null
  try {
    const h = await headers()
    user = (await payload.auth({ headers: h })).user
    const t = h.get('x-tenant-id')
    tenantId = t ? (/^\d+$/.test(t) ? Number(t) : t) : null
  } catch {
    /* signed out, or outside a request scope */
  }

  const gate = await resolveTrainingAccess(payload, user, doc, tenantId)
  if (!gate.allowed) {
    let product: { slug?: string | null; title?: string | null; priceInUSD?: number | null } | null = null
    if (gate.productId) {
      try {
        product = (await payload.findByID({
          collection: 'products',
          id: gate.productId,
          depth: 0,
          overrideAccess: true,
        })) as never
      } catch {
        /* a product that has gone missing must not take the page down */
      }
    }
    return <AccessPanel title={doc.title} reason={gate.reason} product={product} />
  }

  const course = normalizeCourse(doc.content)

  // Resume where they left off. Signed-out readers simply start at lesson one.
  let startAt: { chapterIdx: number; segIdx: number } | undefined
  if (user?.id) {
    try {
      const pos = (await getWorkProgress(payload, user.id))[work]
      if (pos) startAt = { chapterIdx: pos.chapterIdx, segIdx: pos.segIdx }
    } catch {
      /* resume is a nicety */
    }
  }

  return <CoursePlayer course={course} soulId={work} title={doc.title} startAt={startAt} />
}
