/**
 * generate_quiz — LEO writes the quiz so the trainer doesn't have to.
 *
 * A small company onboarding an employee has four or five trainings they need
 * watched and answered for. They have the videos. Nobody writes the questions.
 * This does: point LEO at a chapter, get a ```quiz fence appended to it — the
 * same format a human authors, rendered by the same reader, scored by the same
 * attempt endpoint. No new collection, no new schema.
 *
 * Lives outside leo-data-tools.ts on purpose: that file is already 19k lines.
 */
import type { Payload } from 'payload'
import { canManageWork } from '@/access/canManageWork'
import {
  generateQuizQuestions,
  appendQuizFence,
  hasQuizFence,
  type QuizModelFn,
} from '@/utilities/generateQuiz'

export interface QuizToolCtx {
  userId?: number
  roles?: string[]
  /** Injectable for tests. */
  modelFn?: QuizModelFn
}

export const GENERATE_QUIZ_TOOL = {
  name: 'generate_quiz',
  description:
    'Write a multiple-choice comprehension quiz from a training chapter and save it into that chapter. Use when someone wants employees to be tested on a training, lesson, or handbook section they have to read or watch. Identify the chapter by the Work slug (as in /learn/<work>) plus the chapter slug or its number. The quiz is appended to the chapter and appears for every learner immediately.',
  input_schema: {
    type: 'object' as const,
    properties: {
      work: { type: 'string', description: 'Work slug, e.g. "angel-os-handbook".' },
      chapter: {
        type: 'string',
        description: 'Chapter slug, or its 1-based number in the work. Omit to quiz the first chapter.',
      },
      count: { type: 'number', description: 'How many questions. Default 5, max 10.' },
      replace: {
        type: 'boolean',
        description: 'Replace an existing quiz in that chapter. Default false — an existing quiz is left alone.',
      },
    },
    required: ['work'],
  },
}

export async function generateQuizTool(
  payload: Payload,
  input: Record<string, unknown>,
  ctx: QuizToolCtx,
): Promise<string> {
  const workSlug = String(input.work ?? '').trim()
  if (!workSlug) return 'Error: which training? Give me the Work slug, e.g. "angel-os-handbook".'

  const work = (
    await payload.find({
      collection: 'works',
      where: { slug: { equals: workSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
  ).docs[0] as unknown as { id: number; title?: string; owner?: string } | undefined
  if (!work) return `Error: no training called "${workSlug}".`

  const allowed = await canManageWork(payload, { id: ctx.userId, roles: ctx.roles }, work.owner)
  if (!allowed) return `You don't have permission to edit "${work.title ?? workSlug}".`

  const wanted = String(input.chapter ?? '').trim()
  const asNumber = /^\d+$/.test(wanted) ? Number(wanted) : null

  const chapters = (
    await payload.find({
      collection: 'work-chapters',
      where: { work: { equals: work.id } },
      sort: 'order',
      limit: 0,
      depth: 0,
      overrideAccess: true,
    })
  ).docs as unknown as Array<{ id: number; slug?: string; title?: string; body?: string }>

  if (!chapters.length) return `"${work.title ?? workSlug}" has no chapters yet.`

  const chapter = !wanted
    ? chapters[0]
    : asNumber !== null
      ? chapters[asNumber - 1]
      : chapters.find((c) => c.slug === wanted || c.title?.toLowerCase() === wanted.toLowerCase())

  if (!chapter) {
    const names = chapters.slice(0, 12).map((c) => c.slug || c.title).filter(Boolean).join(', ')
    return `Error: no chapter "${wanted}" in that training. Chapters: ${names}`
  }

  const body = String(chapter.body ?? '')
  if (hasQuizFence(body) && input.replace !== true) {
    return `"${chapter.title ?? chapter.slug}" already has a quiz. Say "replace it" if you want a new one.`
  }

  const questions = await generateQuizQuestions(body, {
    count: typeof input.count === 'number' ? input.count : undefined,
    modelFn: ctx.modelFn,
  })
  if (!questions.length) {
    return `I couldn't write a quiz from "${chapter.title ?? chapter.slug}" — there isn't enough text in it to ask about.`
  }

  // Replacing means dropping every existing quiz fence first.
  const base = input.replace === true ? body.replace(/```quiz\n[\s\S]*?\n```\n?/g, '').trimEnd() : body

  await payload.update({
    collection: 'work-chapters',
    id: chapter.id,
    data: { body: appendQuizFence(base, questions) } as never,
    overrideAccess: true,
  })

  return `Added a ${questions.length}-question quiz to "${chapter.title ?? chapter.slug}" in ${work.title ?? workSlug}. Learners see it at the end of the chapter.`
}
