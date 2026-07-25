/**
 * One-off: draft post on the NeuroCare Pro portal framing the follow-up video
 * (YouTube URL = placeholder; swap in admin before publishing) + one-page summary.
 * Idempotent by title. Run in container:
 *   node_modules/.bin/payload run src/scripts/_local/create-neurocarepro-video-post.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'

const TENANT = 22
const TITLE = 'One Platform You Own — The Angel OS Proposal for NeuroCare Pro'
const VIDEO_URL = 'https://youtu.be/REPLACE_ME' // ponytail: swap after YouTube upload

const BODY = `WHAT WE PROPOSE
Unify NeuroCare Pro's entire operation — website, store, CRM, AI, and mobile app — onto one platform you own and control, hosted in your office or your cloud. Your data, your server, your keys.

WHERE YOU ARE TODAY
WordPress + Avada (~112 pages), a separate cart, stacking plugin subscriptions, hundreds of daily calls handled by hand, and data scattered across rented systems.

WHAT YOU GET
- Separate sites for each business channel — two URLs, one unified platform, one admin, one Cloudflare-protected edge
- AI lead handling 24/7 — chat and phone (Vapi voice agent, live today: every call becomes a captured, qualified lead with a transcript)
- Talk-to-run store — inventory, pricing, and products updated conversationally, with role-scoped permissions
- Salesperson cockpit — lead queue, logged dispositions, AI-drafted outreach, follow-up that never forgets
- Branded mobile app — push notifications to customers and fresh leads to reps' phones
- Proactive monitoring — UptimeKuma availability checks + instant Gotify notifications; we know before you do

THE ECONOMICS
- Hosting (Railway): ~$20/month — or ~$0 self-hosted in your office
- AI usage: $25–50/month at a high estimate; free open-source models for routine work
- Storage: cents. Per-rep license fees: $0, ever.

WHY THIS STACK
Payload CMS + Next.js + PostgreSQL — the most mature open framework in the lineage that ran from phpNuke through DotNetNuke. Open source, auditable, portable: a private GitHub repo with all the keys handed to you. Any competent developer can maintain it — you are never locked to a vendor.

THE ASK
Bring me aboard as your technology arm: $20/hour, or $500/week retainer for priority access and 20–30 hours. Every work session is screen-recorded for your review — full transparency, always.

TO START
WooCommerce API access (or a product export) and a green light. The platform is already standing — this portal is running on it right now.

Kenneth Courtney · kenneth.courtney@gmail.com`

function textToLexical(text: string): any {
  const paragraphs = text.split(/\n\n+/).map((b) => b.trim()).filter(Boolean)
  const children = paragraphs.map((block) => ({
    type: 'paragraph',
    children: [{ type: 'text', text: block, detail: 0, format: 0, mode: 'normal', style: '', version: 1 }],
    direction: 'ltr', format: '', indent: 0, version: 1,
  }))
  return { root: { type: 'root', children, direction: 'ltr', format: '', indent: 0, version: 1 } }
}

const payload = await getPayload({ config })

const existing = await payload.find({
  collection: 'posts',
  where: { and: [{ tenant: { equals: TENANT } }, { title: { equals: TITLE } }] },
  limit: 1, depth: 0, overrideAccess: true,
})
if (existing.docs.length) {
  console.log('POST already exists id=' + (existing.docs[0] as any).id)
  process.exit(0)
}

const layout: any[] = [
  {
    blockType: 'mediaText',
    eyebrow: 'The Proposal',
    heading: 'Watch: NeuroCare Pro × The Angel OS',
    body: 'A 24-minute walkthrough: your current stack, what we automate, the live Vapi phone agent, the economics, and the working relationship I am proposing.',
    videoUrl: VIDEO_URL,
    caption: 'Ken Courtney walks the full proposal, live demos included.',
    videoOnRight: false,
  },
  { blockType: 'content', columns: [{ size: 'full', richText: textToLexical(BODY) }] },
]

const result = await (payload.create as any)({
  collection: 'posts',
  data: { title: TITLE, _status: 'draft', tenant: TENANT, layout },
  overrideAccess: true,
})
console.log(`OK post id=${result.id} slug=${result.slug} status=draft tenant=${TENANT} — set real YouTube URL then publish`)
process.exit(0)
