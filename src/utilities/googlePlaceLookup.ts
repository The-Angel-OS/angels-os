/**
 * Find a business on Google — the Place ID, and what Google already knows.
 *
 * Hunting a Place ID by hand (open Maps, find the listing, dig the id out of a
 * share URL or the developer tool) is minutes per prospect and the single most
 * annoying step in standing a site up. Places API (New) Text Search answers it
 * from "business name + city" in one request.
 *
 * The rating and review count are the useful part beyond the id: a business
 * with 22 reviews at 4.6 already has proof and does not need a website pitch —
 * it needs the thing it is actually short of. That judgement is Kenneth's; this
 * just puts the facts in front of him instead of making him go look.
 *
 * Uses the same platform key as reviews and address verification.
 */

/**
 * One key for every Google Maps surface. These had drifted apart —
 * googlePlacesReviews read MAPS||PLACES and addressVerification read
 * API||MAPS, so a key set under GOOGLE_PLACES_API_KEY silently worked for one
 * and not the other. Config-free means the key you set is the key we find.
 */
export function googleMapsKey(): string | undefined {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.GOOGLE_PLACES_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    undefined
  )
}

export interface PlaceMatch {
  placeId: string
  name: string
  address?: string
  phone?: string
  website?: string
  rating?: number
  reviewCount?: number
  mapsUrl: string
}

export interface PlaceLookupResult {
  ok: boolean
  error?: string
  matches: PlaceMatch[]
}

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.rating',
  'places.userRatingCount',
].join(',')

/**
 * @param query free text — "Southern Computer Solutions Gainesville FL".
 *   Include the city: a bare trade name matches the wrong town nationwide.
 */
export async function findPlace(
  query: string,
  opts: { maxResults?: number } = {},
): Promise<PlaceLookupResult> {
  const q = (query || '').trim()
  if (!q) return { ok: false, error: 'query is required', matches: [] }

  const key = googleMapsKey()
  if (!key) return { ok: false, error: 'no Google Maps API key on this node', matches: [] }

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: q,
        maxResultCount: Math.min(Math.max(opts.maxResults ?? 5, 1), 10),
      }),
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, error: `places ${res.status}: ${body.slice(0, 160)}`, matches: [] }
    }
    const j = (await res.json()) as {
      places?: Array<{
        id?: string
        displayName?: { text?: string }
        formattedAddress?: string
        nationalPhoneNumber?: string
        websiteUri?: string
        rating?: number
        userRatingCount?: number
      }>
    }
    const matches = (j.places || [])
      .filter((p) => p.id)
      .map((p) => ({
        placeId: p.id as string,
        name: p.displayName?.text || '(unnamed)',
        address: p.formattedAddress,
        phone: p.nationalPhoneNumber,
        website: p.websiteUri,
        rating: p.rating,
        reviewCount: p.userRatingCount,
        mapsUrl: `https://www.google.com/maps/place/?q=place_id:${p.id}`,
      }))
    return { ok: true, matches }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), matches: [] }
  }
}

/** Digits only, last 10 — "(352) 278-4770" and "352-278-4770" are one number. */
export function samePhone(a?: string, b?: string): boolean {
  const d = (s?: string) => (s || '').replace(/\D/g, '').slice(-10)
  const x = d(a)
  return x.length === 10 && x === d(b)
}

export interface WebsiteCheck {
  url: string
  status: number | null
  finalUrl?: string
  /** The site does not serve a working page — dead link, gone, or server error. */
  dead: boolean
  /** The domain lands somewhere else entirely — parked, or aimed at a listing. */
  redirectsOffDomain: boolean
  note: string
}

/**
 * Does the website Google lists actually work?
 *
 * Found the hard way on 260821: a prospect's own domain 301'd to a Craigslist
 * post that had since returned 410 Gone. His Google listing had 22 reviews at
 * 4.6 and sent every one of those customers to a dead page — which nobody had
 * told him, because nobody types their own domain. "You have a website" and
 * "your website works" are different facts, and only one of them is checkable.
 */
export async function checkWebsite(url: string, timeoutMs = 15000): Promise<WebsiteCheck> {
  const raw = (url || '').trim()
  if (!raw) return { url: raw, status: null, dead: true, redirectsOffDomain: false, note: 'no url' }
  const target = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`

  const host = (u: string) => {
    try {
      return new URL(u).hostname.replace(/^www\./, '')
    } catch {
      return ''
    }
  }

  try {
    const res = await fetch(target, {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AngelOS-SiteCheck/1.0)' },
    })
    const finalUrl = res.url || target
    const offDomain = Boolean(host(finalUrl) && host(finalUrl) !== host(target))
    const dead = res.status >= 400
    return {
      url: target,
      status: res.status,
      finalUrl,
      dead,
      redirectsOffDomain: offDomain,
      note: dead
        ? `${res.status} — the page does not load${offDomain ? `, and the domain points at ${host(finalUrl)}` : ''}`
        : offDomain
          ? `loads, but the domain redirects to ${host(finalUrl)}`
          : 'loads',
    }
  } catch (e) {
    // A timeout or a DNS failure is, to a customer, the same as a dead site.
    return {
      url: target,
      status: null,
      dead: true,
      redirectsOffDomain: false,
      note: `unreachable — ${e instanceof Error ? e.message : String(e)}`,
    }
  }
}
