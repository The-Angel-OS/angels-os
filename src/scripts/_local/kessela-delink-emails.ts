/**
 * Replace mailto: links and bare email addresses with internal forms.
 *
 * A brochure site tells you to email someone. A system that supports itself
 * gives you a form, a record, and a queue — so a return request becomes a
 * TICKET with a status rather than a message in an inbox that may or may not be
 * read. Every mailto: on the site is a hole in that loop.
 *
 * Walks the Lexical richText tree, rewrites `mailto:` link nodes to an internal
 * path, and replaces the addresses where they appear as plain prose too — a link
 * fixed while the sentence still reads "email us at support@…" is only half done.
 *
 * Run: pnpm payload run src/scripts/_local/kessela-delink-emails.ts
 * Idempotent — running twice changes nothing the second time.
 */
import { getPayload } from 'payload'
import config from '@payload-config'

import { updatePageLayout } from './_updatePageLayout'

const payload = await getPayload({ config })

/** Where each address should send someone instead. */
const LINK_TARGET = '/contact'

/** Prose replacements — the sentence has to make sense, not just the href. */
const PROSE: Array<[RegExp, string]> = [
  [/\bsupport@kessela\.com\b/gi, 'our contact form'],
  [/\binfo@kessela\.com\b/gi, 'our contact form'],
  [/\bcontact us directly at our contact form\b/gi, 'contact us using our contact form'],
  [/\bsent to us at our contact form\b/gi, 'sent to us using our contact form'],
]

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

let links = 0
let prose = 0

/**
 * Generic deep walk. Recurses over EVERY value rather than a known set of keys —
 * the first version only followed `children` and `root`, which never reached
 * `layout[].columns[].richText.root` and silently rewrote nothing while
 * reporting success. Structure-specific traversal is how you get a clean run and
 * an unchanged database.
 */
function walk(node: unknown): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach(walk)
    return
  }
  const n = node as Record<string, unknown>

  // A link node pointing at an inbox.
  const fields = n.fields as Record<string, unknown> | undefined
  const url = typeof fields?.url === 'string' ? fields.url : ''
  if (url.toLowerCase().startsWith('mailto:')) {
    fields!.url = LINK_TARGET
    fields!.linkType = 'custom'
    fields!.newTab = false
    links++
  }

  // The prose around it.
  if (typeof n.text === 'string') {
    let text = n.text
    for (const [re, to] of PROSE) text = text.replace(re, to)
    if (text !== n.text) {
      n.text = text
      prose++
    }
  }

  for (const v of Object.values(n)) walk(v)
}

const pages = await payload.find({
  collection: 'pages',
  where: { tenant: { equals: tenantId } },
  limit: 0,
  depth: 0,
  overrideAccess: true,
  sort: 'slug',
})

for (const doc of pages.docs as unknown as Array<{
  id: number
  slug: string
  _status?: string
  layout?: Array<Record<string, unknown>>
}>) {
  const before = JSON.stringify(doc.layout ?? [])
  if (!/mailto:|@kessela\.com/i.test(before)) continue

  const layout = JSON.parse(before) as Array<Record<string, unknown>>
  layout.forEach(walk)

  const after = JSON.stringify(layout)
  if (after === before) continue

  await updatePageLayout(payload, doc as never, layout, 'pages')
  console.log(`  rewrote /${doc.slug}`)
}

console.log(`\n${links} mailto link(s) repointed to ${LINK_TARGET}, ${prose} text node(s) reworded.`)
process.exit(0)
