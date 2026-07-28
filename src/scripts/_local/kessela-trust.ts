/**
 * The trust row on Kessela's buy page.
 *
 * A $99 Amazon belt and a $599 Kessela look identical in a search result.
 * David's own words were that we're comparing a Ferrari to a tricycle and
 * nobody knows — this is the cheapest half of the answer, and unlike the spec
 * table it needs nothing from him: every claim here is already on kessela.com.
 *
 * ⚠️ The footnote is deliberate. "FDA Registered" without a qualifier reads as
 * cleared or approved, which it is not. Registration is a listing. Saying so in
 * small print costs nothing and is the difference between a credibility badge
 * and a liability.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-trust.ts
 * Idempotent — an existing trustRow on the page is updated in place.
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

const BLOCK = {
  blockType: 'trustRow',
  items: [
    { icon: 'shield', label: 'FDA Registered', detail: 'Class II device listing' },
    { icon: 'rosette', label: '1-Year Warranty', detail: 'Full manufacturer cover' },
    { icon: 'return', label: '14-Day Returns', detail: 'Money-back guarantee' },
    { icon: 'lock', label: 'Secure Checkout', detail: 'Encrypted card payment' },
  ],
  footnote:
    'FDA registration is a device listing — it is not FDA clearance or approval.',
}

/** Buy page first; the product page is where the decision actually happens. */
const SLUGS = ['buy-kessela-now', 'home']

for (const slug of SLUGS) {
  const res = await payload.find({
    collection: 'pages',
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { equals: slug } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const page = res.docs?.[0] as unknown as
    | { id: number; layout?: Array<Record<string, unknown>> }
    | undefined
  if (!page) {
    console.log(`  SKIP /${slug} — no such page`)
    continue
  }

  const layout = Array.isArray(page.layout) ? [...page.layout] : []
  const at = layout.findIndex((b) => b?.blockType === 'trustRow')
  if (at >= 0) {
    layout[at] = { ...layout[at], ...BLOCK }
    console.log(`  updated trust row on /${slug}`)
  } else {
    // Near the top: it has to be visible beside the price, not below the fold.
    layout.splice(Math.min(1, layout.length), 0, BLOCK)
    console.log(`  added trust row to /${slug}`)
  }

  await update({ collection: 'pages', id: page.id, data: { layout }, overrideAccess: true })
}

console.log('\nhttps://kessela.spacesangels.com/buy-kessela-now')
process.exit(0)
