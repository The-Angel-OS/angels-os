import React from 'react'
import { headers } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { normalizeCourse } from '@/utilities/courseContent'
import { getWorkProgress } from '@/utilities/workProgress'
import { CoursePlayer } from '@/components/CoursePlayer'

export type CoursePlayerProps = { work?: string | null }

/** Loads the course JSON + the reader's saved position, then hands both to the player. */
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
  const doc = res.docs?.[0] as { title?: string; content?: unknown } | undefined
  if (!doc) return null

  const course = normalizeCourse(doc.content)

  // Resume where they left off. Signed-out readers simply start at lesson one.
  let startAt: { chapterIdx: number; segIdx: number } | undefined
  try {
    const { user } = await payload.auth({ headers: await headers() })
    if (user?.id) {
      const pos = (await getWorkProgress(payload, user.id))[work]
      if (pos) startAt = { chapterIdx: pos.chapterIdx, segIdx: pos.segIdx }
    }
  } catch {
    /* resume is a nicety */
  }

  return <CoursePlayer course={course} soulId={work} title={doc.title} startAt={startAt} />
}
