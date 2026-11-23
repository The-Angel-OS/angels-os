/**
 * Generalized Geo-Coded Investigation & Anomaly Archive Search
 *
 * Powers RAG for LEO/Nimue across investigative endeavors:
 * - My Lunch Break (MLB) episode & architectural anomaly archive
 * - Future Jon Levi investigative archives
 * - Future UFO/UAP sighting and anomalous hot-spot databases
 * - Curated Old World landmarks: Star Forts, Carnegie Libraries, Monumental Train Stations
 */

import type { Payload } from 'payload'
import mlbArchive from '@/data/mlb-archive.json'
import curatedLayersData from '@/data/curated-atlas-layers.json'
import uapArchiveData from '@/data/uap-archive.json'
import ndeArchiveData from '@/data/nde-archive.json'
import { searchTranscriptChunks } from '@/utilities/transcriptRag'

export interface GeoArchiveSearchInput {
  query?: string
  category?: 'episodes' | 'places' | 'star_forts' | 'train_stations' | 'carnegie' | 'uap' | 'nde' | 'all'
  tenantSlug?: string
  limit?: number
}

interface EpisodeItem {
  id: string
  slug?: string
  number?: number
  title: string
  description?: string
  publishedAt?: string
  youtubeVideoId?: string
  keyClaims?: string[]
  places?: Array<{ id: string; name: string }>
}

interface PlaceItem {
  id: string
  name: string
  city?: string | null
  state?: string | null
  country?: string | null
  latitude: string
  longitude: string
  category: string
  existence?: string
  construction?: string | null
  photo?: string | null
  sourceUrl?: string | null
  description: string
}

export async function searchGeoArchive(
  payload: Payload,
  input: GeoArchiveSearchInput,
  tenantId?: number,
): Promise<string> {
  const query = (input.query || '').trim().toLowerCase()
  if (!query) {
    return JSON.stringify({ error: 'Search query is required' })
  }

  const limit = Math.max(1, Math.min(10, Number(input.limit) || 5))
  const category = input.category || 'all'
  const terms = query.split(/\s+/).filter(Boolean)

  const results: Array<{
    type:
      | 'episode'
      | 'transcript_chunk'
      | 'landmark'
      | 'star_fort'
      | 'train_station'
      | 'carnegie_library'
      | 'uap_incident'
      | 'nde_regression'
    score: number
    title: string
    episodeNumber?: number
    url?: string
    videoUrl?: string
    location?: {
      city?: string | null
      state?: string | null
      country?: string | null
      latitude?: string
      longitude?: string
    }
    constructionYear?: string | null
    summary: string
    keyClaims?: string[]
  }> = []

  // ── 0. Search Live Postgres Transcript Chunks ─────────────────────────────
  if (category === 'all' || category === 'episodes') {
    try {
      const liveChunks = await searchTranscriptChunks(payload, {
        query,
        tenantId,
        limit,
      })
      for (const chunk of liveChunks) {
        results.push({
          type: 'transcript_chunk',
          score: Math.min(250, 120 + Math.round(chunk.rank * 100)),
          title: chunk.postTitle || `Post #${chunk.postId}`,
          url: chunk.postSlug ? `/posts/${chunk.postSlug}` : undefined,
          videoUrl: chunk.timestampUrl || undefined,
          summary: chunk.snippet || '',
          keyClaims: chunk.startSec !== null ? [`Timestamp: ${chunk.startSec}s - ${chunk.endSec || chunk.startSec}s`] : undefined,
        })
      }
    } catch (chunkErr) {
      console.warn('[searchGeoArchive] Live transcript chunk search failed non-fatally:', chunkErr)
    }
  }

  // ── 1. Search Episodes ─────────────────────────────────────────────────────
  if (category === 'all' || category === 'episodes') {
    const episodes = (mlbArchive.episodes || []) as EpisodeItem[]
    for (const ep of episodes) {
      const titleLower = (ep.title || '').toLowerCase()
      const descLower = (ep.description || '').toLowerCase()
      const claimsLower = (ep.keyClaims || []).join(' ').toLowerCase()
      const placesLower = (ep.places || []).map((p) => p.name).join(' ').toLowerCase()
      const fullText = `${titleLower} ${descLower} ${claimsLower} ${placesLower}`

      let score = 0
      if (titleLower.includes(query)) score += 100
      if (descLower.includes(query)) score += 40
      if (claimsLower.includes(query)) score += 50
      if (placesLower.includes(query)) score += 60

      for (const t of terms) {
        if (titleLower.includes(t)) score += 20
        if (claimsLower.includes(t)) score += 15
        if (descLower.includes(t)) score += 5
      }

      // Check episode number direct match e.g. "episode 1", "ep 1", "ep 202"
      const epNumMatch = query.match(/(?:episode|ep|lb)\s*#?\s*(\d+)/i)
      if (epNumMatch && ep.number === parseInt(epNumMatch[1], 10)) {
        score += 150
      }

      if (score > 0) {
        const epSlug = ep.slug || `ep-${ep.number || ep.id.replace('ep:', '')}`
        results.push({
          type: 'episode',
          score,
          title: ep.title,
          episodeNumber: ep.number,
          url: `https://mlb.spacesangels.com/posts/${epSlug}`,
          videoUrl: ep.youtubeVideoId ? `https://www.youtube.com/watch?v=${ep.youtubeVideoId}` : undefined,
          summary: ep.description || ep.title,
          keyClaims: ep.keyClaims?.slice(0, 3),
        })
      }
    }
  }

  // ── 2. Search Landmarks & Anomalous Architecture ───────────────────────────
  if (category === 'all' || category === 'places') {
    const places = (mlbArchive.places || []) as PlaceItem[]
    for (const p of places) {
      const nameLower = (p.name || '').toLowerCase()
      const descLower = (p.description || '').toLowerCase()
      const cityLower = `${p.city || ''} ${p.state || ''} ${p.country || ''}`.toLowerCase()
      const fullText = `${nameLower} ${descLower} ${cityLower}`

      let score = 0
      if (nameLower.includes(query)) score += 90
      if (cityLower.includes(query)) score += 40
      if (descLower.includes(query)) score += 25

      for (const t of terms) {
        if (nameLower.includes(t)) score += 15
        if (cityLower.includes(t)) score += 10
      }

      if (score > 0) {
        results.push({
          type: 'landmark',
          score,
          title: p.name,
          location: {
            city: p.city,
            state: p.state,
            country: p.country,
            latitude: p.latitude,
            longitude: p.longitude,
          },
          constructionYear: p.construction,
          summary: p.description,
          url: p.sourceUrl || undefined,
        })
      }
    }
  }

  // ── 3. Search Curated Star Forts, Train Stations & Carnegie Libraries ─────
  const curated = curatedLayersData as Record<string, PlaceItem[]>
  const layerKeys: Array<'star_forts' | 'train_stations' | 'carnegie'> = [
    'star_forts',
    'train_stations',
    'carnegie',
  ]

  for (const lk of layerKeys) {
    if (category !== 'all' && category !== lk) continue
    const items = curated[lk] || []
    for (const item of items) {
      const nameLower = (item.name || '').toLowerCase()
      const descLower = (item.description || '').toLowerCase()
      const locLower = `${item.city || ''} ${item.state || ''} ${item.country || ''}`.toLowerCase()

      let score = 0
      if (nameLower.includes(query)) score += 80
      if (descLower.includes(query)) score += 30
      if (locLower.includes(query)) score += 30

      for (const t of terms) {
        if (nameLower.includes(t)) score += 15
        if (descLower.includes(t)) score += 10
      }

      if (score > 0) {
        results.push({
          type: lk === 'star_forts' ? 'star_fort' : lk === 'train_stations' ? 'train_station' : 'carnegie_library',
          score,
          title: item.name,
          location: {
            city: item.city,
            state: item.state,
            country: item.country,
            latitude: item.latitude,
            longitude: item.longitude,
          },
          constructionYear: item.construction,
          summary: item.description,
          url: item.sourceUrl || undefined,
        })
      }
    }
  }

  // ── 3. Search UAP / Declassified Incidents ─────────────────────────────────
  if (category === 'all' || category === 'uap') {
    const uapIncidents = (uapArchiveData.incidents || []) as Array<{
      id: string
      slug: string
      title: string
      category: string
      date: string
      year: number
      location: {
        name: string
        city: string
        state: string
        country: string
        latitude: number
        longitude: number
      }
      witnesses: string[]
      militaryUnits: string[]
      classification: string
      officialNarrative: string
      investigativeHypothesis: string
      anomalies: string[]
      sources: Array<{ title: string; url: string }>
    }>

    for (const inc of uapIncidents) {
      const titleLower = (inc.title || '').toLowerCase()
      const locNameLower = (inc.location.name || '').toLowerCase()
      const cityLower = (inc.location.city || '').toLowerCase()
      const witnessesLower = inc.witnesses.join(' ').toLowerCase()
      const militaryLower = inc.militaryUnits.join(' ').toLowerCase()
      const anomaliesLower = inc.anomalies.join(' ').toLowerCase()
      const hypothesisLower = (inc.investigativeHypothesis || '').toLowerCase()

      let score = 0
      if (titleLower.includes(query)) score += 100
      if (locNameLower.includes(query)) score += 80
      if (cityLower.includes(query)) score += 70
      if (witnessesLower.includes(query)) score += 90
      if (anomaliesLower.includes(query)) score += 50
      if (hypothesisLower.includes(query)) score += 40

      for (const t of terms) {
        if (titleLower.includes(t)) score += 25
        if (witnessesLower.includes(t)) score += 30
        if (anomaliesLower.includes(t)) score += 20
        if (militaryLower.includes(t)) score += 20
      }

      if (score > 0) {
        results.push({
          type: 'uap_incident',
          score,
          title: `${inc.title} (${inc.year})`,
          location: {
            city: inc.location.city,
            state: inc.location.state,
            country: inc.location.country,
            latitude: String(inc.location.latitude),
            longitude: String(inc.location.longitude),
          },
          constructionYear: String(inc.year),
          summary: `[${inc.classification}] ${inc.investigativeHypothesis}`,
          keyClaims: inc.anomalies,
          url: inc.sources?.[0]?.url,
        })
      }
    }
  }

  // ── 5. Search NDE & Past-Life Regression Anomaly Archive ──────────────────
  if (category === 'all' || category === 'nde') {
    const records = (ndeArchiveData.records || []) as Array<{
      id: string
      title: string
      category: string
      eraWindow: string
      recordedYear: number
      blindnessRating: string
      researcher: string
      location: {
        name: string
        city: string
        state: string
        country: string
        latitude: number
        longitude: number
      }
      summary: string
      anomalyMarkers: string[]
      sources: Array<{ title: string; url: string }>
    }>

    for (const rec of records) {
      const titleLower = rec.title.toLowerCase()
      const researcherLower = rec.researcher.toLowerCase()
      const summaryLower = rec.summary.toLowerCase()
      const markersLower = rec.anomalyMarkers.join(' ').toLowerCase()
      const eraLower = rec.eraWindow.toLowerCase()
      const cityLower = (rec.location.city || '').toLowerCase()

      let score = 0
      if (titleLower.includes(query)) score += 100
      if (researcherLower.includes(query)) score += 90
      if (eraLower.includes(query)) score += 80
      if (cityLower.includes(query)) score += 60
      if (markersLower.includes(query)) score += 50
      if (summaryLower.includes(query)) score += 40

      for (const t of terms) {
        if (titleLower.includes(t)) score += 25
        if (researcherLower.includes(t)) score += 25
        if (markersLower.includes(t)) score += 20
        if (summaryLower.includes(t)) score += 15
      }

      if (score > 0) {
        results.push({
          type: 'nde_regression',
          score,
          title: `${rec.title} [${rec.blindnessRating}]`,
          location: {
            city: rec.location.city,
            state: rec.location.state,
            country: rec.location.country,
            latitude: String(rec.location.latitude),
            longitude: String(rec.location.longitude),
          },
          constructionYear: String(rec.recordedYear),
          summary: `[${rec.category} · ERA: ${rec.eraWindow}] ${rec.summary}`,
          keyClaims: rec.anomalyMarkers,
          url: rec.sources?.[0]?.url,
        })
      }
    }
  }

  // Sort by relevance score descending
  results.sort((a, b) => b.score - a.score)
  const topMatches = results.slice(0, limit)

  if (topMatches.length === 0) {
    return JSON.stringify({
      found: 0,
      query,
      message: `No geo-archive items found matching "${query}".`,
      suggestion: 'Try searching for broad keywords like "veil", "cathedral", "tampa", "chicago", "star fort", or episode numbers.',
    })
  }

  return JSON.stringify(
    {
      found: topMatches.length,
      query,
      matches: topMatches.map((m) => ({
        type: m.type,
        title: m.title,
        episodeNumber: m.episodeNumber,
        url: m.url,
        videoUrl: m.videoUrl,
        location: m.location,
        constructionYear: m.constructionYear,
        summary: m.summary,
        keyClaims: m.keyClaims,
      })),
    },
    null,
    2,
  )
}
