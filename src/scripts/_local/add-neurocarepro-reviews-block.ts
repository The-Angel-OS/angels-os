/**
 * Add a Google Reviews block (NeuroCare Pro business — 4.8★/85) to the home page.
 *   node_modules/.bin/payload run src/scripts/_local/add-neurocarepro-reviews-block.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { updatePageLayout } from './_updatePageLayout'

const TENANT = 22
const PLACE_ID = 'ChIJGVrNKqjxwogRH8rgl41qVMM' // NeuroCare Pro - PLMT business listing

const payload = await getPayload({ config })
const home = await payload.find({ collection: 'pages', where: { and: [{ slug: { equals: 'home' } }, { tenant: { equals: TENANT } }] }, limit: 1, depth: 0, overrideAccess: true })
const page = home.docs[0] as any
if (!page) { console.log('NO_HOME'); process.exit(1) }
const layout: any[] = Array.isArray(page.layout) ? page.layout : []
if (layout.some((b) => b?.blockType === 'googleReviews')) {
  const b = layout.find((x) => x.blockType === 'googleReviews'); b.placeId = PLACE_ID
  await updatePageLayout(payload, page as never, layout, 'pages')
  console.log('REVIEWS updated placeId', PLACE_ID)
} else {
  layout.push({ blockType: 'googleReviews', placeId: PLACE_ID, heading: 'What our patients say', maxReviews: 5, minRating: 4, showAggregate: true })
  await updatePageLayout(payload, page as never, layout, 'pages')
  console.log('REVIEWS block added', PLACE_ID)
}
process.exit(0)
