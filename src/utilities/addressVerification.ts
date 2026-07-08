/**
 * addressVerification — residency-restriction proximity check (reentry housing).
 *
 * Ported from the housingforsexoffenders addressverifier: given a location, find
 * nearby child-safety zones (schools, preschools, playgrounds, child-care, community
 * centers) via Google Places and flag any within the restriction distance. Helps
 * place people in LEGAL housing — one of the hardest reentry barriers.
 *
 * ⚠️ ADVISORY ONLY. Google Places does NOT list every state-licensed child-care
 * facility (in Florida, DCF-licensed daycares must be checked on the DCF site,
 * which has no API). A "compliant" result here means "no restricted zone found in
 * Places data" — NOT a legal clearance. A manual DCF/records check is always
 * required. Callers must surface this.
 *
 * Requires GOOGLE_API_KEY (or GOOGLE_MAPS_API_KEY) with Places API (New) +
 * Geocoding API enabled.
 */

export interface RestrictedZone {
  name: string
  types: string[]
  lat: number
  lng: number
  distanceFeet: number
}

export interface AddressVerificationResult {
  ok: boolean
  error?: string
  address?: string
  lat?: number
  lng?: number
  distanceFeet: number
  /** True only if NO restricted zone was found within the distance (ADVISORY). */
  compliantAdvisory: boolean
  nearby: RestrictedZone[]
  failing: RestrictedZone[]
  /** The mandatory manual step Places can't cover. */
  advisory: string
}

const RESTRICTED_TYPES = [
  'playground',
  'child_care_agency',
  'preschool',
  'primary_school',
  'secondary_school',
  'community_center',
]

// Non-child-safety hits that share types with attractions — excluded (matches origin).
const EXCLUSION_KEYWORDS = ['pier', 'amusement_park', 'tourist_attraction', 'landmark']

const DCF_ADVISORY =
  'ADVISORY ONLY — Google Places does not list every state-licensed child-care facility. ' +
  'In Florida a manual DCF child-care search (myflfamilies.com / the DCF facility locator) is REQUIRED ' +
  'to confirm compliance. A "no zones found" result is NOT a legal clearance.'

function mapsKey(): string | undefined {
  return process.env.GOOGLE_API_KEY || process.env.GOOGLE_MAPS_API_KEY
}

/** Haversine distance between two points, in feet. */
function distanceFeet(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371 // km
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c * 3280.84 // km → feet
}

/** Geocode a free-text address → { lat, lng, formatted }. */
export async function geocodeAddress(
  address: string,
): Promise<{ lat: number; lng: number; formatted: string } | null> {
  const key = mapsKey()
  if (!key) throw new Error('GOOGLE_API_KEY not configured (Geocoding API).')
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${key}`
  const res = await fetch(url)
  const data = (await res.json()) as {
    status: string
    results?: Array<{ geometry: { location: { lat: number; lng: number } }; formatted_address: string }>
  }
  const first = data.results?.[0]
  if (!first) return null
  return { lat: first.geometry.location.lat, lng: first.geometry.location.lng, formatted: first.formatted_address }
}

/**
 * Verify a location against residency-restriction proximity. `restrictionFeet`
 * defaults to 1000 (Florida state statute); many localities extend to 2500.
 */
export async function verifyAddress(opts: {
  lat: number
  lng: number
  restrictionFeet?: number
  address?: string
}): Promise<AddressVerificationResult> {
  const restrictionFeet = opts.restrictionFeet && opts.restrictionFeet > 0 ? opts.restrictionFeet : 1000
  const base: AddressVerificationResult = {
    ok: false,
    distanceFeet: restrictionFeet,
    compliantAdvisory: false,
    nearby: [],
    failing: [],
    advisory: DCF_ADVISORY,
    ...(opts.address ? { address: opts.address } : {}),
    lat: opts.lat,
    lng: opts.lng,
  }

  const key = mapsKey()
  if (!key) return { ...base, error: 'GOOGLE_API_KEY not configured (Places API New).' }

  // Search a radius a bit larger than the restriction so edge cases are caught.
  const radiusMeters = Math.min(50000, Math.max(restrictionFeet * 0.3048 * 1.5, 500))

  const res = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'places.displayName,places.location,places.types',
    },
    body: JSON.stringify({
      locationRestriction: { circle: { center: { latitude: opts.lat, longitude: opts.lng }, radius: radiusMeters } },
      includedTypes: RESTRICTED_TYPES,
      maxResultCount: 20,
    }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string }
    places?: Array<{ displayName?: { text?: string }; location?: { latitude: number; longitude: number }; types?: string[] }>
  }
  if (data.error) return { ...base, error: `Places API: ${data.error.message || 'request failed'}` }

  const nearby: RestrictedZone[] = (data.places || [])
    .filter((p) => p.location)
    .map((p) => ({
      name: p.displayName?.text || 'Unnamed place',
      types: p.types || [],
      lat: p.location!.latitude,
      lng: p.location!.longitude,
      distanceFeet: Math.round(distanceFeet(opts.lat, opts.lng, p.location!.latitude, p.location!.longitude)),
    }))
    .filter(
      (z) =>
        !z.types.some((t) => EXCLUSION_KEYWORDS.includes(t)) &&
        !EXCLUSION_KEYWORDS.some((k) => z.name.toLowerCase().includes(k)),
    )
    .sort((a, b) => a.distanceFeet - b.distanceFeet)

  const failing = nearby.filter((z) => z.distanceFeet <= restrictionFeet)

  return {
    ...base,
    ok: true,
    compliantAdvisory: failing.length === 0,
    nearby,
    failing,
  }
}
