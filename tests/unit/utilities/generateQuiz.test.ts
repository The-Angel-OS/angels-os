import { describe, it, expect } from 'vitest'
import {
  generateQuizQuestions,
  appendQuizFence,
  hasQuizFence,
} from '@/utilities/generateQuiz'
import { parseQuiz } from '@/utilities/workQuiz'
import { generateQuizTool } from '@/utilities/leoQuizTool'

const CHAPTER = 'Safety first. '.repeat(40)

const good = JSON.stringify([
  { question: 'What comes first?', options: ['Safety', 'Speed', 'Cost', 'Style'], answerIndex: 0, explanation: 'It says so.' },
  { question: 'How many?', options: ['One', 'Two', 'Three', 'Four'], answerIndex: 2 },
])

describe('generateQuizQuestions', () => {
  it('refuses to quiz a chapter with almost nothing in it', async () => {
    expect(await generateQuizQuestions('too short', { modelFn: async () => good })).toEqual([])
  })

  it('accepts the fenced JSON models insist on returning', async () => {
    const qs = await generateQuizQuestions(CHAPTER, { modelFn: async () => '```json\n' + good + '\n```' })
    expect(qs).toHaveLength(2)
    expect(qs[0].question).toBe('What comes first?')
  })

  it('drops a malformed answer rather than writing a broken quiz', async () => {
    const bad = JSON.stringify([{ question: 'x', options: ['a', 'b'], answerIndex: 9 }])
    expect(await generateQuizQuestions(CHAPTER, { modelFn: async () => bad })).toEqual([])
  })

  it('honours count, clamped', async () => {
    let asked = ''
    await generateQuizQuestions(CHAPTER, {
      count: 99,
      modelFn: async (p) => { asked = p; return good },
    })
    expect(asked).toContain('Write 10 multiple-choice questions')
  })
})

describe('appendQuizFence', () => {
  it('writes a fence the reader can parse back', () => {
    const body = appendQuizFence('Some prose.', JSON.parse(good), 'Module 1')
    expect(hasQuizFence(body)).toBe(true)
    const raw = body.match(/```quiz\n([\s\S]*?)\n```/)![1]
    expect(parseQuiz(raw)).toMatchObject({ title: 'Module 1', questions: [{ answerIndex: 0 }, { answerIndex: 2 }] })
  })
})

describe('generate_quiz tool', () => {
  const updates: Array<Record<string, unknown>> = []
  const payload = {
    find: async ({ collection }: { collection: string }) =>
      collection === 'works'
        ? { docs: [{ id: 6, title: 'Handbook', owner: 'platform' }] }
        : collection === 'work-chapters'
          ? { docs: [{ id: 11, slug: 'intro', title: 'Intro', body: CHAPTER }] }
          : { docs: [] },
    update: async (args: Record<string, unknown>) => { updates.push(args); return {} },
  } as never

  const ctx = { userId: 1, roles: ['super_admin'], modelFn: async () => good }

  it('appends the quiz to the chapter it was asked about', async () => {
    const msg = await generateQuizTool(payload, { work: 'angel-os-handbook' }, ctx)
    expect(msg).toContain('2-question quiz')
    const body = (updates[0].data as { body: string }).body
    expect(hasQuizFence(body)).toBe(true)
    expect(body.startsWith(CHAPTER.trimEnd())).toBe(true)
  })

  it('will not silently overwrite a quiz someone already wrote', async () => {
    const withQuiz = {
      ...(payload as unknown as Record<string, unknown>),
      find: async ({ collection }: { collection: string }) =>
        collection === 'works'
          ? { docs: [{ id: 6, title: 'Handbook', owner: 'platform' }] }
          : { docs: [{ id: 11, slug: 'intro', title: 'Intro', body: appendQuizFence(CHAPTER, JSON.parse(good)) }] },
    } as never
    expect(await generateQuizTool(withQuiz, { work: 'angel-os-handbook' }, ctx)).toContain('already has a quiz')
    expect(await generateQuizTool(withQuiz, { work: 'angel-os-handbook', replace: true }, ctx)).toContain('quiz to')
  })

  it('refuses someone who cannot edit the training', async () => {
    const msg = await generateQuizTool(payload, { work: 'angel-os-handbook' }, { userId: 2, roles: [], modelFn: ctx.modelFn })
    expect(msg).toContain("don't have permission")
  })
})
