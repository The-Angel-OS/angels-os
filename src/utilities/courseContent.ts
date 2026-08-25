/**
 * courseContent — a course is a Work (`type: 'course'`) whose lessons live in
 * the `content` JSON column. No courses / modules / lessons collections: that is
 * four tables and a second progress tracker to keep in sync with the first one.
 *
 *   { modules: [ { title, lessons: [ { title, video?, body? } ] } ] }
 *
 * `body` is markdown, so a quiz inside a lesson is the SAME ```quiz fence the
 * reader already renders — one quiz format, one renderer. @see workQuiz.ts
 *
 * Progress is the existing workProgress map: chapterIdx = module, segIdx =
 * lesson. Nothing new to write down.
 */

export interface CourseLesson {
  title: string
  /** Uploaded media URL or a YouTube/Vimeo link — same handling as the Video block. */
  video?: string
  /** Markdown. May contain ```quiz fences. */
  body?: string
}

export interface CourseModule {
  title: string
  lessons: CourseLesson[]
}

export interface CourseContent {
  modules: CourseModule[]
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')

/**
 * Coerce whatever is in `works.content` into a course. Always returns a usable
 * shape — a half-written course must still open in the studio, and an empty one
 * is how every course starts.
 */
export function normalizeCourse(raw: unknown): CourseContent {
  const src = typeof raw === 'string' ? safeParse(raw) : raw
  const mods = (src as { modules?: unknown })?.modules
  if (!Array.isArray(mods)) return { modules: [] }

  return {
    modules: mods.map((m, mi) => {
      const mo = (m ?? {}) as { title?: unknown; lessons?: unknown }
      const lessons = Array.isArray(mo.lessons) ? mo.lessons : []
      return {
        title: str(mo.title) || `Module ${mi + 1}`,
        lessons: lessons.map((l, li) => {
          const lo = (l ?? {}) as { title?: unknown; video?: unknown; body?: unknown }
          return {
            title: str(lo.title) || `Lesson ${li + 1}`,
            ...(str(lo.video) ? { video: str(lo.video) } : {}),
            ...(typeof lo.body === 'string' && lo.body.trim() ? { body: lo.body } : {}),
          }
        }),
      }
    }),
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

/** Flat lesson list with its module/lesson coordinates — the player's rail. */
export function flattenLessons(course: CourseContent) {
  return course.modules.flatMap((m, mi) =>
    m.lessons.map((l, li) => ({ ...l, moduleIdx: mi, lessonIdx: li, moduleTitle: m.title })),
  )
}

/** 0–100, by lessons completed. A course with no lessons is 0, not NaN. */
export function coursePercent(course: CourseContent, moduleIdx: number, lessonIdx: number): number {
  const flat = flattenLessons(course)
  if (!flat.length) return 0
  const at = flat.findIndex((l) => l.moduleIdx === moduleIdx && l.lessonIdx === lessonIdx)
  if (at < 0) return 0
  return Math.round(((at + 1) / flat.length) * 100)
}
