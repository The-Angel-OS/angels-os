import React from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { loadCourse } from '@/utilities/courseChapters'
import { CourseStudio } from '@/components/CourseStudio'

export type CourseStudioProps = { work?: string | null }

/**
 * The studio renders for anyone; SAVING is gated by the endpoint, which is the
 * only gate that matters — a client-side hide is decoration, not access control.
 */
export const CourseStudioBlockComponent: React.FC<CourseStudioProps> = async ({ work }) => {
  if (!work) return null

  const payload = await getPayload({ config: configPromise })
  const res = await payload.find({
    collection: 'works',
    where: { slug: { equals: work } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = res.docs?.[0] as { id: number; title?: string } | undefined
  if (!doc) return null

  return <CourseStudio soulId={work} title={doc.title} initial={await loadCourse(payload, doc.id)} />
}
