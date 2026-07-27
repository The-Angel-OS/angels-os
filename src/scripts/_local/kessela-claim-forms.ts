/**
 * Put the claim / return forms on Kessela's existing warranty and returns pages.
 *
 * David has ~2,500 units to support. Without a front door that captures the
 * order number and a photograph of the fault, every one of those is a phone
 * call and a "can you email me a picture?".
 *
 * ONE block placed TWICE with a different `type` — a warranty claim and a return
 * request are the same shape, which is the same reason Tickets discriminates on
 * `type` instead of being three collections.
 *
 * APPENDS to the existing layout rather than replacing it, so the mirrored
 * policy copy above the form survives. ⚠️ `import-site.ts` REPLACES layout — if
 * that is ever re-run over these paths, re-run this after it.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-claim-forms.ts
 * Idempotent — an existing ticketForm block on the page is updated in place.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const payload = await getPayload({ config })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const update = payload.update.bind(payload) as any

const tenants = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: 'kessela' } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenantId = (tenants.docs?.[0] as { id: number } | undefined)?.id
if (!tenantId) {
  console.error('No kessela tenant.')
  process.exit(1)
}

const FORMS: Array<{ slug: string; block: Record<string, unknown> }> = [
  {
    slug: 'warranty',
    block: {
      blockType: 'ticketForm',
      type: 'warranty',
      heading: 'Make a warranty claim',
      intro:
        'Have your order number and a photo of the belt to hand. A clear picture of the fault settles most claims without a phone call.',
      showOrderFields: true,
      confirmation:
        'Thanks — your claim is with the team. You can check its progress any time from your account, and we will reply there.',
    },
  },
  {
    slug: 'refund-returns',
    block: {
      blockType: 'ticketForm',
      type: 'return',
      heading: 'Request a return',
      intro:
        'Tell us the order number and why it is going back. If the belt is faulty rather than unwanted, use the warranty page instead — that route is quicker.',
      showOrderFields: true,
      confirmation:
        'Thanks — your return request is logged. We will confirm the next step and any return address from your account.',
    },
  },
]

for (const { slug, block } of FORMS) {
  const res = await payload.find({
    collection: 'pages',
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  // Cast the RESULT, and via `unknown` — once generate:types knows about
  // TicketFormBlock the layout union is no longer assignable to
  // Record<string, unknown> ("index signature is missing").
  const page = res.docs?.[0] as unknown as
    | { id: number; layout?: Array<Record<string, unknown>> }
    | undefined
  if (!page) {
    console.log(`  SKIP /${slug} — no such page on kessela`)
    continue
  }

  const layout = Array.isArray(page.layout) ? [...page.layout] : []
  const at = layout.findIndex((b) => b?.blockType === 'ticketForm')
  if (at >= 0) {
    layout[at] = { ...layout[at], ...block }
    console.log(`  updated form on /${slug}`)
  } else {
    layout.push(block)
    console.log(`  added form to /${slug}`)
  }

  await update({ collection: 'pages', id: page.id, data: { layout }, overrideAccess: true })
}

console.log('\nhttps://kessela.spacesangels.com/warranty  ·  /refund-returns')
process.exit(0)
