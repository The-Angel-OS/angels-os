/**
 * generateQuiz — turn a chapter into a short comprehension quiz.
 *
 * The point, in Ken's words: a small company onboarding an employee has four or
 * five trainings they need watched and answered for. Writing the questions is
 * the part nobody does. The video they already have; the quiz they don't.
 *
 * Nothing new is stored. A quiz already IS a ```quiz fence inside a chapter's
 * markdown (@see workQuiz.ts), so generating one means appending a fence to the
 * chapter body — same format a human authors by hand, same renderer, same
 * attempt endpoint, no schema.
 *
 * The model is injectable so the orchestration is testable without one, exactly
 * like worksTranslate.
 *
 * ponytail: multiple choice, because that is the only kind the format has. It
 * appends rather than replaces — an existing quiz is someone's work.
 */
import { generateText } from 'ai'
import { getModel, getFallbackModel } from '@/utilities/ai-gateway'
import { parseQuiz, type QuizQuestion } from '@/utilities/workQuiz'

export type QuizModelFn = (prompt: string, system: string) => Promise<string>

const SYSTEM = [
  'You write short comprehension quizzes for workplace training material.',
  'Return ONLY a JSON array — no prose, no markdown fence, no preamble.',
  'Each element is {"question": string, "options": [string, ...], "answerIndex": number, "explanation": string}.',
  'Give exactly four options. answerIndex is the 0-based index of the correct one.',
  'Questions must be answerable from the supplied text alone — never from outside knowledge.',
  'Wrong options must be plausible, not filler. Do not use "all of the above" or "none of the above".',
  'The explanation is one sentence saying why the answer is right.',
].join(' ')

export const gatewayQuizModel: QuizModelFn = async (prompt, system) => {
  const model = getModel() || getFallbackModel()
  if (!model) throw new Error('No model available (AI gateway not configured)')
  const { text } = await generateText({ model, system, prompt, maxOutputTokens: 2000 })
  return text
}

/** Models like to wrap JSON in a fence however firmly you ask them not to. */
function stripFence(raw: string): string {
  const t = raw.trim()
  const m = t.match(/^```(?:json)?\s*\n([\s\S]*?)\n?```$/)
  return (m ? m[1] : t).trim()
}

export interface GenerateQuizOptions {
  /** How many questions to ask for. Clamped to 1–10. */
  count?: number
  modelFn?: QuizModelFn
}

/**
 * Generate questions from chapter markdown. Returns [] when the text is too
 * thin to quiz or the model returned nothing usable — a caller should say so
 * rather than write an empty fence.
 */
export async function generateQuizQuestions(
  chapterMarkdown: string,
  opts: GenerateQuizOptions = {},
): Promise<QuizQuestion[]> {
  const text = chapterMarkdown.trim()
  if (text.length < 200) return []

  const count = Math.max(1, Math.min(10, Math.round(opts.count ?? 5)))
  const modelFn = opts.modelFn ?? gatewayQuizModel

  const raw = await modelFn(
    `Write ${count} multiple-choice questions covering the key points of this training material:\n\n${text.slice(0, 24000)}`,
    SYSTEM,
  )

  // Validate through the SAME parser the reader uses — if it will not parse as a
  // quiz there, it must not be written to a chapter here.
  const parsed = parseQuiz(stripFence(raw))
  return parsed ? parsed.questions.slice(0, count) : []
}

/** Append a ```quiz fence to chapter markdown. Returns the new body. */
export function appendQuizFence(body: string, questions: QuizQuestion[], title?: string): string {
  const payload = title ? { title, questions } : questions
  const fence = '```quiz\n' + JSON.stringify(payload, null, 2) + '\n```'
  return body.trimEnd() + '\n\n' + fence + '\n'
}

/** Does this chapter already carry a quiz? */
export function hasQuizFence(body: string): boolean {
  return /```quiz\b/.test(body)
}
