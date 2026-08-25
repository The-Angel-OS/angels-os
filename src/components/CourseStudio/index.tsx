'use client'

/**
 * CourseStudio — the author's side. Reorder lessons, upload video, write the
 * body (a ```quiz fence in it IS the quiz). Saves the whole course JSON to
 * works.content in one PUT-shaped POST.
 *
 * ponytail: edit the whole document and save it, rather than per-lesson
 * endpoints with optimistic patches. A course is kilobytes and has one author
 * at a time; last-write-wins is the honest model for that, and it is one
 * endpoint instead of six.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { normalizeCourse, type CourseContent } from '@/utilities/courseContent'

const AMBER = '#C4956A'

const btn = {
  border: `1px solid ${AMBER}66`,
  color: AMBER,
} as const

export function CourseStudio({ soulId, initial, title }: { soulId: string; initial: CourseContent; title?: string }) {
  const [course, setCourse] = useState<CourseContent>(initial)
  const [status, setStatus] = useState<string>('')
  const uploadFor = useRef<{ mi: number; li: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => setCourse(initial), [initial])

  const mutate = useCallback((fn: (c: CourseContent) => void) => {
    setCourse((prev) => {
      const next = normalizeCourse(JSON.parse(JSON.stringify(prev)))
      fn(next)
      return next
    })
    setStatus('')
  }, [])

  const save = useCallback(async () => {
    setStatus('Saving…')
    try {
      const res = await fetch('/api/works-ops/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug: soulId, content: course }),
      })
      setStatus(res.ok ? 'Saved' : `Not saved (${res.status})`)
    } catch {
      setStatus('Not saved — network')
    }
  }, [soulId, course])

  const pickVideo = (mi: number, li: number) => {
    uploadFor.current = { mi, li }
    fileRef.current?.click()
  }

  const onFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      const target = uploadFor.current
      e.target.value = ''
      if (!file || !target) return
      setStatus('Uploading…')
      try {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('_payload', JSON.stringify({ alt: file.name }))
        const res = await fetch('/api/media', { method: 'POST', body: fd, credentials: 'include' })
        const json = (await res.json()) as { doc?: { url?: string } }
        const url = json?.doc?.url
        if (!url) {
          setStatus(`Upload failed (${res.status})`)
          return
        }
        mutate((c) => {
          c.modules[target.mi].lessons[target.li].video = url
        })
        setStatus('Uploaded — remember to save')
      } catch {
        setStatus('Upload failed — network')
      }
    },
    [mutate],
  )

  return (
    <div className="container py-8">
      <div className="mb-5 flex items-center gap-3">
        <h2 className="text-2xl font-bold">{title || soulId}</h2>
        <button type="button" onClick={save} className="rounded-full px-4 py-1.5 text-sm" style={btn}>
          Save course
        </button>
        {status && <span className="text-sm opacity-70">{status}</span>}
      </div>

      <input ref={fileRef} type="file" accept="video/*" onChange={onFile} className="hidden" />

      {course.modules.map((m, mi) => (
        <section key={mi} className="mb-6 rounded-lg p-4" style={{ border: `1px solid ${AMBER}33` }}>
          <div className="mb-3 flex items-center gap-2">
            <input
              value={m.title}
              onChange={(e) => mutate((c) => { c.modules[mi].title = e.target.value })}
              className="flex-1 rounded bg-transparent px-2 py-1 font-bold outline-none"
              style={{ border: `1px solid ${AMBER}33` }}
            />
            <button type="button" onClick={() => mutate((c) => { if (mi > 0) c.modules.splice(mi - 1, 0, c.modules.splice(mi, 1)[0]) })} className="rounded px-2 py-1 text-xs" style={btn}>↑</button>
            <button type="button" onClick={() => mutate((c) => { if (mi < c.modules.length - 1) c.modules.splice(mi + 1, 0, c.modules.splice(mi, 1)[0]) })} className="rounded px-2 py-1 text-xs" style={btn}>↓</button>
            <button type="button" onClick={() => mutate((c) => { c.modules.splice(mi, 1) })} className="rounded px-2 py-1 text-xs" style={btn}>Delete module</button>
          </div>

          {m.lessons.map((l, li) => (
            <div key={li} className="mb-3 rounded p-3" style={{ background: 'rgba(127,127,127,0.06)' }}>
              <div className="mb-2 flex items-center gap-2">
                <input
                  value={l.title}
                  onChange={(e) => mutate((c) => { c.modules[mi].lessons[li].title = e.target.value })}
                  className="flex-1 rounded bg-transparent px-2 py-1 outline-none"
                  style={{ border: `1px solid ${AMBER}33` }}
                />
                <button type="button" onClick={() => mutate((c) => { if (li > 0) c.modules[mi].lessons.splice(li - 1, 0, c.modules[mi].lessons.splice(li, 1)[0]) })} className="rounded px-2 py-1 text-xs" style={btn}>↑</button>
                <button type="button" onClick={() => mutate((c) => { const ls = c.modules[mi].lessons; if (li < ls.length - 1) ls.splice(li + 1, 0, ls.splice(li, 1)[0]) })} className="rounded px-2 py-1 text-xs" style={btn}>↓</button>
                <button type="button" onClick={() => mutate((c) => { c.modules[mi].lessons.splice(li, 1) })} className="rounded px-2 py-1 text-xs" style={btn}>Delete</button>
              </div>

              <div className="mb-2 flex items-center gap-2">
                <input
                  value={l.video ?? ''}
                  placeholder="Video URL (YouTube, Vimeo, or an uploaded file)"
                  onChange={(e) => mutate((c) => { c.modules[mi].lessons[li].video = e.target.value })}
                  className="flex-1 rounded bg-transparent px-2 py-1 text-sm outline-none"
                  style={{ border: `1px solid ${AMBER}33` }}
                />
                <button type="button" onClick={() => pickVideo(mi, li)} className="rounded px-3 py-1 text-xs" style={btn}>Upload</button>
              </div>

              <textarea
                value={l.body ?? ''}
                placeholder={'Lesson body (markdown). A quiz is a ```quiz fence with { "question", "options", "answerIndex" }.'}
                onChange={(e) => mutate((c) => { c.modules[mi].lessons[li].body = e.target.value })}
                rows={6}
                className="w-full rounded bg-transparent px-2 py-1 font-mono text-xs outline-none"
                style={{ border: `1px solid ${AMBER}33` }}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={() => mutate((c) => { c.modules[mi].lessons.push({ title: `Lesson ${c.modules[mi].lessons.length + 1}` }) })}
            className="rounded-full px-3 py-1 text-xs"
            style={btn}
          >
            + Lesson
          </button>
        </section>
      ))}

      <button
        type="button"
        onClick={() => mutate((c) => { c.modules.push({ title: `Module ${c.modules.length + 1}`, lessons: [] }) })}
        className="rounded-full px-4 py-1.5 text-sm"
        style={btn}
      >
        + Module
      </button>
    </div>
  )
}

export default CourseStudio
