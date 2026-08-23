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
import { googleMapsKey } from '@/utilities/googlePlaceLookup'

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
  /**
   * The check a human still has to run, as data rather than prose, so a caller
   * can render it as a button instead of asking the person to go hunting.
   */
  manualCheck?: {
    name: string
    url: string
    /** What to type into that site's search box. */
    searchFor: string
    why: string
  }
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

/**
 * Florida's licensed child care register (the DCF CARES public search).
 *
 * NOT called server-side, deliberately. Their Angular app reaches
 * caresapi.myflfamilies.com with an OAuth token minted from a clientId and
 * clientSecret hardcoded in the public bundle, and runs reCAPTCHA v3 whose token
 * it then never attaches to the request — so the API would answer us. We do not
 * take that route: reCAPTCHA v3 is there because they do not want automated
 * traffic, the credential is theirs and rotatable, and a lookup that silently
 * dies is the worst possible failure for someone about to hand an address to
 * their probation officer. A link the person completes themselves cannot go
 * stale without them noticing.
 *
 * The search box is a component binding, not a route param, so there is no
 * prefill URL — hence `searchFor`, the exact string to type.
 */
const DCF_SEARCH_URL = 'https://caressearch.myflfamilies.com/'

const DCF_ADVISORY =
  'ADVISORY ONLY — Google Places does not list every state-licensed child-care facility. ' +
  'In Florida a manual DCF child-care search (myflfamilies.com / the DCF facility locator) is REQUIRED ' +
  'to confirm compliance. A "no zones found" result is NOT a legal clearance.'

// One resolver for every Google Maps surface — this used to read API||MAPS
// while the reviews client read MAPS||PLACES, so a key set under one name
// silently worked for one caller and not the other.
const mapsKey = googleMapsKey

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

/**
 * What to type into the DCF search: the city, or failing that the ZIP.
 *
 * Their search matches provider name / city / ZIP, not a street address, so
 * handing someone the full street address to paste returns nothing and reads
 * like the address is clear. City is the term that actually lists the homes
 * near them to eyeball.
 */
export function dcfSearchTermFor(address?: string): string {
  if (!address) return ''
  // "34730 St Joe Rd, Dade City, FL 33525" -> "Dade City"
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 3) return parts[parts.length - 3]!
  const zip = address.split(/[^0-9]+/).find((t) => t.length === 5)
  return zip ?? parts[0] ?? ''
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
    manualCheck: {
      name: 'Florida DCF licensed child care search',
      url: DCF_SEARCH_URL,
      searchFor: dcfSearchTermFor(opts.address),
      why: 'Google Places does not list state-licensed family day care homes — a daycare run out of a house on a residential street is invisible to it and still counts.',
    },
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
