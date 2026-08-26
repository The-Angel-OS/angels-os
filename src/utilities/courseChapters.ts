/**
 * A course is chapters, like every other Work.
 *
 * `works.content` (a jsonb blob) existed only because chapters had no editable
 * home. Now that they do, a LESSON is a chapter with a video and a `module`
 * label, stored where every other chapter lives — one editor, one progress map,
 * one place the sitemap can find it.
 *
 * Flat storage, two-level rail: `module` groups consecutive chapters. No nesting
 * and no second table.
 *
 * The in-memory `CourseContent` shape is unchanged, so the player and the studio
 * did not have to learn anything.
 */
import type { Payload } from 'payload'
import { normalizeCourse, type CourseContent } from './courseContent'

interface ChapterRow {
  order?: number | null
  module?: string | null
  title?: string | null
  video?: string | null
  body?: string | null
}

/** Chapter rows → the course the player renders. Consecutive `module` = one module. */
export function courseFromChapters(rows: ChapterRow[]): CourseContent {
  const modules: CourseContent['modules'] = []
  for (const r of [...rows].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))) {
    const name = (r.module || '').trim() || 'Course'
    let mod = modules[modules.length - 1]
    if (!mod || mod.title !== name) {
      mod = { title: name, lessons: [] }
      modules.push(mod)
    }
    mod.lessons.push({
      title: (r.title || '').trim(),
      ...(r.video ? { video: r.video } : {}),
      ...(r.body ? { body: r.body } : {}),
    })
  }
  return normalizeCourse({ modules })
}

/** The course → chapter rows, `order` sequential across the WHOLE course. */
export function chaptersFromCourse(course: CourseContent): ChapterRow[] {
  const rows: ChapterRow[] = []
  for (const m of course.modules) {
    for (const l of m.lessons) {
      rows.push({ order: rows.length, module: m.title, title: l.title, video: l.video ?? null, body: l.body ?? null })
    }
  }
  return rows
}

/** Load a Work's course from its chapters. */
export async function loadCourse(payload: Payload, workId: number | string): Promise<CourseContent> {
  const res = await payload.find({
    collection: 'work-chapters',
    where: { work: { equals: workId } },
    sort: 'order',
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  return courseFromChapters(res.docs as unknown as ChapterRow[])
}

/**
 * Replace a Work's chapters with this course. Delete-then-write: a course is
 * edited as a whole in the studio, and reconciling row identity would buy
 * nothing but a diffing bug.
 */
export async function saveCourse(payload: Payload, workId: number | string, course: CourseContent): Promise<void> {
  await payload.delete({ collection: 'work-chapters', where: { work: { equals: workId } }, overrideAccess: true })
  for (const row of chaptersFromCourse(course)) {
    await payload.create({ collection: 'work-chapters', data: { work: workId, ...row } as never, overrideAccess: true })
  }
}
