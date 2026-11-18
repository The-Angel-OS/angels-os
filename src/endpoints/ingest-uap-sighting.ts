/**
 * Ingest UAP Sighting & Whistleblower Transcripts — POST /api/provision-ops/ingest-uap-sighting
 *
 * Extracts structured geo-telemetry from YouTube transcripts, whistleblower testimony,
 * or declassified FOIA documents using Google Gemini Flash.
 *
 * Grounding & Rules:
 *   - Extracts real-world WGS-84 coordinates (latitude, longitude, base, city, country)
 *   - Classifies encounter (CRASH_RETRIEVAL, NUCLEAR_INCURSION, RADAR_FLIR, etc.)
 *   - Links DIRECTLY back to original media / video timestamp (never re-hosts media)
 *   - Idempotently adds to UAP archive dataset and creates a published Post under the UAP tenant.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>.
 */
import type { PayloadHandler } from 'payload'
import fs from 'fs'
import path from 'path'

interface ExtractedIncident {
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
}

export const ingestUapSightingHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')
  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(user && ((user as { roles?: string[] }).roles || []).includes('super_admin'))
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  // GET: Return current count and list of indexed incidents
  if (req.method === 'GET') {
    const archivePath = path.resolve(process.cwd(), 'src/data/uap-archive.json')
    if (fs.existsSync(archivePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(archivePath, 'utf8'))
        return Response.json({ count: raw.incidents?.length || 0, incidents: raw.incidents || [] })
      } catch (e) {
        return Response.json({ error: 'Failed to read uap-archive.json' }, { status: 500 })
      }
    }
    return Response.json({ count: 0, incidents: [] })
  }

  // POST: Process transcript or incident payload
  let body: Record<string, unknown> = {}
  try {
    body = (await req.json?.()) || {}
  } catch {
    body = {}
  }

  const inputUrl = String(body.url || '').trim()
  const rawText = String(body.text || body.transcript || '').trim()
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY

  if (!rawText && !inputUrl) {
    return Response.json({ error: 'Provide text, transcript, or url' }, { status: 400 })
  }

  let incident: ExtractedIncident | null = null

  if (apiKey) {
    try {
      const prompt = `You are a military intelligence analyst cataloging declassified UAP sightings, crash retrievals, and whistleblower testimony for an interactive 3D reconnaissance atlas.
Given this text/source, extract a single structured JSON incident adhering strictly to this schema:
{
  "id": "uap-YYYY-slug",
  "slug": "kebab-case-slug",
  "title": "Incident Title",
  "category": "CRASH_RETRIEVAL" | "NUCLEAR_INCURSION" | "RADAR_FLIR" | "PILOT_LOCK" | "MASS_SIGHTING" | "PHYSICAL_TRACE" | "UNDERGROUND_FACILITY",
  "date": "YYYY-MM-DD",
  "year": YYYY,
  "location": {
    "name": "Specific site or installation name",
    "city": "City or nearest municipality",
    "state": "State/Province",
    "country": "Country",
    "latitude": 0.0000,
    "longitude": 0.0000
  },
  "witnesses": ["Witness names or callsigns"],
  "militaryUnits": ["Military branches, squadrons, or agencies involved"],
  "classification": "TOP SECRET / MAJIC" | "SECRET / NOFORN" | "DECLASSIFIED (DOD)" | "CONFIDENTIAL",
  "officialNarrative": "Official explanation or debunking issued by authorities",
  "investigativeHypothesis": "Synthesized factual telemetry and whistleblower claims",
  "anomalies": ["Key physical traces, radar returns, instantaneous acceleration, etc."],
  "sources": [{"title": "Source Description", "url": "${inputUrl || 'https://uap.spacesangels.com'}"}]
}

Input Text/Source:
${rawText || inputUrl}

Output pure JSON only, no markdown fencing.`

      const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
      const aiRes = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
          },
        }),
      })

      if (aiRes.ok) {
        const aiJson = (await aiRes.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        }
        const textOut = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
        if (textOut) {
          incident = JSON.parse(textOut)
        }
      }
    } catch (aiErr) {
      console.error('[Ingest UAP] Gemini parsing error:', aiErr)
    }
  }

  // If Gemini parsing didn't run or wasn't configured, check if direct incident object was passed
  if (!incident && body.incident && typeof body.incident === 'object') {
    incident = body.incident as unknown as ExtractedIncident
  }

  if (!incident) {
    return Response.json({ error: 'Failed to extract incident schema from input' }, { status: 422 })
  }

  // Append to local uap-archive.json
  const archivePath = path.resolve(process.cwd(), 'src/data/uap-archive.json')
  let existingIncidents: ExtractedIncident[] = []
  try {
    if (fs.existsSync(archivePath)) {
      const current = JSON.parse(fs.readFileSync(archivePath, 'utf8'))
      existingIncidents = current.incidents || []
    }
  } catch {}

  const exists = existingIncidents.findIndex((i) => i.id === incident!.id || i.slug === incident!.slug)
  if (exists >= 0) {
    existingIncidents[exists] = incident
  } else {
    existingIncidents.push(incident)
  }

  try {
    fs.writeFileSync(
      archivePath,
      JSON.stringify(
        {
          version: '2.0.0',
          lastUpdated: new Date().toISOString(),
          incidents: existingIncidents,
        },
        null,
        2,
      ),
      'utf8',
    )
  } catch (writeErr) {
    console.warn('[Ingest UAP] Could not write to disk (read-only filesystem on prod):', writeErr)
  }

  // Create or update Post under the UAP tenant in Payload
  try {
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'uap' } },
      limit: 1,
    })
    const uapTenantId = tenants.docs[0]?.id

    if (uapTenantId) {
      const existingPost = await payload.find({
        collection: 'posts',
        where: {
          and: [{ tenant: { equals: uapTenantId } }, { slug: { equals: incident.slug } }],
        },
        limit: 1,
      })

      const postData = {
        title: incident.title,
        slug: incident.slug,
        tenant: uapTenantId,
        _status: 'published' as const,
        publishedOn: new Date().toISOString(),
        content: {
          root: {
            type: 'root',
            format: '' as const,
            indent: 0,
            version: 1,
            direction: 'ltr' as const,
            children: [
              {
                type: 'paragraph',
                format: '' as const,
                indent: 0,
                version: 1,
                direction: 'ltr' as const,
                children: [
                  {
                    type: 'text',
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: `[${incident.classification}] Location: ${incident.location.name} (${incident.location.latitude}, ${incident.location.longitude}) · Date: ${incident.date}`,
                    version: 1,
                  },
                ],
              },
              {
                type: 'paragraph',
                format: '' as const,
                indent: 0,
                version: 1,
                direction: 'ltr' as const,
                children: [
                  {
                    type: 'text',
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: incident.investigativeHypothesis,
                    version: 1,
                  },
                ],
              },
              {
                type: 'paragraph',
                format: '' as const,
                indent: 0,
                version: 1,
                direction: 'ltr' as const,
                children: [
                  {
                    type: 'text',
                    detail: 0,
                    format: 0,
                    mode: 'normal',
                    style: '',
                    text: `Primary Source Link: ${incident.sources[0]?.url || inputUrl}`,
                    version: 1,
                  },
                ],
              },
            ],
          },
        },
      }

      if (existingPost.docs.length > 0) {
        await payload.update({
          collection: 'posts',
          id: existingPost.docs[0].id,
          data: postData,
        })
      } else {
        await payload.create({
          collection: 'posts',
          data: postData,
        })
      }
    }
  } catch (postErr) {
    console.error('[Ingest UAP] Failed to sync post in Payload:', postErr)
  }

  return Response.json({
    success: true,
    incident,
    totalIncidents: existingIncidents.length,
  })
}
