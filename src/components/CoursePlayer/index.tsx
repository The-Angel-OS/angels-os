'use client'

/**
 * CoursePlayer — the learner's side of a course Work. One SPA inside the block:
 * lesson rail, video pane, lesson body (quiz fences render inline), progress bar.
 *
 * Progress is the EXISTING workProgress map — chapterIdx = module, segIdx =
 * lesson. No second tracker.
 *
 * ponytail: no entitlement check here. Membership gating already gates the PAGE
 * this block sits on (shipped 260814); a second check in the block would be a
 * second thing to get wrong.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { WorkQuiz } from '@/components/WorkQuiz'
import { coursePercent, flattenLessons, type CourseContent } from '@/utilities/courseContent'

const AMBER = '#C4956A'
const TEAL = '#7AB5B0'

function VideoPane({ src }: { src: string }) {
  const embed = toEmbed(src)
  if (embed) {
    return (
      <div className="mb-5 w-full overflow-hidden rounded-lg" style={{ aspectRatio: '16/9' }}>
        <iframe
          src={embed}
          title="Lesson video"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
    )
  }
  return (
    <video src={src} controls playsInline className="mb-5 w-full rounded-lg" style={{ aspectRatio: '16/9' }} />
  )
}

/** YouTube/Vimeo → embed URL. Anything else plays as a file. */
export function toEmbed(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/)
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`
  return null
}

export function CoursePlayer({
  course,
  soulId,
  title,
  startAt,
}: {
  course: CourseContent
  soulId: string
  title?: string
  /** Resumed position from workProgress, if the reader is signed in. */
  startAt?: { chapterIdx: number; segIdx: number }
}) {
  const flat = useMemo(() => flattenLessons(course), [course])
  const [at, setAt] = useState(() => {
    const i = startAt
      ? flat.findIndex((l) => l.moduleIdx === startAt.chapterIdx && l.lessonIdx === startAt.segIdx)
      : 0
    return i >= 0 ? i : 0
  })

  const lesson = flat[at]

  // Save position when the lesson changes. Fire-and-forget: progress is a gift,
  // never a blocker, and a 401 (signed-out reader) is a normal outcome.
  useEffect(() => {
    if (!lesson) return
    void fetch('/api/works-ops/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        soulId,
        chapterIdx: lesson.moduleIdx,
        segIdx: lesson.lessonIdx,
        percent: coursePercent(course, lesson.moduleIdx, lesson.lessonIdx),
      }),
    }).catch(() => {})
  }, [lesson, soulId, course])

  const mdComponents = useMemo(
    () => ({
      code: ({ children, className }: { children?: React.ReactNode; className?: string }) =>
        className?.includes('language-quiz') ? (
          <WorkQuiz source={String(children ?? '')} soulId={soulId} chapter={lesson?.title} />
        ) : (
          <code className="rounded px-1.5 py-0.5 font-mono text-sm" style={{ background: 'rgba(0,0,0,0.25)', color: TEAL }}>
            {children}
          </code>
        ),
      pre: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    }),
    [soulId, lesson?.title],
  )

  const go = useCallback((i: number) => setAt(Math.max(0, Math.min(flat.length - 1, i))), [flat.length])

  if (!flat.length) {
    return <p className="container py-8 text-sm opacity-60">This course has no lessons yet.</p>
  }

  const percent = Math.round(((at + 1) / flat.length) * 100)

  return (
    <div className="container py-8">
      {title && <h2 className="mb-1 text-2xl font-bold">{title}</h2>}
      <div className="mb-6 h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'rgba(127,127,127,0.2)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: AMBER }} />
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        {/* Lesson rail */}
        <nav className="w-full shrink-0 md:w-64">
          {course.modules.map((m, mi) => (
            <div key={mi} className="mb-4">
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.2em] opacity-60">{m.title}</p>
              {m.lessons.map((l, li) => {
                const idx = flat.findIndex((f) => f.moduleIdx === mi && f.lessonIdx === li)
                const active = idx === at
                return (
                  <button
                    key={li}
                    type="button"
                    onClick={() => go(idx)}
                    className="mb-0.5 block w-full rounded px-2 py-1.5 text-left text-sm transition-colors"
                    style={{ background: active ? `${AMBER}22` : 'transparent', color: active ? AMBER : undefined }}
                  >
                    {idx + 1}. {l.title}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Lesson */}
        <article className="min-w-0 flex-1">
          <p className="mb-1 text-[11px] uppercase tracking-[0.2em] opacity-50">{lesson.moduleTitle}</p>
          <h3 className="mb-4 text-xl font-bold">{lesson.title}</h3>
          {lesson.video && <VideoPane src={lesson.video} />}
          {lesson.body && (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                {lesson.body}
              </ReactMarkdown>
            </div>
          )}

          <div className="mt-8 flex justify-between gap-3">
            <button
              type="button"
              onClick={() => go(at - 1)}
              disabled={at === 0}
              className="rounded-full px-4 py-2 text-sm transition-opacity disabled:opacity-30"
              style={{ border: `1px solid ${AMBER}66`, color: AMBER }}
            >
              ← Previous
            </button>
            <button
              type="button"
              onClick={() => go(at + 1)}
              disabled={at >= flat.length - 1}
              className="rounded-full px-4 py-2 text-sm transition-opacity disabled:opacity-30"
              style={{ border: `1px solid ${AMBER}66`, color: AMBER }}
            >
              Next →
            </button>
          </div>
        </article>
      </div>
    </div>
  )
}

export default CoursePlayer
