/**
 * NDERF.org Edge-Case Scanner — GET/POST /api/provision-ops/scan-nderf
 *
 * Politely scans public NDERF archive index pages (default: exceptional.html),
 * filters for NDE accounts containing high-signal keywords:
 *   - Past lives / previous lives / reincarnation
 *   - Non-physical / holographic / illusion / simulation reality
 *   - Hall of Records / Akashic library / civilizational history / 1700-1850 / cataclysm
 *
 * For matching accounts, uses Cloud Gemini Flash to extract discrete structured
 * records with verbatim quotes, blindness rating (Pre-2018 vs Post-2018),
 * WGS-84 coordinates, and direct outbound links back to nderf.org (zero re-hosting).
 *
 * Query params:
 *   - `?key=<CRON_SECRET>` (or super_admin session)
 *   - `offset` (default 0)
 *   - `limit` (default 15, max 35 per batch)
 *   - `archive` (default 'exceptional.html')
 */
import type { PayloadHandler } from 'payload'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
} from '@/utilities/lexicalHelpers'

const SIGNAL_PATTERNS: Array<{ tag: string; regex: RegExp }> = [
  { tag: 'past_life', regex: /\b(past\s+liv|past\s+life|previous\s+liv|previous\s+life|reincarnat)/i },
  { tag: 'nonphysical_reality', regex: /\b(non-?physical|hologram|holographic|illusion|simulation|virtual\s+reality|stage\s+play)\b/i },
  { tag: 'hall_of_records', regex: /\b(hall\s+of\s+records|akashic|library\s+of|universal\s+knowledge|book\s+of\s+life)\b/i },
  { tag: 'history_civilization', regex: /\b(civilization|atlantis|lemuria|cataclysm|1700s?|1800s?|18th\s+century|19th\s+century|ancient\s+city)\b/i },
]

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

interface ExtractedNderfCase {
  title: string
  slug: string
  category: string
  eraWindow: string
  recordedYear: number
  blindnessRating: 'PRE_2018_BLIND' | 'POST_2018_UNPROMPTED'
  historicalDeviationScore: number
  nonPhysicalRealityScore: number
  location: {
    name: string
    city: string
    state: string
    country: string
    latitude: number
    longitude: number
  }
  summary: string
  verbatimQuotes: string[]
  anomalyMarkers: string[]
}

export const scanNderfHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(
    user && ((user as { roles?: string[] }).roles || []).includes('super_admin'),
  )
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0))
  const limit = Math.max(1, Math.min(35, Number(url.searchParams.get('limit') || 15)))
  const archivePage = (url.searchParams.get('archive') || 'exceptional.html').replace(/[^a-zA-Z0-9_.-]/g, '')
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY

  try {
    const indexUrl = `https://www.nderf.org/Archives/${archivePage}`
    const indexRes = await fetch(indexUrl, {
      headers: { 'User-Agent': 'AngelOS-Consciousness-Archive/1.0 (+https://nde.spacesangels.com)' },
    })
    if (!indexRes.ok) {
      return Response.json({ error: `Failed to fetch NDERF index (${indexRes.status})` }, { status: 502 })
    }
    const indexHtml = await indexRes.text()
    const rawLinks = indexHtml.match(/Experiences\/[a-zA-Z0-9_.-]+\.html/gi) || []
    const uniqueLinks = [...new Set(rawLinks)]
    const batch = uniqueLinks.slice(offset, offset + limit)

    // Look up `nde` tenant ID for Post publishing
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'nde' } },
      limit: 1,
      overrideAccess: true,
    })
    const ndeTenantId = tenants.docs[0]?.id

    const scanned: Array<{
      url: string
      matchedTags: string[]
      ingested: boolean
      title?: string
      postId?: string | number
      nonPhysicalRealityScore?: number
      historicalDeviationScore?: number
    }> = []

    for (const relPath of batch) {
      const fullUrl = `https://www.nderf.org/${relPath}`
      await sleep(250) // Polite pacing

      try {
        const pageRes = await fetch(fullUrl, {
          headers: { 'User-Agent': 'AngelOS-Consciousness-Archive/1.0 (+https://nde.spacesangels.com)' },
        })
        if (!pageRes.ok) continue
        const html = await pageRes.text()
        const text = stripHtml(html)

        const matchedTags = SIGNAL_PATTERNS.filter((p) => p.regex.test(text)).map((p) => p.tag)
        if (matchedTags.length === 0) {
          scanned.push({ url: fullUrl, matchedTags: [], ingested: false })
          continue
        }

        // Only run Gemini extraction when we have at least 1 high-signal hit
        let extracted: ExtractedNderfCase | null = null
        if (apiKey) {
          const prompt = `You are a consciousness & historical-anomaly researcher analyzing a public Near-Death Experience (NDE) account from NDERF.org.
Matched signal categories: ${matchedTags.join(', ')}.

Extract a discrete structured JSON record strictly matching this schema:
{
  "title": "Experiencer Name — Concise Theme Title (Year if stated)",
  "slug": "nderf-kebab-case-slug",
  "category": "NDE PAST-LIFE FLASH" | "NDE HALL OF RECORDS" | "LOST ARCHITECTURE / ENERGY" | "CATACLYSM / RESET MEMORY" | "1700-1850 BASELINE" | "PRE-2018 BLIND OUTLIER",
  "eraWindow": "1700-1850" | "ATLANTIS_UNPLACED" | "1850-1950" | "NON_LOCAL",
  "recordedYear": 2015,
  "blindnessRating": "PRE_2018_BLIND" | "POST_2018_UNPROMPTED",
  "historicalDeviationScore": 1,
  "nonPhysicalRealityScore": 1,
  "location": {
    "name": "City/Region mentioned in NDE or 'NDERF Global Archive'",
    "city": "City or Houma",
    "state": "State or Louisiana",
    "country": "Country or United States",
    "latitude": 29.5958,
    "longitude": -90.7195
  },
  "summary": "2-3 sentence factual summary focusing on past-life flashes, non-physical/holographic reality descriptions, or historical/civilizational insights.",
  "verbatimQuotes": ["1 to 3 short verbatim quotes from the account illustrating the anomaly or non-physical reality insight"],
  "anomalyMarkers": ["2 to 4 concise bullet points of key findings"]
}

Scoring:
- nonPhysicalRealityScore (1-10): How strongly the account describes physical reality as a non-physical, holographic, dreamlike, or thought-generated construct.
- historicalDeviationScore (1-10): How strongly the account mentions past lives in advanced/lost civilizations, 1700-1850 anomalies, or hidden human history.
- blindnessRating: Use PRE_2018_BLIND if the NDE date or posting date is before 2018, else POST_2018_UNPROMPTED.

Source URL: ${fullUrl}
Account Text:
${text.slice(0, 18000)}

Output pure JSON only.`

          const aiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json' },
              }),
            },
          )
          if (aiRes.ok) {
            const aiJson = (await aiRes.json()) as {
              candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
            }
            const out = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
            if (out) extracted = JSON.parse(out) as ExtractedNderfCase
          }
        }

        let postId: string | number | undefined
        if (extracted && ndeTenantId) {
          const contentNodes = [
            createHeadingNode(extracted.title, 'h2'),
            createParagraphNode(
              `Category: ${extracted.category} · Era: ${extracted.eraWindow} · Recorded: ${extracted.recordedYear} · Blindness: ${extracted.blindnessRating} · Non-Physical Reality Score: ${extracted.nonPhysicalRealityScore}/10 · Historical Deviation: ${extracted.historicalDeviationScore}/10`,
            ),
            createParagraphNode(
              `Source: NDERF.org (${fullUrl}) · Signals: ${matchedTags.join(', ')} · Location Anchor: ${extracted.location.name} [${extracted.location.latitude}, ${extracted.location.longitude}]`,
            ),
            createHeadingNode('Research Summary', 'h3'),
            createParagraphNode(extracted.summary),
            ...(extracted.verbatimQuotes?.length
              ? [
                  createHeadingNode('Verbatim Excerpts', 'h3'),
                  createParagraphNode(extracted.verbatimQuotes.map((q) => `“${q}”`).join('\n\n')),
                ]
              : []),
            createHeadingNode('Key Signal Markers', 'h3'),
            createParagraphNode((extracted.anomalyMarkers || []).map((m) => `• ${m}`).join('\n')),
          ]

          const postData = {
            title: extracted.title,
            slug: extracted.slug,
            tenant: ndeTenantId,
            _status: 'published',
            sourceUrl: fullUrl,
            sourceType: 'manual',
            layout: [
              {
                blockType: 'content',
                columns: [{ size: 'full', richText: createLexicalContent(contentNodes) }],
              },
            ],
            meta: {
              title: `${extracted.title} — NDERF Edge-Case Archive`,
              description: extracted.summary.slice(0, 155),
            },
          }

          const existing = await payload.find({
            collection: 'posts',
            where: { and: [{ tenant: { equals: ndeTenantId } }, { slug: { equals: extracted.slug } }] },
            limit: 1,
            overrideAccess: true,
          })

          if (existing.docs.length > 0) {
            const upd = await payload.update({
              collection: 'posts',
              id: existing.docs[0].id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data: postData as any,
              overrideAccess: true,
            })
            postId = upd.id
          } else {
            const crt = await payload.create({
              collection: 'posts',
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data: postData as any,
              overrideAccess: true,
            })
            postId = crt.id
          }
        }

        scanned.push({
          url: fullUrl,
          matchedTags,
          ingested: Boolean(extracted && postId),
          title: extracted?.title,
          postId,
          nonPhysicalRealityScore: extracted?.nonPhysicalRealityScore,
          historicalDeviationScore: extracted?.historicalDeviationScore,
        })
      } catch {
        scanned.push({ url: fullUrl, matchedTags: ['fetch_error'], ingested: false })
      }
    }

    return Response.json({
      success: true,
      archive: archivePage,
      totalAvailableInArchive: uniqueLinks.length,
      offset,
      limit,
      nextOffset: offset + limit < uniqueLinks.length ? offset + limit : null,
      matchesFound: scanned.filter((s) => s.matchedTags.length > 0 && s.matchedTags[0] !== 'fetch_error').length,
      ingestedCount: scanned.filter((s) => s.ingested).length,
      results: scanned,
    })
  } catch (err) {
    console.error('[scan-nderf] Error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
