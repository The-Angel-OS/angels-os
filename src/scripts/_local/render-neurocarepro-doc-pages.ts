/**
 * One-off: render the NeuroCare Pro proposal docs (markdown) as real Pages on
 * their portal (tenant 22) — on-brand, self-hosted, "you own it" — and repoint
 * the /proposal "Proposal documents" links at those pages instead of raw R2 .md.
 * Idempotent: upserts each page by slug; rewrites the links block in place.
 *   docker cp this in, then: node_modules/.bin/payload run <path>
 * Reads the markdown from /tmp (docker cp the artifacts in first).
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { convertMarkdownToLexical, editorConfigFactory } from '@payloadcms/richtext-lexical'
import { createLexicalContent, createHeadingNode } from '@/utilities/lexicalHelpers'

const TENANT = 22
const DECK_URL = 'https://claude.ai/code/artifact/a7cbc1c5-cfee-46e5-8315-6d4df5b16974'
const DOCS = [
  { file: 'neurocarepro-research.md', slug: 'proposal-research', title: 'Research Brief', label: 'Research Brief' },
  { file: 'neurocarepro-campaign-playbook.md', slug: 'proposal-campaign', title: 'Campaign Playbook', label: 'Campaign Playbook' },
  { file: 'neurocarepro-video-transcript.md', slug: 'proposal-transcript', title: 'Founder Video Transcript', label: 'Founder Video Transcript' },
]

const payload = await getPayload({ config })
const fs = await import('fs')
const editorConfig = await editorConfigFactory.default({ config: payload.config })

async function upsertPage(slug: string, title: string, richText: any) {
  const existing = await payload.find({
    collection: 'pages',
    where: { and: [{ slug: { equals: slug } }, { tenant: { equals: TENANT } }] },
    limit: 1, depth: 0, overrideAccess: true,
  })
  const data: any = {
    slug, title, _status: 'published', tenant: TENANT,
    hero: { type: 'lowImpact', richText: createLexicalContent([createHeadingNode(title, 'h1')]) },
    layout: [{ blockType: 'content', columns: [{ size: 'full', richText }] }],
    meta: { title: `${title} — NeuroCare Pro`, description: title },
  }
  if (existing.docs[0]) {
    await payload.update({ collection: 'pages', id: existing.docs[0].id, data, overrideAccess: true })
    console.log('PAGE updated', slug)
  } else {
    await payload.create({ collection: 'pages', data, overrideAccess: true })
    console.log('PAGE created', slug)
  }
}

// 1. Render each markdown doc as a page.
const links: { label: string; url: string }[] = [{ label: 'The Presentation', url: DECK_URL }]
for (const d of DOCS) {
  const md = fs.readFileSync(`/tmp/${d.file}`, 'utf8')
  const richText = convertMarkdownToLexical({ editorConfig, markdown: md })
  await upsertPage(d.slug, d.title, richText)
  links.push({ label: d.label, url: `/${d.slug}` })
}

// 2. Repoint the "Proposal documents" links block on /proposal.
const home = await payload.find({
  collection: 'pages',
  where: { and: [{ slug: { equals: 'proposal' } }, { tenant: { equals: TENANT } }] },
  limit: 1, depth: 0, overrideAccess: true,
})
const page = home.docs[0] as any
if (!page) { console.log('NO_PROPOSAL_PAGE'); process.exit(1) }
const layout: any[] = Array.isArray(page.layout) ? page.layout : []

const linkParagraph = (label: string, url: string) => ({
  type: 'paragraph', version: 1, direction: 'ltr', format: '', indent: 0,
  children: [{
    type: 'link', version: 3, direction: 'ltr', format: '', indent: 0,
    fields: { linkType: 'custom', url, newTab: !url.startsWith('/') },
    children: [{ type: 'text', text: `↳ ${label}`, detail: 0, format: 0, mode: 'normal', style: '', version: 1 }],
  }],
})
const docsBlock = {
  blockType: 'content',
  columns: [{
    size: 'full' as const,
    richText: createLexicalContent([
      createHeadingNode('Proposal documents', 'h3'),
      ...links.map((l) => linkParagraph(l.label, l.url)),
    ]),
  }],
}
const idx = layout.findIndex((b) => JSON.stringify(b).includes('Proposal documents'))
if (idx >= 0) layout[idx] = docsBlock
else layout.splice(Math.max(0, layout.length - 1), 0, docsBlock)
await payload.update({ collection: 'pages', id: page.id, data: { layout } as any, overrideAccess: true })
console.log('DOCS_LINKS repointed →', links.map((l) => l.url).join(', '))
process.exit(0)
