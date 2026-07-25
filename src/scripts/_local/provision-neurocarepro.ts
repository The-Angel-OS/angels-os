/**
 * One-off: stand up the NeuroCare Pro prospect portal + Google Reviews on home.
 * Reachable at neurocarepro.payloadnuke.com (wildcard subdomain). Idempotent.
 * Run in container: node_modules/.bin/payload run src/scripts/_local/provision-neurocarepro.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { provisionPortal } from '@/utilities/provisionPortal'
import { fetchPlaceReviews } from '@/utilities/googlePlacesReviews'

const PLACE_ID = 'DPhtRG1ispLiDAzZA'

const payload = await getPayload({ config })

// 1. Provision the portal (tenant + endeavor + pages + nav + spaces + admin link)
const result = await provisionPortal(
  payload,
  {
    name: 'NeuroCare Pro',
    slug: 'neurocarepro',
    domain: 'neurocarepro.payloadnuke.com',
    endeavorType: 'service-provider',
    type: 'business',
    tagline: 'Advanced Pulsed Light Medical Technology',
    description:
      'NeuroCare Pro — advanced light-therapy (PLMT) wellness technology, Tarpon Springs, FL.',
    primaryColor: '#0EA5E9',
    secondaryColor: '#0F766E',
  },
  { actingUserId: 3 },
)
console.log('PROVISIONED', JSON.stringify({ id: result.tenant.id, slug: result.tenant.slug, url: result.url }))

// 2. Append Google Reviews block to the home page (idempotent)
const home = await payload.find({
  collection: 'pages',
  where: { and: [{ slug: { equals: 'home' } }, { tenant: { equals: result.tenant.id } }] },
  limit: 1,
  depth: 0,
  overrideAccess: true,
})
const page = home.docs[0] as any
if (!page) {
  console.log('NO_HOME_PAGE — skipping reviews block')
} else {
  const layout: any[] = Array.isArray(page.layout) ? page.layout : []
  const hasReviews = layout.some((b) => b?.blockType === 'googleReviews')
  if (hasReviews) {
    console.log('REVIEWS_BLOCK already present — leaving as is')
  } else {
    layout.push({
      blockType: 'googleReviews',
      placeId: PLACE_ID,
      heading: 'What our patients say',
      maxReviews: 5,
      minRating: 4,
      showAggregate: true,
    })
    await payload.update({
      collection: 'pages',
      id: page.id,
      data: { layout } as any,
      overrideAccess: true,
    })
    console.log('REVIEWS_BLOCK added to home page', page.id)
  }
}

// 3. Live-test the place id so we know if reviews will actually render for the demo
const test = await fetchPlaceReviews(PLACE_ID)
console.log('PLACE_TEST', JSON.stringify({ rating: test.rating, total: test.total, reviews: test.reviews.length, error: test.error }))

process.exit(0)
