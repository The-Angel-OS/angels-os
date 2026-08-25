'use client'

/**
 * WorkQuiz — renders a quiz segment. Used two ways, one renderer:
 *   - inline in the reader, from a ```quiz fence (SoulViewer's markdown `code`)
 *   - as a page block, <WorkQuiz> (src/blocks/WorkQuiz)
 *
 * Submitting posts the attempt to the learner's LEO DM. Answers-in-progress
 * live in localStorage.
 *
 * ponytail: localStorage for resume, not the settings bag — a handful of MCQs
 * on one screen is not a session worth a round-trip. Move it to
 * /api/works-ops/progress's settings bag when a quiz spans pages.
 */
import { useCallback, useEffect, useState } from 'react'
import { parseQuiz, scoreQuiz, type ParsedQuiz } from '@/utilities/workQuiz'

const AMBER = '#f5a623'
const TEAL = '#4fd1c5'
const RED = '#ff6b6b'

export function WorkQuiz({
  source,
  soulId,
  chapter,
}: {
  /** Raw JSON from the fence (or the block's field). */
  source: string
  soulId?: string
  chapter?: string
}) {
  const [quiz, setQuiz] = useState<ParsedQuiz | null>(null)
  const [answers, setAnswers] = useState<Array<number | undefined>>([])
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)

  const storageKey = `work-quiz:${soulId ?? 'anon'}:${chapter ?? ''}:${source.length}`

  useEffect(() => {
    setQuiz(parseQuiz(source))
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (saved) setAnswers(JSON.parse(saved) as Array<number | undefined>)
    } catch {
      /* resume is a nicety */
    }
  }, [source, storageKey])

  const choose = useCallback(
    (qi: number, oi: number) => {
      if (submitted) return
      setAnswers((prev) => {
        const next = prev.slice()
        next[qi] = oi
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next))
        } catch {
          /* private mode */
        }
        return next
      })
    },
    [submitted, storageKey],
  )

  const submit = useCallback(async () => {
    if (!quiz || saving) return
    setSaving(true)
    setSubmitted(true)
    const { correct, total } = scoreQuiz(quiz.questions, answers)
    try {
      await fetch('/api/works-ops/quiz-attempt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          soulId: soulId ?? '',
          chapter,
          title: quiz.title,
          correct,
          total,
          answers: answers.map((a) => (a == null ? -1 : a)),
        }),
      })
    } catch {
      // A lost attempt costs a record, not the answer they just learned.
    }
    setSaving(false)
  }, [quiz, answers, soulId, chapter, saving])

  // Not valid JSON / not a quiz → leave the author's block visible rather than
  // swallowing it, so a typo is obvious instead of invisible.
  if (!quiz) {
    return (
      <pre className="mb-5 overflow-x-auto rounded p-4" style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${RED}55` }}>
        <code className="font-mono text-sm" style={{ color: RED }}>{source}</code>
      </pre>
    )
  }

  const score = submitted ? scoreQuiz(quiz.questions, answers) : null
  const answered = quiz.questions.every((_, i) => answers[i] != null)

  return (
    <section
      className="mb-6 rounded-lg p-5"
      style={{ background: 'rgba(0,0,0,0.25)', border: `1px solid ${AMBER}44` }}
    >
      <p className="mb-4 font-orbitron text-[10px] font-bold uppercase tracking-[0.25em]" style={{ color: AMBER }}>
        {quiz.title || 'Check yourself'}
      </p>

      {quiz.questions.map((q, qi) => {
        const chosen = answers[qi]
        return (
          <div key={qi} className={qi ? 'mt-6' : ''}>
            <p className="mb-3 font-rajdhani text-[1.05rem] leading-relaxed" style={{ color: 'rgba(245,242,240,0.92)' }}>
              {quiz.questions.length > 1 ? `${qi + 1}. ` : ''}
              {q.question}
            </p>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, oi) => {
                const isChosen = chosen === oi
                const isAnswer = oi === q.answerIndex
                let color = 'rgba(245,242,240,0.85)'
                let border = 'rgba(245,242,240,0.15)'
                if (submitted && isAnswer) {
                  color = TEAL
                  border = `${TEAL}88`
                } else if (submitted && isChosen) {
                  color = RED
                  border = `${RED}88`
                } else if (isChosen) {
                  color = AMBER
                  border = `${AMBER}88`
                }
                return (
                  <button
                    key={oi}
                    type="button"
                    onClick={() => choose(qi, oi)}
                    disabled={submitted}
                    aria-pressed={isChosen}
                    className="rounded px-3 py-2 text-left font-rajdhani text-[1rem] transition-colors disabled:cursor-default"
                    style={{ border: `1px solid ${border}`, color, background: isChosen ? 'rgba(255,255,255,0.04)' : 'transparent' }}
                  >
                    {opt}
                  </button>
                )
              })}
            </div>
            {submitted && q.explanation && (
              <p className="mt-2 font-rajdhani text-sm italic" style={{ color: 'rgba(245,242,240,0.6)' }}>
                {q.explanation}
              </p>
            )}
          </div>
        )
      })}

      <div className="mt-5 flex items-center gap-4">
        {!submitted ? (
          <button
            type="button"
            onClick={submit}
            disabled={!answered || saving}
            className="rounded-full px-5 py-2 font-orbitron text-[11px] font-bold uppercase tracking-[0.2em] transition-opacity disabled:opacity-40"
            style={{ background: `${AMBER}26`, color: AMBER, border: `1px solid ${AMBER}66` }}
          >
            {saving ? 'Saving…' : 'Check answers'}
          </button>
        ) : (
          <p className="font-orbitron text-sm font-bold" style={{ color: score && score.correct === score.total ? TEAL : AMBER }}>
            {score?.correct} / {score?.total}
          </p>
        )}
      </div>
    </section>
  )
}

export default WorkQuiz
