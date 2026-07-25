/**
 * One-off: upload the proposal deliverables into the media collection (tenant 22)
 * and add a "Proposal Documents" links section to the /proposal page — so the docs
 * are platform-hosted, not on Google Drive. Idempotent (reuses media by filename;
 * skips the links block if already present).
 *   node_modules/.bin/payload run src/scripts/_local/upload-neurocarepro-docs.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { createLexicalContent, createHeadingNode } from '@/utilities/lexicalHelpers'

const TENANT = 22
// HTML is a restricted media type (XSS), so the interactive deck stays as its
// published artifact link; the docs are self-hosted in the media collection.
const DECK_URL = 'https://claude.ai/code/artifact/a7cbc1c5-cfee-46e5-8315-6d4df5b16974'
const DOCS = [
  { file: 'neurocarepro-research.md', mime: 'text/markdown', label: 'Research Brief', alt: 'Technical & business research brief' },
  { file: 'neurocarepro-campaign-playbook.md', mime: 'text/markdown', label: 'Campaign Playbook', alt: 'LinkedIn-led outreach campaign playbook' },
  { file: 'neurocarepro-video-transcript.md', mime: 'text/markdown', label: 'Founder Video Transcript', alt: 'Transcript of the PLMT founder video' },
]

const payload = await getPayload({ config })
const fs = await import('fs')

const links: { label: string; url: string }[] = [{ label: 'The Presentation', url: DECK_URL }]
for (const d of DOCS) {
  const existing = await payload.find({
    collection: 'media',
    where: { and: [{ tenant: { equals: TENANT } }, { filename: { equals: d.file } }] },
    limit: 1, depth: 0, overrideAccess: true,
  })
  let url: string
  if (existing.docs[0]) {
    url = (existing.docs[0] as any).url
    console.log('DOC reused', d.file, url)
  } else {
    const buf = fs.readFileSync(`/tmp/${d.file}`)
    const created = await (payload.create as any)({
      collection: 'media',
      data: { alt: d.alt, tenant: TENANT },
      file: { data: buf, mimetype: d.mime, name: d.file, size: buf.length },
      overrideAccess: true,
    })
    url = created.url
    console.log('DOC uploaded', d.file, url)
  }
  if (url) links.push({ label: d.label, url })
}

// Add a "Proposal Documents" CTA (button links) to the /proposal page.
const home = await payload.find({
  collection: 'pages',
  where: { and: [{ slug: { equals: 'proposal' } }, { tenant: { equals: TENANT } }] },
  limit: 1, depth: 0, overrideAccess: true,
})
const page = home.docs[0] as any
if (!page) { console.log('NO_PROPOSAL_PAGE'); process.exit(1) }
const layout: any[] = Array.isArray(page.layout) ? page.layout : []
const marker = 'Proposal documents'
const already = layout.some((b) => JSON.stringify(b).includes(marker))
if (already) {
  console.log('DOCS_LINKS already present')
} else {
  const linkParagraph = (label: string, url: string) => ({
    type: 'paragraph', version: 1, direction: 'ltr', format: '', indent: 0,
    children: [{
      type: 'link', version: 3, direction: 'ltr', format: '', indent: 0,
      fields: { linkType: 'custom', url, newTab: true },
      children: [{ type: 'text', text: `↳ ${label}`, detail: 0, format: 0, mode: 'normal', style: '', version: 1 }],
    }],
  })
  const block = {
    blockType: 'content',
    columns: [{
      size: 'full' as const,
      richText: createLexicalContent([
        createHeadingNode('Proposal documents', 'h3'),
        ...links.map((l) => linkParagraph(l.label, l.url)),
      ]),
    }],
  }
  // Insert before the final CTA (keep the closing call-to-action last).
  const insertAt = Math.max(0, layout.length - 1)
  layout.splice(insertAt, 0, block)
  await payload.update({ collection: 'pages', id: page.id, data: { layout } as any, overrideAccess: true })
  console.log('DOCS_LINKS added to /proposal —', links.length, 'documents')
}
process.exit(0)
