/**
 * Sweep the same two import defects off every Kessela page at once.
 *
 * The WordPress import turned the site's footer into page content, and it did it
 * identically on seven pages:
 *
 *   1. The four trust badges as one-line `content` blocks — "Trusted A+ Business",
 *      "14-Day Money-Back", "Warranty Guarantee" — sitting next to the `trustRow`
 *      that already renders all four with icons.
 *   2. The legal small print (ownership, FDA registration number, the medical
 *      disclaimer, the copyright line) buried under a heading that says
 *      "FDA Registered", which makes a disclaimer read as a fifth badge.
 *
 * This drops (1) and un-heads (2), moving the small print to the foot of the page
 * where small print goes. Each page keeps ITS OWN legal text — 96 says © 2026
 * where the rest say © 2015 — because normalising someone's copyright notice is
 * not a formatting decision.
 *
 * What it deliberately does NOT touch: the near-duplicate policy prose on
 * /refund-returns. Blocks 2 and 3 there look like copies of block 1 but each adds
 * the claim-form steps and the return address. That's the original's own
 * repetition, on a page whose wording is a legal commitment.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-badge-legal-sweep.ts
 * Idempotent — a swept page has nothing left to match.
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { updatePageLayout, type LayoutBlock } from './_updatePageLayout'

const payload = await getPayload({ config })

const tenants = await payload.find({
  collection: 'tenants', where: { slug: { equals: 'kessela' } }, limit: 1, depth: 0, overrideAccess: true,
})
const tenantId = (tenants.docs?.[0] as { id: number } | undefined)?.id
if (!tenantId) throw new Error('No kessela tenant.')

const BADGE = /^(Trusted A\+|14-Day Money|Warranty Guarantee|FDA Registered)/i

/** Every paragraph/heading string in a block, in order. */
const paras = (node: unknown): string[] => {
  const out: string[] = []
  const walk = (x: unknown): void => {
    if (Array.isArray(x)) return x.forEach(walk)
    if (!x || typeof x !== 'object') return
    const o = x as Record<string, unknown>
    if (o.type === 'heading' || o.type === 'paragraph') {
      const s = ((o.children as Array<{ text?: string }>) ?? [])
        .map((c) => c?.text ?? '')
        .join('')
        .trim()
      if (s) out.push(s)
    }
    Object.values(o).forEach(walk)
  }
  walk(node)
  return out
}

/** Drop the first child of the first column — the "FDA Registered" heading. */
const unhead = (block: LayoutBlock): LayoutBlock => {
  const cols = (block as { columns?: Array<{ richText?: { root?: { children?: unknown[] } } }> }).columns ?? []
  const first = cols[0]?.richText?.root
  if (first?.children?.length) first.children = first.children.slice(1)
  return { ...block, blockName: 'Legal' }
}

const pages = await payload.find({
  collection: 'pages',
  where: { tenant: { equals: tenantId } },
  limit: 0, depth: 0, overrideAccess: true,
})

let changed = 0
for (const doc of pages.docs as unknown as Array<{ id: number; slug: string; _status?: string | null; layout?: LayoutBlock[] }>) {
  const layout = doc.layout ?? []
  if (!layout.length) continue

  const hasTrustRow = layout.some((b) => (b as { blockType?: string }).blockType === 'trustRow')
  let legal: LayoutBlock | null = null
  let needsTrustRow = false
  const kept: LayoutBlock[] = []

  for (const block of layout) {
    if ((block as { blockType?: string }).blockType !== 'content') {
      kept.push(block)
      continue
    }
    const text = paras(block)
    if (!text.length || !BADGE.test(text[0]!)) {
      kept.push(block)
      continue
    }
    // A badge NAME and nothing else. Either it duplicates the page's trustRow, or
    // — on the pages that never got one — it IS the trust row, spelled out as
    // prose. Both cases end the same way: drop the text, and make sure the page
    // has the block. An items-less trustRow inherits the tenant's badges, so this
    // needs no copy and can't drift from the rest of the site.
    if (text.length === 1) {
      needsTrustRow = !hasTrustRow
      continue
    }
    // A badge name carrying the legal small print underneath it.
    legal = unhead(block)
  }

  if (needsTrustRow) kept.push({ blockType: 'trustRow', items: [] })
  if (legal) kept.push(legal)
  if (kept.length === layout.length && !legal && !needsTrustRow) continue

  await updatePageLayout(payload, doc, kept)
  changed++
  console.log(
    `${doc.slug}: ${layout.length} → ${kept.length}` +
      `${legal ? ' · legal to foot' : ''}${needsTrustRow ? ' · trustRow added' : ''}`,
  )
}

console.log(`swept ${changed} page(s)`)
