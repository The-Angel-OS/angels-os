/**
 * Ingest NDE & Past-Life Regression Transcripts (Edge-Case Hunter)
 * POST /api/provision-ops/ingest-nde-session
 *
 * Uses Cloud Gemini Flash to analyze a YouTube regression transcript, NDERF account,
 * or book excerpt and extract:
 *   - Blindness rating (PRE_2018_BLIND vs POST_2018_UNPROMPTED vs POST_2018_LED)
 *   - Leading-prompt risk score (1-10: did the hypnotist steer the subject?)
 *   - Historical-deviation score (1-10: mundane baseline vs anomalous architecture/energy/reset)
 *   - Era window (1700-1850, ATLANTIS_UNPLACED, 1850-1950, NON_LOCAL, etc.)
 *   - WGS-84 geographic coordinates for the 3D Globe Atlas
 *   - Direct link back to the original YouTube timestamp / NDERF page (never re-hosts media)
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>.
 */
import type { PayloadHandler } from 'payload'
import {
  createLexicalContent,
  createHeadingNode,
  createParagraphNode,
} from '@/utilities/lexicalHelpers'

interface ExtractedNdeRecord {
  id: string
  slug: string
  title: string
  category: string
  eraWindow: string
  recordedYear: number
  blindnessRating: 'PRE_2018_BLIND' | 'POST_2018_UNPROMPTED' | 'POST_2018_LED'
  leadingPromptScore: number
  historicalDeviationScore: number
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
  verbatimAnomalyQuotes: string[]
  anomalyMarkers: string[]
  sources: Array<{ title: string; url: string }>
}

export const ingestNdeSessionHandler: PayloadHandler = async (req) => {
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

  let body: Record<string, unknown> = {}
  try {
    body = (await req.json?.()) || {}
  } catch {
    body = {}
  }

  const inputUrl = String(body.url || '').trim()
  const rawText = String(body.text || body.transcript || '').trim()
  const recordedYearHint = body.recordedYear ? Number(body.recordedYear) : undefined
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY

  if (!rawText && !inputUrl) {
    return Response.json({ error: 'Provide text, transcript, or url' }, { status: 400 })
  }
  if (!apiKey) {
    return Response.json({ error: 'GOOGLE_AI_API_KEY not configured' }, { status: 500 })
  }

  const prompt = `You are an objective consciousness & historical-anomaly researcher analyzing a hypnotic past-life regression transcript or Near-Death Experience (NDE) account.
We are specifically investigating whether unprompted past-life or NDE accounts corroborate or contradict a proposed pre-1850 / 1700–1850 advanced global civilization (or whether anomalous white-stone/domed/free-energy/cataclysm memories are misclassified as "Atlantis").

Analyze the input and return pure JSON matching this exact schema:
{
  "id": "nde-YYYY-slug",
  "slug": "kebab-case-slug",
  "title": "Concise descriptive case title",
  "category": "1700-1850 BASELINE" | "LOST ARCHITECTURE / ENERGY" | "CATACLYSM / RESET MEMORY" | "NDE HALL OF RECORDS" | "NDE PAST-LIFE FLASH" | "UVA VERIFIED CHILD CASE" | "PRE-2018 BLIND OUTLIER",
  "eraWindow": "1700-1850" | "ATLANTIS_UNPLACED" | "1000-1700" | "1850-1950" | "NON_LOCAL",
  "recordedYear": ${recordedYearHint || 2020},
  "blindnessRating": "PRE_2018_BLIND" | "POST_2018_UNPROMPTED" | "POST_2018_LED",
  "leadingPromptScore": 1,
  "historicalDeviationScore": 1,
  "researcher": "Hypnotist, researcher, or channel name",
  "location": {
    "name": "Place described in session or archive location",
    "city": "City",
    "state": "State/Region",
    "country": "Country",
    "latitude": 0.0,
    "longitude": 0.0
  },
  "summary": "2-4 sentence objective summary of what was recounted, noting mundane vs anomalous details.",
  "verbatimAnomalyQuotes": ["Short verbatim quotes describing architecture, energy, cataclysm, or timeline anomalies if present"],
  "anomalyMarkers": ["Bullet points summarizing key findings, prompt quality, and era clues"],
  "sources": [{"title": "Primary Source", "url": "${inputUrl || 'https://nde.spacesangels.com'}"}]
}

Scoring rules:
- leadingPromptScore: 1 = completely spontaneous/unprompted, 10 = hypnotist explicitly led subject into Tartaria/Atlantis/mud-flood tropes.
- historicalDeviationScore: 1 = totally mundane/textbook historical life, 10 = detailed anomalous pre-industrial architecture, wireless/atmospheric energy, or sudden reset cataclysm.

Input Source URL: ${inputUrl || 'N/A'}
Input Transcript / Account:
${rawText.slice(0, 28000)}

Output pure JSON only.`

  try {
    const apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`
    const aiRes = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    })

    if (!aiRes.ok) {
      return Response.json({ error: `Gemini API returned ${aiRes.status}` }, { status: 502 })
    }

    const aiJson = (await aiRes.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const textOut = aiJson.candidates?.[0]?.content?.parts?.[0]?.text
    if (!textOut) {
      return Response.json({ error: 'Empty Gemini response' }, { status: 422 })
    }

    const record = JSON.parse(textOut) as ExtractedNdeRecord

    // Publish directly as a Post under the `nde` tenant
    const tenants = await payload.find({
      collection: 'tenants',
      where: { slug: { equals: 'nde' } },
      limit: 1,
      overrideAccess: true,
    })
    const ndeTenantId = tenants.docs[0]?.id

    let postId: string | number | null = null
    if (ndeTenantId) {
      const contentNodes = [
        createHeadingNode(record.title, 'h1'),
        createParagraphNode(
          `Category: ${record.category} · Era: ${record.eraWindow} · Recorded: ${record.recordedYear} · Blindness: ${record.blindnessRating} (Leading-Prompt Risk: ${record.leadingPromptScore}/10 · Historical Deviation: ${record.historicalDeviationScore}/10)`,
        ),
        createParagraphNode(
          `Researcher: ${record.researcher} · Location: ${record.location.name} [GPS: ${record.location.latitude}, ${record.location.longitude}]`,
        ),
        createHeadingNode('Analysis Summary', 'h3'),
        createParagraphNode(record.summary),
        ...(record.verbatimAnomalyQuotes?.length
          ? [
              createHeadingNode('Verbatim Anomaly Quotes', 'h3'),
              createParagraphNode(record.verbatimAnomalyQuotes.map((q) => `“${q}”`).join('\n\n')),
            ]
          : []),
        createHeadingNode('Methodological & Anomaly Markers', 'h3'),
        createParagraphNode((record.anomalyMarkers || []).map((m) => `• ${m}`).join('\n')),
      ]

      const postData = {
        title: record.title,
        slug: record.slug,
        tenant: ndeTenantId,
        _status: 'published',
        sourceUrl: inputUrl || record.sources?.[0]?.url || '',
        sourceType: /youtu\.?be/i.test(inputUrl) ? 'youtube' : 'manual',
        layout: [
          {
            blockType: 'content',
            columns: [{ size: 'full', richText: createLexicalContent(contentNodes) }],
          },
        ],
        meta: {
          title: `${record.title} — NDE & Past-Life Anomaly Archive`,
          description: record.summary.slice(0, 155),
        },
      }

      const existing = await payload.find({
        collection: 'posts',
        where: { and: [{ tenant: { equals: ndeTenantId } }, { slug: { equals: record.slug } }] },
        limit: 1,
        overrideAccess: true,
      })

      if (existing.docs.length > 0) {
        const updated = await payload.update({
          collection: 'posts',
          id: existing.docs[0].id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: postData as any,
          overrideAccess: true,
        })
        postId = updated.id
      } else {
        const created = await payload.create({
          collection: 'posts',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: postData as any,
          overrideAccess: true,
        })
        postId = created.id
      }
    }

    return Response.json({
      success: true,
      postId,
      record,
    })
  } catch (err) {
    console.error('[ingest-nde-session] Error:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
