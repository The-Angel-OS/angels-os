/**
 * Set Kessela's trust badges ONCE, then put a bare TrustRow on every page.
 *
 * The badges now live on the TENANT, so each block instance carries no content —
 * it reads what the tenant configured. That is the point: 25 pages, one place to
 * edit, no chance of the warranty wording on page 9 disagreeing with page 3.
 *
 * Blocks that already carry their own items are LEFT ALONE and then emptied, so
 * this migrates the two hand-configured rows onto the tenant defaults rather
 * than leaving two sources of truth behind.
 *
 * Skips pages where a trust row makes no sense — legal boilerplate, the private
 * brief, and forms — because a badge strip under a privacy policy is noise.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-trust-sweep.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { updatePageLayout } from './_updatePageLayout'

const payload = await getPayload({ config })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const update = payload.update.bind(payload) as any

const TENANT_SLUG = 'kessela'

/** Pages a badge strip would only clutter. */
const SKIP = new Set([
  'brief',
  'privacy-policy',
  'terms-of-service',
  'cancel-order-form',
  'return-refund-request',
  'register-kessela',
])

const tenants = await payload.find({
  collection: 'tenants',
  where: { slug: { equals: TENANT_SLUG } },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const tenant = tenants.docs?.[0] as { id: number } | undefined
if (!tenant) {
  console.error(`No ${TENANT_SLUG} tenant.`)
  process.exit(1)
}

// ── 1. The badges, once, on the tenant ──────────────────────────────────────
await update({
  collection: 'tenants',
  id: tenant.id,
  data: {
    trustBadges: {
      items: [
        { icon: 'star', label: 'Trusted A+ Business', detail: 'BBB accredited' },
        { icon: 'return', label: '14-Day Money-Back', detail: 'Backed by a 14-day money-back guarantee' },
        { icon: 'rosette', label: 'Warranty Guarantee', detail: 'Backed by a 100% warranty' },
        { icon: 'shield', label: 'FDA Registered', detail: 'Class II medical device status' },
      ],
      footnote: 'FDA registration is a device listing — it is not FDA clearance or approval.',
    },
  },
  overrideAccess: true,
})
console.log('tenant trust badges set (4 items)')

// ── 2. A bare block on every page that should have one ──────────────────────
const pages = await payload.find({
  collection: 'pages',
  where: { tenant: { equals: tenant.id } },
  limit: 0,
  depth: 0,
  overrideAccess: true,
  sort: 'slug',
})

let added = 0
let emptied = 0
let skipped = 0

for (const doc of pages.docs as unknown as Array<{
  id: number
  slug: string
  _status?: string
  layout?: Array<Record<string, unknown>>
}>) {
  if (SKIP.has(doc.slug)) {
    skipped++
    continue
  }

  const layout = Array.isArray(doc.layout) ? [...doc.layout] : []
  const at = layout.findIndex((b) => b?.blockType === 'trustRow')

  if (at >= 0) {
    // Already present — strip its inline items so it falls through to the tenant.
    const hadItems = Array.isArray(layout[at].items) && (layout[at].items as unknown[]).length > 0
    if (!hadItems) continue
    layout[at] = { ...layout[at], items: [], footnote: null }
    emptied++
  } else {
    // Near the end: it is reassurance, not the message. On the buy page the
    // earlier explicit placement already sits high, and this branch won't run.
    layout.push({ blockType: 'trustRow' })
    added++
  }

  await updatePageLayout(payload, doc as never, layout, 'pages')
}

console.log(`\n${added} page(s) got a trust row, ${emptied} switched to tenant defaults, ${skipped} skipped.`)
console.log('Edit the badges once at: /admin/collections/tenants/' + tenant.id)
process.exit(0)
