/**
 * Google Places reviews — server-side resolver for the GoogleReviews block.
 *
 * Uses the official Places API (New) Place Details endpoint — NOT scraping. One
 * platform-level key (GOOGLE_MAPS_API_KEY, shared with address verification)
 * serves every tenant, so merchants just paste their Place ID: config-free.
 * Returns the aggregate rating + review count + up to 5 reviews (the API cap).
 *
 * Prereq: the key's Google Cloud project must have "Places API (New)" enabled.
 *
 * ponytail: in-memory per-instance cache (6h TTL). Move to KV/Settings only if
 * multi-instance cache coherence ever matters — for a review widget it doesn't.
 *
 * @see https://developers.google.com/maps/documentation/places/web-service/place-details
 */
import { googleMapsKey } from '@/utilities/googlePlaceLookup'

export interface PlaceReview {
  author: string
  authorPhoto?: string
  rating: number
  text: string
  relativeTime: string
}

export interface PlaceReviewsResult {
  rating: number | null
  total: number
  reviews: PlaceReview[]
  error?: string
}

const TTL_MS = 6 * 60 * 60 * 1000 // 6h
const cache = new Map<string, { at: number; data: PlaceReviewsResult }>()

/**
 * Best-effort Place ID extraction, with the two things people actually paste.
 *
 * A merchant does not have a Place ID. They have whatever Google gave them:
 * a share link, a `?cid=` URL from their own listing, or a pin they dropped —
 * and until 260821 all three were stored verbatim and silently rendered
 * nothing. Both live blocks on the node were broken this way for months.
 *
 * A CID (the long number in `maps.google.com/?cid=…`) is a REAL identifier for
 * the right business, but Places API (New) rejects it outright — it is not
 * convertible without a lookup, so say so instead of failing at the API.
 */
export function extractPlaceId(input: string): string {
  const s = (input || '').trim()
  if (!s) return ''
  if (/^[A-Za-z0-9_-]{20,}$/.test(s) && !s.includes('/') && !/^\d+$/.test(s)) return s
  const m =
    s.match(/[?&]place_id=([^&]+)/) ||
    // ?q=place_id:ChIJ… — the form Google's own "share" gives, and the form
    // find_google_place hands back. Missing it meant pasting our OWN link failed.
    s.match(/place_id:([A-Za-z0-9_-]+)/) ||
    s.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/)
  if (m) return decodeURIComponent(m[1])
  const cid = s.match(/[?&]cid=(\d+)/) || (/^\d{8,}$/.test(s) ? [null, s] : null)
  if (cid) return `cid:${cid[1]}`
  return s
}

/** Human-readable reason an id will never resolve, or null if it might. */
export function placeIdProblem(id: string): string | null {
  if (!id) return 'No Place ID set on this block.'
  if (id.startsWith('cid:')) {
    return (
      'That is a Google CID, not a Place ID — Google will not accept it. ' +
      'Ask LEO to "find the Google place for <business name, city>" and paste the Place ID it gives back.'
    )
  }
  if (!/^[A-Za-z0-9_-]{20,}$/.test(id)) {
    return `"${id.slice(0, 40)}" is not a Place ID. It should look like ChIJ… — ask LEO to find it for you.`
  }
  return null
}

export async function fetchPlaceReviews(
  placeIdOrUrl: string,
  now: number = Date.now(),
): Promise<PlaceReviewsResult> {
  const placeId = extractPlaceId(placeIdOrUrl)
  if (!placeId) return { rating: null, total: 0, reviews: [], error: 'no place id' }

  const problem = placeIdProblem(placeId)
  if (problem) return { rating: null, total: 0, reviews: [], error: problem }

  const cached = cache.get(placeId)
  if (cached && now - cached.at < TTL_MS) return cached.data

  const key = googleMapsKey() || ''
  if (!key) return { rating: null, total: 0, reviews: [], error: 'no api key' }

  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'rating,userRatingCount,reviews',
      },
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { rating: null, total: 0, reviews: [], error: `places ${res.status}: ${body.slice(0, 120)}` }
    }
    const j = (await res.json()) as {
      rating?: number
      userRatingCount?: number
      reviews?: Array<{
        rating?: number
        text?: { text?: string }
        originalText?: { text?: string }
        authorAttribution?: { displayName?: string; photoUri?: string }
        relativePublishTimeDescription?: string
      }>
    }
    const reviews: PlaceReview[] = (j.reviews || []).map((r) => ({
      author: r.authorAttribution?.displayName || 'Google user',
      authorPhoto: r.authorAttribution?.photoUri,
      rating: Number(r.rating) || 0,
      text: r.text?.text || r.originalText?.text || '',
      relativeTime: r.relativePublishTimeDescription || '',
    }))
    const data: PlaceReviewsResult = {
      rating: typeof j.rating === 'number' ? j.rating : null,
      total: Number(j.userRatingCount) || 0,
      reviews,
    }
    cache.set(placeId, { at: now, data })
    return data
  } catch (e) {
    return { rating: null, total: 0, reviews: [], error: e instanceof Error ? e.message : String(e) }
  }
}
