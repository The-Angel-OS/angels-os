/**
 * One-off: create an "awesome" proposal page for NeuroCare Pro (tenant 22) at
 * /proposal — the partnership pitch, on their own portal. Idempotent (skips if a
 * 'proposal' page already exists). Uses shipped blocks (content, mediaText, cta).
 *   node_modules/.bin/payload run src/scripts/_local/add-neurocarepro-proposal-page.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { createLexicalContent, createHeadingNode, createParagraphNode } from '@/utilities/lexicalHelpers'

const TENANT = 22

function content(nodes: any[]) {
  return { blockType: 'content', columns: [{ size: 'full' as const, richText: createLexicalContent(nodes) }] }
}

const payload = await getPayload({ config })

const existing = await payload.find({
  collection: 'pages',
  where: { and: [{ slug: { equals: 'proposal' } }, { tenant: { equals: TENANT } }] },
  limit: 1, depth: 0, overrideAccess: true,
})
if (existing.docs[0]) { console.log('PROPOSAL page already exists', existing.docs[0].id); process.exit(0) }

const layout: any[] = [
  content([
    createHeadingNode('Own your platform. Automate your business.', 'h2'),
    createParagraphNode(
      'You have the product, the studio, and the science. The next unlock is one system — that you own and control — turning your hundreds of daily calls and your growing salesforce into a machine that sells.',
    ),
  ]),
  content([
    createHeadingNode('Your data, your server, your keys', 'h3'),
    createParagraphNode(
      'Angel OS unifies your catalog, customers, orders, content, leads, and communications onto one platform you own — hosted in your office or the cloud, secured anywhere by a Cloudflare tunnel with no open ports. For a medical company, controlling where your data lives is the point. I stand it up, maintain it, and train your team to run it.',
    ),
  ]),
  content([
    createHeadingNode('What we automate', 'h3'),
    createParagraphNode('• AI that answers inquiries 24/7 — qualifies leads and books appointments, in your voice.'),
    createParagraphNode('• A personal portal for every salesperson — prioritized leads, dispositioning, AI-drafted outreach — tools you own, not rented CRM seats.'),
    createParagraphNode('• A store you run by talking to it — update inventory and pricing by voice. Live today.'),
    createParagraphNode('• Before/after result cards — visual proof, built for what light therapy sells.'),
    createParagraphNode('• A branded mobile app with push — meet customers where they actually are.'),
    createParagraphNode('• Telephony that routes calls to the AI for pre-qualification (foundation built).'),
  ]),
  {
    blockType: 'mediaText',
    eyebrow: 'The Technology',
    heading: 'Why NeuroCare Pro PLMT Is Different',
    body: 'Enterprise foundations — an actively-developed open platform (Payload CMS), a fast modern stack, and an AI layer wired into everything. No proprietary black box; your platform is an asset you hold, not a subscription you rent.',
    videoUrl: 'https://youtu.be/c_80DB54mJc',
    caption: "Founder & CTO David Christenson explains NeuroCare Pro's exclusive technology.",
    videoOnRight: true,
  },
  content([
    createHeadingNode('Negligible, predictable cost', 'h3'),
    createParagraphNode(
      'No per-seat SaaS, no plugin sprawl. Self-host is essentially the electricity to keep a machine on; the cloud is one small ~$20/month instance; AI is pay-for-what-you-use and can run on a free local model. The platform is designed to fund its own infrastructure as it earns.',
    ),
  ]),
  {
    blockType: 'cta',
    richText: createLexicalContent([
      createHeadingNode("Let's turn the flood of calls into your advantage.", 'h3'),
      createParagraphNode(
        'A short pilot: I unify NeuroCare Pro onto a platform you own, migrate your content, wire the store and the AI, and put your salesforce in the cockpit — side by side against the manual process eating your days.',
      ),
    ]),
    links: [
      { link: { type: 'custom' as const, label: 'View Your Portal', url: '/', appearance: 'default' } },
      { link: { type: 'custom' as const, label: 'Explore the Shop', url: '/shop', appearance: 'outline' } },
    ],
  },
]

const created = await payload.create({
  collection: 'pages',
  depth: 0,
  overrideAccess: true,
  data: {
    slug: 'proposal',
    title: 'Your Proposal',
    _status: 'published',
    tenant: TENANT,
    hero: {
      type: 'lowImpact',
      richText: createLexicalContent([
        createHeadingNode('NeuroCare Pro × Angel OS', 'h1'),
        createParagraphNode('A partnership: automate your business on a platform you own.'),
      ]),
    },
    layout,
    meta: {
      title: 'Your Proposal — NeuroCare Pro × Angel OS',
      description: 'Automate NeuroCare Pro on a platform you own and control.',
    },
  } as any,
})
console.log('PROPOSAL page created', created.id, '→ /proposal')
process.exit(0)
