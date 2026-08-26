import React from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { loadCourse } from '@/utilities/courseChapters'
import { getWorkProgress } from '@/utilities/workProgress'
import { CoursePlayer } from '@/components/CoursePlayer'
import { AccessPanel } from '@/components/CoursePlayer/AccessPanel'
import { gateWorkBySlug } from '@/utilities/gateWork'

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
  const gated = await gateWorkBySlug(payload, work)
  if (!gated) return null
  const { work: doc, gate, product, user } = gated
  if (!gate.allowed) return <AccessPanel title={doc.title ?? undefined} reason={gate.reason} product={product} />

  const course = await loadCourse(payload, doc.id)

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

  return <CoursePlayer course={course} soulId={work} title={doc.title ?? undefined} startAt={startAt} />
}
