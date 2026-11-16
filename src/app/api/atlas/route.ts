import { NextResponse } from 'next/server'
import mlbArchive from '@/data/mlb-archive.json'

export const dynamic = 'force-dynamic'

interface ScannedPlace {
  id: string
  name: string
  city: string | null
  state: string | null
  country: string | null
  latitude: string
  longitude: string
  category: string
  existence: string
  construction: string | null
  photo: string | null
  sourceUrl: string | null
  description: string
  status: string
  isLiveScan?: boolean
}

/**
 * Map Wikidata architectural/building classes or user filter preset into
 * SPARQL Q-IDs for live regional scanning.
 */
const SCAN_FILTER_QIDS: Record<string, string[]> = {
  all: [
    'Q19844914', // National Register of Historic Places listed place
    'Q51576574', // Carnegie library
    'Q35112127', // historic building
    'Q32815',    // mosque / temple
    'Q2977',     // cathedral
    'Q16970',    // church building
    'Q34627',    // synagogue
    'Q25550691', // courthouse
    'Q35054',    // post office
    'Q2555896',  // capitol building
    'Q55488',    // railway station
    'Q751876',   // chateau / palace
    'Q23413',    // castle
    'Q33506',    // museum
    'Q7075',     // library
  ],
  carnegie: ['Q51576574', 'Q7075'],
  post_office: ['Q35054', 'Q156362'],
  government: ['Q25550691', 'Q2555896', 'Q543654', 'Q24354'],
  religious: ['Q2977', 'Q16970', 'Q32815', 'Q44613'],
  palace_castle: ['Q751876', 'Q23413', 'Q16560', 'Q57821'],
  asylum_hospital: ['Q2109993', 'Q16917', 'Q3914'],
}

function classifyScanCategory(label: string, desc: string, filterKey: string): string {
  const text = `${label} ${desc}`.toLowerCase()
  if (filterKey === 'carnegie' || /library|museum|gallery|institute/i.test(text)) return 'Museum & Library'
  if (filterKey === 'post_office' || filterKey === 'government' || /post office|custom house|courthouse|capitol|city hall|federal|armory/i.test(text)) {
    return 'Government'
  }
  if (filterKey === 'religious' || /cathedral|church|basilica|temple|mosque|chapel|synagogue|abbey/i.test(text)) {
    return 'Religious'
  }
  if (filterKey === 'palace_castle' || /palace|castle|fort|citadel|hotel|biltmore|mansion|manor/i.test(text)) {
    return 'Castle & Palace'
  }
  if (/dam|reservoir|aqueduct|canal/i.test(text)) return 'Dam & Submerged'
  if (/tunnel|cistern|underground|bunker|catacomb|mine/i.test(text)) return 'Underground'
  if (/monument|memorial|mound|obelisk|pyramid|ruin/i.test(text)) return 'Monument & Archaeology'
  return 'Other'
}

/**
 * Live regional scan via Nominatim (for city -> lat/lon) + Wikidata SPARQL +
 * Wikipedia GeoSearch fallback. Lets the user type ANY city ("Tampa",
 * "Clearwater", "St. Petersburg", "Chicago", "Prague") or scan the current
 * map bounding box for historic / Old World architecture.
 */
async function scanRegionForHistoricStructures(opts: {
  city?: string | null
  lat?: number | null
  lon?: number | null
  radiusKm?: number
  filter?: string
}): Promise<{ center: { lat: number; lon: number; label: string } | null; places: ScannedPlace[] }> {
  let lat = opts.lat ?? null
  let lon = opts.lon ?? null
  let label = opts.city?.trim() || ''
  const radiusKm = Math.min(Math.max(opts.radiusKm || 25, 2), 150)
  const filterKey = opts.filter && opts.filter in SCAN_FILTER_QIDS ? opts.filter : 'all'

  // 1. Geocode city name if lat/lon not provided
  if ((lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) && label) {
    try {
      const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(label)}`
      const geoRes = await fetch(geoUrl, {
        headers: { 'User-Agent': 'AngelOS-OldWorldAtlas/1.0 (https://www.spacesangels.com)' },
      })
      if (geoRes.ok) {
        const geoData = (await geoRes.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>
        if (geoData[0]?.lat && geoData[0]?.lon) {
          lat = parseFloat(geoData[0].lat)
          lon = parseFloat(geoData[0].lon)
          label = geoData[0].display_name || label
        }
      }
    } catch {
      // Fall through
    }
  }

  if (lat == null || lon == null || Number.isNaN(lat) || Number.isNaN(lon)) {
    return { center: null, places: [] }
  }

  const results: ScannedPlace[] = []
  const seenIds = new Set<string>()

  // 2. Query Wikidata SPARQL around (lat, lon) within radiusKm
  try {
    const sparql = `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?coord ?image ?inception ?article WHERE {
  SERVICE wikibase:around {
    ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radiusKm}" .
  }
  {
    ?item wdt:P1435 ?heritage .
  } UNION {
    ?item wdt:P31/wdt:P279* wd:Q41176 .
    ?item wdt:P571 ?inception .
    FILTER(YEAR(?inception) <= 1940)
  }
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL {
    ?article schema:about ?item ;
             schema:isPartOf <https://en.wikipedia.org/> .
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 120
`.trim()

    const wdUrl = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`
    const wdRes = await fetch(wdUrl, {
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': 'AngelOS-OldWorldAtlas/1.0 (https://www.spacesangels.com)',
      },
    })

    if (wdRes.ok) {
      const wdJson = (await wdRes.json()) as {
        results?: {
          bindings?: Array<Record<string, { value?: string }>>
        }
      }

      for (const b of wdJson.results?.bindings || []) {
        const uri = b.item?.value || ''
        const qid = uri.split('/').pop() || ''
        const itemLabel = b.itemLabel?.value || ''
        if (!qid || !itemLabel || /^Q\d+$/.test(itemLabel) || seenIds.has(qid)) continue

        const coordStr = b.coord?.value || ''
        const m = coordStr.match(/Point\(([-\d.]+)\s+([-\d.]+)\)/i)
        if (!m) continue
        const pLon = m[1]
        const pLat = m[2]

        const desc = b.itemDescription?.value || 'Historic registered structure'
        const cat = classifyScanCategory(itemLabel, desc, filterKey)

        // Apply specific filter if user asked for Carnegie, Post Office, etc.
        if (filterKey === 'carnegie' && !/carnegie|library/i.test(`${itemLabel} ${desc}`)) continue
        if (filterKey === 'post_office' && !/post office|custom house|postal|federal building/i.test(`${itemLabel} ${desc}`)) continue

        const inceptionRaw = b.inception?.value || ''
        const yearMatch = inceptionRaw.match(/^(\d{4})/)
        const year = yearMatch ? yearMatch[1] : null

        seenIds.add(qid)
        results.push({
          id: `wd-${qid}`,
          name: itemLabel,
          city: label.split(',')[0]?.trim() || null,
          state: null,
          country: null,
          latitude: pLat,
          longitude: pLon,
          category: cat,
          existence: /demolished|former|ruin|destroyed/i.test(desc) ? 'demolished' : 'standing',
          construction: year,
          photo: b.image?.value ? b.image.value.replace(/^http:/, 'https:') : null,
          sourceUrl: b.article?.value || `https://www.wikidata.org/wiki/${qid}`,
          description: `${desc}${year ? ` — Recorded construction/inception: ${year}.` : ''}`,
          status: 'verified',
          isLiveScan: true,
        })
      }
    }
  } catch {
    // Fall back to Wikipedia GeoSearch if Wikidata times out
  }

  // 3. Supplement with Wikipedia GeoSearch if fewer than 15 results
  if (results.length < 15) {
    try {
      const gsRadius = Math.min(radiusKm * 1000, 10000)
      const wpUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=${gsRadius}&gslimit=50&format=json&origin=*`
      const wpRes = await fetch(wpUrl, {
        headers: { 'User-Agent': 'AngelOS-OldWorldAtlas/1.0 (https://www.spacesangels.com)' },
      })
      if (wpRes.ok) {
        const wpJson = (await wpRes.json()) as {
          query?: {
            geosearch?: Array<{ pageid: number; title: string; lat: number; lon: number }>
          }
        }
        for (const g of wpJson.query?.geosearch || []) {
          const id = `wp-${g.pageid}`
          if (seenIds.has(id)) continue
          seenIds.add(id)
          results.push({
            id,
            name: g.title,
            city: label.split(',')[0]?.trim() || null,
            state: null,
            country: null,
            latitude: String(g.lat),
            longitude: String(g.lon),
            category: classifyScanCategory(g.title, '', filterKey),
            existence: 'standing',
            construction: null,
            photo: null,
            sourceUrl: `https://en.wikipedia.org/?curid=${g.pageid}`,
            description: `Geolocated historical landmark near ${label || `${lat.toFixed(3)}, ${lon.toFixed(3)}`}.`,
            status: 'verified',
            isLiveScan: true,
          })
        }
      }
    } catch {
      // Ignore
    }
  }

  return {
    center: { lat, lon, label: label || `${lat.toFixed(4)}, ${lon.toFixed(4)}` },
    places: results,
  }
}

const GLOBAL_LAYER_SPARQL: Record<string, { category: string; sparql: string }> = {
  train_stations: {
    category: 'Castle & Palace',
    sparql: `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?coord ?image ?inception ?article WHERE {
  ?item wdt:P31 wd:Q55488 ;
        wdt:P625 ?coord ;
        wdt:P1435 ?heritage ;
        wdt:P18 ?image ;
        wdt:P571 ?inception .
  FILTER(YEAR(?inception) <= 1935)
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 250`,
  },
  cathedrals: {
    category: 'Religious',
    sparql: `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?coord ?image ?inception ?article WHERE {
  ?item wdt:P31 wd:Q2977 ;
        wdt:P625 ?coord ;
        wdt:P18 ?image .
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 300`,
  },
  carnegie: {
    category: 'Museum & Library',
    sparql: `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?coord ?image ?inception ?article WHERE {
  ?item wdt:P31 wd:Q51576574 ;
        wdt:P625 ?coord .
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 300`,
  },
  star_forts: {
    category: 'Castle & Palace',
    sparql: `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?coord ?image ?inception ?article WHERE {
  VALUES ?type { wd:Q695850 wd:Q88291 }
  ?item wdt:P31 ?type ;
        wdt:P625 ?coord .
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 250`,
  },
  asylums: {
    category: 'Government',
    sparql: `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?coord ?image ?inception ?article WHERE {
  VALUES ?type { wd:Q6415596 wd:Q2109993 }
  ?item wdt:P31 ?type ;
        wdt:P625 ?coord .
  OPTIONAL { ?item wdt:P18 ?image . }
  OPTIONAL { ?item wdt:P571 ?inception . }
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 200`,
  },
  nrhp_landmarks: {
    category: 'Government',
    sparql: `
SELECT DISTINCT ?item ?itemLabel ?itemDescription ?coord ?image ?inception ?article WHERE {
  ?item wdt:P1435 wd:Q15243209 ;
        wdt:P31/wdt:P279* wd:Q41176 ;
        wdt:P625 ?coord ;
        wdt:P18 ?image ;
        wdt:P571 ?inception .
  FILTER(YEAR(?inception) <= 1935)
  OPTIONAL { ?article schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 300`,
  },
}

const globalLayerCache = new Map<string, ScannedPlace[]>()

async function fetchGlobalLayer(layerKey: string): Promise<ScannedPlace[]> {
  if (globalLayerCache.has(layerKey)) {
    return globalLayerCache.get(layerKey)!
  }
  const spec = GLOBAL_LAYER_SPARQL[layerKey]
  if (!spec) return []

  const places: ScannedPlace[] = []
  const seen = new Set<string>()
  try {
    const wdUrl = `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(spec.sparql.trim())}`
    const res = await fetch(wdUrl, {
      headers: {
        Accept: 'application/sparql-results+json',
        'User-Agent': 'AngelOS-OldWorldAtlas/1.0 (https://www.spacesangels.com)',
      },
    })
    if (res.ok) {
      const json = (await res.json()) as {
        results?: { bindings?: Array<Record<string, { value?: string }>> }
      }
      for (const b of json.results?.bindings || []) {
        const uri = b.item?.value || ''
        const qid = uri.split('/').pop() || ''
        const label = b.itemLabel?.value || ''
        if (!qid || !label || /^Q\d+$/.test(label) || seen.has(qid)) continue
        const m = (b.coord?.value || '').match(/Point\(([-\d.]+)\s+([-\d.]+)\)/i)
        if (!m) continue
        seen.add(qid)
        const yearMatch = (b.inception?.value || '').match(/^(\d{4})/)
        const year = yearMatch ? yearMatch[1] : null
        const desc = b.itemDescription?.value || `Global ${layerKey.replace('_', ' ')} landmark`
        places.push({
          id: `layer-${layerKey}-${qid}`,
          name: label,
          city: null,
          state: null,
          country: null,
          longitude: m[1],
          latitude: m[2],
          category: spec.category,
          existence: /demolished|former|ruin|destroyed/i.test(desc) ? 'demolished' : 'standing',
          construction: year,
          photo: b.image?.value ? b.image.value.replace(/^http:/, 'https:') : null,
          sourceUrl: b.article?.value || `https://www.wikidata.org/wiki/${qid}`,
          description: `${desc}${year ? ` — Recorded construction: ${year}.` : ''}`,
          status: 'verified',
          isLiveScan: true,
        })
      }
      if (places.length > 0) {
        globalLayerCache.set(layerKey, places)
      }
    }
  } catch {
    // Return empty on error
  }
  return places
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const globalLayer = url.searchParams.get('globalLayer')
  if (globalLayer) {
    const places = await fetchGlobalLayer(globalLayer)
    return NextResponse.json({ layer: globalLayer, count: places.length, places })
  }

  const scanCity = url.searchParams.get('scanCity')
  const latParam = url.searchParams.get('lat')
  const lonParam = url.searchParams.get('lon')
  const radiusParam = url.searchParams.get('radiusKm')
  const filterParam = url.searchParams.get('filter') || 'all'

  if (scanCity || (latParam && lonParam)) {
    const scanResult = await scanRegionForHistoricStructures({
      city: scanCity,
      lat: latParam ? parseFloat(latParam) : null,
      lon: lonParam ? parseFloat(lonParam) : null,
      radiusKm: radiusParam ? parseFloat(radiusParam) : 25,
      filter: filterParam,
    })
    return NextResponse.json(scanResult)
  }

  return NextResponse.json(mlbArchive)
}
