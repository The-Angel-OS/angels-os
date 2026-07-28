/**
 * One-off: add the "Why PLMT Is Different" MediaText section (text + David's video)
 * to the NeuroCare Pro home page, near the top. Idempotent. Run AFTER the rebuild
 * that ships the MediaText block:
 *   node_modules/.bin/payload run src/scripts/_local/add-neurocarepro-videoblock.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { updatePageLayout } from './_updatePageLayout'

const TENANT = 22

const BLOCK = {
  blockType: 'mediaText',
  eyebrow: 'The Technology',
  heading: 'Why NeuroCare Pro PLMT Is Different',
  body: `NeuroCare Pro's Pulsed Light Medical Technology (PLMT) is where light therapy meets targeted frequency medicine, surpassing traditional red-light and NIR devices that typically focus on a single chromophore.

PLMT utilizes multi-spectral, polychromatic red and NIR light with proprietary Nogier and Solfeggio frequency algorithms to stimulate multiple cellular targets simultaneously, including mitochondria and neural networks. This systems-level approach effectively addresses complex, multi-factorial conditions rather than just superficial symptoms.`,
  videoUrl: 'https://youtu.be/c_80DB54mJc',
  caption: "Founder & CTO David Christenson explains NeuroCare Pro's exclusive technology.",
  videoOnRight: true,
  ctaLabel: 'Read More About the PLMT Difference',
  ctaUrl: '/the-technology',
}

const payload = await getPayload({ config })

const home = await payload.find({
  collection: 'pages',
  where: { and: [{ slug: { equals: 'home' } }, { tenant: { equals: TENANT } }] },
  limit: 1, depth: 0, overrideAccess: true,
})
const page = home.docs[0] as any
if (!page) { console.log('NO_HOME_PAGE'); process.exit(1) }

const layout: any[] = Array.isArray(page.layout) ? page.layout : []
if (layout.some((b) => b?.blockType === 'mediaText')) {
  console.log('MEDIATEXT already present — leaving as is')
} else {
  // Insert after the first block (the welcome content) so it sits high on the page.
  const insertAt = Math.min(1, layout.length)
  layout.splice(insertAt, 0, BLOCK)
  await updatePageLayout(payload, page as never, layout, 'pages')
  console.log('MEDIATEXT added to home page', page.id, 'at index', insertAt)
}
process.exit(0)
