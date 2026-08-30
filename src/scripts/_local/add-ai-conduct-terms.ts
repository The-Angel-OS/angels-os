/**
 * Append an "How the assistant is instructed" section to the platform Terms of
 * Service.
 *
 * Ken's 260830 call: the seed prompt must survive, and the place a commitment
 * survives is the document people can hold you to. `genesisBreathSurvives.test.ts`
 * stops it being deleted from the code; this states publicly that it is there,
 * which is the half a test cannot do.
 *
 * Deliberately written as plain terms rather than devotional language — the
 * claim is factual and checkable ("this text is in every request"), and a reader
 * who does not share the sentiment can still verify the behaviour.
 *
 * Run: node_modules/.bin/payload run src/scripts/_local/add-ai-conduct-terms.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { h, p as para, rich, column } from './_lexical'
import { updatePageLayout } from './_updatePageLayout'

const payload = await getPayload({ config })

const platform = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: 'platform' } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenantId = (platform.docs[0] as { id: number } | undefined)?.id
if (tenantId == null) {
  console.log('PLATFORM_TENANT_NOT_FOUND')
  process.exit(1)
}

const found = await payload.find({
  collection: 'pages',
  where: { and: [{ slug: { equals: 'terms-of-service' } }, { tenant: { equals: tenantId } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
// Cast the RESULT through unknown — `layout` on the generated Page type is a
// discriminated union of every block, and this script only needs id/layout/_status.
const page = found.docs[0] as unknown as
  | { id: number; layout?: Array<Record<string, unknown>>; _status?: string }
  | undefined
if (!page) {
  console.log('TERMS_PAGE_NOT_FOUND')
  process.exit(1)
}

const HEADING = 'How the assistant is instructed'

// Idempotent: re-running must not stack a second copy of the section.
const already = JSON.stringify(page.layout || []).includes(HEADING)
if (already) {
  console.log('ALREADY_PRESENT — nothing to do')
  process.exit(0)
}

const layout = [
  ...(page.layout || []),
  {
    blockType: 'content',
    columns: [
      column('full', [
        h('h2', HEADING),
        para(
          'The assistant on this platform is called LEO. Every request it makes on your behalf begins with the same fixed instruction, loaded before your question, before your business details, and before any action it takes. Because it sits at the start of the context, it is present for every tool call the assistant makes.',
        ),
        para('The instruction reads, in full:'),
        para('A lamp unto feet — through darkness, a steady light guides each step with care.'),
        para(
          'It travels with a short set of principles: that every person has inherent worth regardless of productivity, compliance or any score; that the assistant’s actions are observable rather than hidden; that it exists to help rather than to govern; that it should leave a person better than it found them; and that it owns its mistakes.',
        ),
        para(
          'We state this in the terms rather than in marketing copy because it is a factual claim about how the software behaves, and one you can hold us to. It is covered by an automated test: if the instruction is removed from the code, the build fails. We may revise its wording, but we will not ship a version of this platform whose assistant is not carrying an instruction toward care.',
        ),
        para(
          'This is not a claim that the assistant is always right, and it is not a substitute for your judgement. It is a statement about what we ask of it before it acts for you.',
        ),
      ]),
    ],
  },
]

await updatePageLayout(payload, page, layout as never[], 'pages')
console.log('TERMS updated — added:', HEADING)
process.exit(0)
