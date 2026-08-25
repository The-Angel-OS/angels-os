/**
 * workQuiz — a quiz is a SEGMENT of a Work, not a collection.
 *
 * Chapters are markdown, so a quiz segment is a fenced ```quiz block carrying
 * JSON. Zero schema, zero migration, authored in the same editor as the prose,
 * and it renders anywhere the reader's markdown renders.
 *
 *   ```quiz
 *   { "question": "…", "options": ["a","b"], "answerIndex": 0, "explanation": "…" }
 *   ```
 *
 * An array of those objects is a multi-question quiz; `{ title, questions: [] }`
 * names it. That is the whole format.
 *
 * ponytail: multiple choice only. No free text, multi-select, banks, shuffling
 * or timers — add a `kind` to the question object when a real portal asks.
 */

export interface QuizQuestion {
  question: string
  options: string[]
  answerIndex: number
  explanation?: string
}

export interface ParsedQuiz {
  title?: string
  questions: QuizQuestion[]
}

function toQuestion(v: unknown): QuizQuestion | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const question = typeof o.question === 'string' ? o.question.trim() : ''
  const options = Array.isArray(o.options) ? o.options.map((x) => String(x)) : []
  const answerIndex = Number(o.answerIndex)
  if (!question || options.length < 2) return null
  if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) return null
  return {
    question,
    options,
    answerIndex,
    ...(typeof o.explanation === 'string' && o.explanation.trim()
      ? { explanation: o.explanation.trim() }
      : {}),
  }
}

/** Parse a ```quiz fence body. Returns null when it isn't a usable quiz. */
export function parseQuiz(raw: string): ParsedQuiz | null {
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }

  let title: string | undefined
  let list: unknown[]
  if (Array.isArray(data)) {
    list = data
  } else if (data && typeof data === 'object' && Array.isArray((data as { questions?: unknown }).questions)) {
    list = (data as { questions: unknown[] }).questions
    const t = (data as { title?: unknown }).title
    if (typeof t === 'string' && t.trim()) title = t.trim()
  } else {
    list = [data]
  }

  const questions = list.map(toQuestion).filter((q): q is QuizQuestion => q !== null)
  if (!questions.length) return null
  return { ...(title ? { title } : {}), questions }
}

/** answers[i] = the option index chosen for question i (-1 / undefined = skipped). */
export function scoreQuiz(questions: QuizQuestion[], answers: Array<number | undefined>) {
  const correct = questions.reduce((n, q, i) => (answers[i] === q.answerIndex ? n + 1 : n), 0)
  return { correct, total: questions.length }
}
