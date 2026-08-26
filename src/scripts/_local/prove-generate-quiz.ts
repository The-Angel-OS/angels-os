/**
 * Run generate_quiz against the LIVE database and a real model, then show what
 * it wrote and put the chapter back exactly as it was.
 *
 * A quiz generator that only passes with a stubbed model has not been tested.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { generateQuizTool } from '@/utilities/leoQuizTool'
import { parseQuiz } from '@/utilities/workQuiz'

const payload = await getPayload({ config })
const WORK = 'angel-os-handbook'

const chapters = (
  await payload.find({
    collection: 'work-chapters',
    where: { work: { equals: 6 } },
    sort: 'order',
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
).docs as unknown as Array<{ id: number; slug?: string; title?: string; body?: string }>

const target = chapters.find((c) => (c.body ?? '').length > 800) ?? chapters[0]
const original = String(target.body ?? '')
console.log(`chapter ${target.slug} — ${original.length} chars`)

const msg = await generateQuizTool(
  payload,
  { work: WORK, chapter: target.slug, count: 3, replace: true },
  { userId: 1, roles: ['super_admin'] },
)
console.log(msg)

// Re-query. The return value is not the proof.
const after = (await payload.findByID({
  collection: 'work-chapters',
  id: target.id,
  depth: 0,
  overrideAccess: true,
})) as unknown as { body?: string }
const fence = String(after.body ?? '').match(/```quiz\n([\s\S]*?)\n```/)
const parsed = fence ? parseQuiz(fence[1]) : null
console.log(JSON.stringify(parsed, null, 2))

// Put it back.
await payload.update({
  collection: 'work-chapters',
  id: target.id,
  data: { body: original } as never,
  overrideAccess: true,
})
const restored = (await payload.findByID({
  collection: 'work-chapters',
  id: target.id,
  depth: 0,
  overrideAccess: true,
})) as unknown as { body?: string }
console.log('restored:', String(restored.body ?? '') === original)

process.exit(parsed && parsed.questions.length ? 0 : 1)
