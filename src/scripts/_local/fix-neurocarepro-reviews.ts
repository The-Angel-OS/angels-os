/**
 * Set the real Google Place ID on the NeuroCare Pro home reviews block and test it.
 * Falls back to a business text-search if the address place has no reviews.
 *   node_modules/.bin/payload run src/scripts/_local/fix-neurocarepro-reviews.ts
 */
import { getPayload } from 'payload'
import config from '@payload-config'
import { updatePageLayout } from './_updatePageLayout'
import { fetchPlaceReviews } from '@/utilities/googlePlacesReviews'

const TENANT = 22
let placeId = 'ChIJcUQr1DuNwogRH8rgl41qVMM' // resolved from David's maps share link (address place)

const payload = await getPayload({ config })

// Test the address place first
let test = await fetchPlaceReviews(placeId)
console.log('ADDRESS_PLACE', JSON.stringify({ id: placeId, rating: test.rating, total: test.total, reviews: test.reviews.length, error: test.error }))

// If no reviews, search for the NeuroCare Pro BUSINESS listing (where reviews live)
if (!test.reviews.length) {
  const key = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key || '', 'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount' },
      body: JSON.stringify({ textQuery: 'NeuroCare Pro Klosterman Rd Tarpon Springs FL' }),
    })
    const j: any = await res.json()
    console.log('BUSINESS_SEARCH', JSON.stringify((j.places || []).slice(0, 3).map((p: any) => ({ id: p.id, name: p.displayName?.text, rating: p.rating, count: p.userRatingCount }))))
    const biz = (j.places || []).find((p: any) => p.userRatingCount > 0) || (j.places || [])[0]
    if (biz?.id && biz.id !== placeId) {
      const bizTest = await fetchPlaceReviews(biz.id)
      console.log('BUSINESS_PLACE', JSON.stringify({ id: biz.id, rating: bizTest.rating, total: bizTest.total, reviews: bizTest.reviews.length }))
      if (bizTest.reviews.length) { placeId = biz.id; test = bizTest }
    }
  } catch (e) { console.log('search err', (e as Error).message) }
}

// Update the reviews block on the home page with the chosen placeId
const home = await payload.find({ collection: 'pages', where: { and: [{ slug: { equals: 'home' } }, { tenant: { equals: TENANT } }] }, limit: 1, depth: 0, overrideAccess: true })
const page = home.docs[0] as any
if (page) {
  const layout: any[] = Array.isArray(page.layout) ? page.layout : []
  let changed = false
  for (const b of layout) { if (b?.blockType === 'googleReviews') { b.placeId = placeId; changed = true } }
  if (changed) {
    await updatePageLayout(payload, page as never, layout, 'pages')
    console.log('REVIEWS_BLOCK placeId set to', placeId, '— reviews available:', test.reviews.length)
  } else {
    console.log('NO googleReviews block on home page')
  }
}
process.exit(0)
