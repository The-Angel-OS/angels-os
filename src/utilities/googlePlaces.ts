/**
 * Google Places API utility — fetch reviews and business details.
 *
 * Used by the Reviews ecosystem to import Google reviews for tenants
 * that have a Google Places ID configured.
 *
 * Rate limiting: 1 request per 5 seconds per API key.
 * In-memory TTL cache: 15 minutes per placeId.
 *
 * Requires GOOGLE_PLACES_API_KEY env var.
 */

interface GoogleReview {
  authorName: string
  rating: number
  text: string
  time: number
  relativeTimeDescription: string
  profilePhotoUrl?: string
}

interface PlaceDetails {
  name: string
  rating: number
  totalRatings: number
  reviews: GoogleReview[]
  address: string
  placeId: string
}

// In-memory cache: placeId → { data, expiry }
const cache = new Map<string, { data: PlaceDetails; expiry: number }>()
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes

// Rate limiter: track last request time
let lastRequestTime = 0
const MIN_REQUEST_INTERVAL_MS = 5000 // 5 seconds

function getApiKey(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY || null
}

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now()
  const timeSinceLastRequest = now - lastRequestTime

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest),
    )
  }

  lastRequestTime = Date.now()
  return fetch(url)
}

/**
 * Fetch place details and reviews from Google Places API.
 * Returns cached data if available and not expired.
 */
export async function fetchPlaceReviews(placeId: string): Promise<PlaceDetails | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn('[Google Places] GOOGLE_PLACES_API_KEY not set')
    return null
  }

  // Check cache
  const cached = cache.get(placeId)
  if (cached && cached.expiry > Date.now()) {
    return cached.data
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=name,rating,user_ratings_total,reviews,formatted_address&key=${apiKey}`

    const response = await rateLimitedFetch(url)
    if (!response.ok) {
      console.error(`[Google Places] API error: ${response.status}`)
      return null
    }

    const data = await response.json()

    if (data.status !== 'OK') {
      console.error(`[Google Places] API status: ${data.status}`)
      return null
    }

    const result = data.result
    const details: PlaceDetails = {
      name: result.name || '',
      rating: result.rating || 0,
      totalRatings: result.user_ratings_total || 0,
      reviews: (result.reviews || []).map((r: any) => ({
        authorName: r.author_name || 'Anonymous',
        rating: r.rating || 0,
        text: r.text || '',
        time: r.time || 0,
        relativeTimeDescription: r.relative_time_description || '',
        profilePhotoUrl: r.profile_photo_url,
      })),
      address: result.formatted_address || '',
      placeId,
    }

    // Cache the result
    cache.set(placeId, { data: details, expiry: Date.now() + CACHE_TTL_MS })

    return details
  } catch (err) {
    console.error('[Google Places] Fetch error:', err)
    return null
  }
}

/**
 * Search for a business by name and return its place ID.
 */
export async function searchPlace(
  businessName: string,
  location?: string,
): Promise<{ placeId: string; name: string; address: string } | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.warn('[Google Places] GOOGLE_PLACES_API_KEY not set')
    return null
  }

  try {
    const query = location ? `${businessName} ${location}` : businessName
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,formatted_address&key=${apiKey}`

    const response = await rateLimitedFetch(url)
    if (!response.ok) return null

    const data = await response.json()

    if (data.status !== 'OK' || !data.candidates?.length) {
      return null
    }

    const candidate = data.candidates[0]
    return {
      placeId: candidate.place_id,
      name: candidate.name || businessName,
      address: candidate.formatted_address || '',
    }
  } catch (err) {
    console.error('[Google Places] Search error:', err)
    return null
  }
}

/**
 * Check if Google Places API is configured.
 */
export function isGooglePlacesAvailable(): boolean {
  return Boolean(getApiKey())
}
