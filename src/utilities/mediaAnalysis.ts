/**
 * Media Analysis Utility — Vision Analysis, OCR, PDF Processing
 *
 * The engine behind progressive metadata extraction. Uses Anthropic Vision
 * to analyze images, extract text, identify objects, and build structured
 * metadata that feeds into the RAG corpus.
 *
 * Architecture:
 *   1. analyzeImage() — Send image to Claude Vision, get structured analysis
 *   2. extractPdfPages() — Split PDF into page images, analyze each
 *   3. buildMediaMeta() — Orchestrator: detect type, route to correct analyzer
 *   4. Results are written to the MediaMeta collection
 *
 * Per-Enterprise service: every tenant builds its own knowledge base.
 * All analysis is observable (Constitutional Article I — Transparency).
 *
 * @see src/collections/MediaMeta/index.ts — storage collection
 * @see src/utilities/leo-data-tools.ts — Leo tools that invoke this
 */

import type { Payload } from 'payload'
import { isDown, markDown, recordSuccess, isFatalProviderError } from './providerHealth'
import { analyzeImageWithGemini, analyzeImagesWithGemini } from './geminiVision'

// ── Types ──────────────────────────────────────────────────────────────────

export interface VisionAnalysis {
  /** Natural language description of what's in the image */
  description: string
  /** Detected objects/subjects */
  objects: string[]
  /** Dominant colors */
  colors: string[]
  /** Scene classification (indoor, outdoor, document, product, etc.) */
  sceneType: string
  /** Any visible text in the image (signs, labels, documents) */
  textContent: string
  /** Overall confidence score 0-1 */
  confidence: number
  /** For inventory: detected items with approximate counts */
  inventoryItems?: Array<{ item: string; quantity?: number; location?: string }>
  /** Raw analysis notes from the model */
  rawNotes?: string
}

export interface ExtractedEntities {
  people: string[]
  places: string[]
  organizations: string[]
  dates: string[]
  amounts: string[]
}

export interface AnalysisResult {
  success: boolean
  vision?: VisionAnalysis
  ocrText?: string
  tags?: string[]
  entities?: ExtractedEntities
  summary?: string
  error?: string
  modelUsed?: string
  durationMs?: number
}

export interface PdfPageResult {
  pageNumber: number
  totalPages: number
  analysis: AnalysisResult
  /** Base64 data URL of the page image (if extracted) */
  pageImageDataUrl?: string
  /** Media ID if the page image was uploaded */
  pageMediaId?: number
}

export interface MediaAnalysisOptions {
  /** The Payload media document (expanded with url, filename, mimeType) */
  mediaDoc: Record<string, unknown>
  /** Tenant ID for scoping */
  tenantId?: number
  /** Source message ID (if triggered from a chat message) */
  sourceMessageId?: number | string
  /** Custom analysis prompt (appended to the default) */
  customPrompt?: string
  /** Whether to perform OCR extraction (default: true for documents) */
  extractOcr?: boolean
  /** Whether to extract entities (default: true) */
  extractEntities?: boolean
  /** Whether to detect inventory items (default: false) */
  inventoryMode?: boolean
}

// ── Constants ──────────────────────────────────────────────────────────────

const VISION_MODEL = 'claude-sonnet-4-6'

/** Image MIME types we can analyze with Vision */
const ANALYZABLE_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]

/** PDF MIME type */
const PDF_MIME = 'application/pdf'

/** Max image size for Vision API (20MB) */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

// ── Core Analysis ──────────────────────────────────────────────────────────

/**
 * Analyze a single image using Anthropic Vision API.
 *
 * Returns structured metadata: description, objects, colors, OCR text,
 * entities, tags, and a summary line.
 */
/**
 * Give the vision model image BYTES (base64) instead of a URL. R2's public r2.dev
 * host is rate-limited ("not for production"), so a model provider fetching it
 * directly fails intermittently — the "trouble fetching from a web link, let me
 * check the media library" fallback. Core fetching once, server-side, is reliable.
 * Data/relative URLs, non-images, empty/huge files, and fetch errors pass through
 * unchanged (the provider-URL path still works as a fallback).
 */
async function toBase64ImageUrl(imageUrl: string): Promise<string> {
  if (typeof imageUrl !== 'string' || !/^https?:\/\//i.test(imageUrl)) return imageUrl
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return imageUrl
    const ct = (res.headers.get('content-type') || '').split(';')[0].trim() || 'image/jpeg'
    if (!ct.startsWith('image/')) return imageUrl
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length === 0 || buf.length > 18 * 1024 * 1024) return imageUrl
    return `data:${ct};base64,${buf.toString('base64')}`
  } catch {
    return imageUrl
  }
}

export async function analyzeImage(
  imageUrl: string,
  options: Partial<MediaAnalysisOptions> = {},
): Promise<AnalysisResult> {
  const startTime = Date.now()
  // Vision reads bytes, not a (rate-limited r2.dev) URL — fetch server-side once.
  imageUrl = await toBase64ImageUrl(imageUrl)

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const geminiKey = process.env.GOOGLE_AI_API_KEY
  if (!anthropicKey && !geminiKey) {
    return {
      success: false,
      error: 'No vision provider configured (ANTHROPIC_API_KEY / GOOGLE_AI_API_KEY).',
    }
  }

  try {
    // Build the analysis prompt (shared across providers)
    const inventorySection = options.inventoryMode
      ? `\n- "inventoryItems": array of { "item": string, "quantity": number|null, "location": string|null } — list every distinct product/item you can see with approximate counts`
      : ''

    const customSection = options.customPrompt
      ? `\n\nAdditional context: ${options.customPrompt}`
      : ''

    const systemPrompt = `You are a media analysis engine. Analyze the provided image and return ONLY a valid JSON object with these fields:

- "description": string — detailed natural language description of the image (2-4 sentences)
- "objects": string[] — list of distinct objects, subjects, or elements visible
- "colors": string[] — dominant colors (max 5)
- "sceneType": string — one of: "document", "product", "indoor", "outdoor", "portrait", "food", "abstract", "screenshot", "diagram", "inventory", "artwork", "other"
- "textContent": string — any visible text (signs, labels, handwriting, printed text). Empty string if none.
- "confidence": number — 0.0 to 1.0, your confidence in the analysis
- "tags": string[] — 5-15 descriptive tags for search/categorization
- "entities": { "people": string[], "places": string[], "organizations": string[], "dates": string[], "amounts": string[] }
- "summary": string — one-line summary (max 100 chars) suitable as a title${inventorySection}

Return ONLY the JSON object, no markdown, no commentary.${customSection}`

    const userText = 'Analyze this image according to the system instructions.'
    let rawText = ''
    let usedModel: string = VISION_MODEL

    // ── Provider 1: Anthropic vision (skipped while circuit-broken) ──────────
    if (anthropicKey && !isDown('anthropic')) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey: anthropicKey })

        const imageContent: any[] = []
        if (imageUrl.startsWith('data:')) {
          const [header, base64Data] = imageUrl.split(',')
          const mediaType = header?.match(/data:([^;]+)/)?.[1] || 'image/png'
          imageContent.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } })
        } else {
          imageContent.push({ type: 'image', source: { type: 'url', url: imageUrl } })
        }
        imageContent.push({ type: 'text', text: userText })

        const response = await client.messages.create({
          model: VISION_MODEL,
          max_tokens: 2048,
          system: systemPrompt,
          messages: [{ role: 'user', content: imageContent }],
        })
        const textBlock = response.content.find((b) => b.type === 'text')
        rawText = textBlock?.type === 'text' ? textBlock.text : ''
        recordSuccess('anthropic')
      } catch (anthropicErr) {
        console.error('[mediaAnalysis] Anthropic vision failed:', anthropicErr)
        // Fatal (credits/auth/quota) → open the breaker so we stop hammering it,
        // and flag the first transition for escalation (logged; CIC reads outages).
        if (isFatalProviderError(anthropicErr)) {
          const firstDown = markDown('anthropic', anthropicErr instanceof Error ? anthropicErr.message : 'vision error')
          if (firstDown) {
            console.error('[mediaAnalysis] ⚠ ESCALATE: Anthropic vision DOWN → falling back to Gemini')
          }
        }
      }
    }

    // ── Provider 2: Gemini fallback ─────────────────────────────────────────
    if (!rawText) {
      if (!geminiKey) {
        return { success: false, error: 'Vision unavailable — Anthropic failed and GOOGLE_AI_API_KEY not set.' }
      }
      try {
        rawText = await analyzeImageWithGemini(imageUrl, systemPrompt, userText, { apiKey: geminiKey, expectJson: true })
        usedModel = process.env.GEMINI_VISION_MODEL || 'gemini-2.0-flash'
        recordSuccess('google')
      } catch (geminiErr) {
        console.error('[mediaAnalysis] Gemini vision failed:', geminiErr)
        if (isFatalProviderError(geminiErr)) markDown('google', geminiErr instanceof Error ? geminiErr.message : 'gemini error')
        return {
          success: false,
          error: `Vision analysis failed (all providers): ${geminiErr instanceof Error ? geminiErr.message : 'unknown'}`,
        }
      }
    }

    // Parse the JSON response
    let parsed: Record<string, unknown>
    try {
      // Try direct parse first
      parsed = JSON.parse(rawText)
    } catch {
      // Try extracting JSON from markdown code block
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1])
      } else {
        // Try finding the first { ... } block
        const braceMatch = rawText.match(/\{[\s\S]*\}/)
        if (braceMatch) {
          parsed = JSON.parse(braceMatch[0])
        } else {
          throw new Error(`Could not parse vision response as JSON: ${rawText.slice(0, 200)}`)
        }
      }
    }

    const durationMs = Date.now() - startTime

    return {
      success: true,
      vision: {
        description: String(parsed.description || ''),
        objects: Array.isArray(parsed.objects) ? parsed.objects.map(String) : [],
        colors: Array.isArray(parsed.colors) ? parsed.colors.map(String) : [],
        sceneType: String(parsed.sceneType || 'other'),
        textContent: String(parsed.textContent || ''),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        inventoryItems: Array.isArray(parsed.inventoryItems)
          ? parsed.inventoryItems
          : undefined,
        rawNotes: undefined,
      },
      ocrText: parsed.textContent ? String(parsed.textContent) : undefined,
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
      entities: parsed.entities
        ? {
            people: Array.isArray((parsed.entities as any).people)
              ? (parsed.entities as any).people.map(String)
              : [],
            places: Array.isArray((parsed.entities as any).places)
              ? (parsed.entities as any).places.map(String)
              : [],
            organizations: Array.isArray((parsed.entities as any).organizations)
              ? (parsed.entities as any).organizations.map(String)
              : [],
            dates: Array.isArray((parsed.entities as any).dates)
              ? (parsed.entities as any).dates.map(String)
              : [],
            amounts: Array.isArray((parsed.entities as any).amounts)
              ? (parsed.entities as any).amounts.map(String)
              : [],
          }
        : undefined,
      summary: parsed.summary ? String(parsed.summary).slice(0, 200) : undefined,
      modelUsed: usedModel,
      durationMs,
    }
  } catch (err) {
    const durationMs = Date.now() - startTime
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[MediaAnalysis] Vision analysis failed:', message)
    return {
      success: false,
      error: message,
      durationMs,
    }
  }
}

/**
 * Upper bound on images per combine call. Both providers accept more, but this
 * keeps one request's tokens + latency sane for the nightly-inventory use case
 * (a junk drawer to a vape shelf is typically 1–6 photos). Extras are dropped
 * with a note rather than silently truncated.
 */
export const MAX_COMBINE_IMAGES = 8

/**
 * Analyze 1–N images in a SINGLE provider call and return ONE combined result.
 *
 * The model sees every image at once, so it can merge them: stitch sequential
 * screenshots into one timeline, or dedupe an inventory across several shelf
 * photos (summing quantities, noting which shot each item came from). Maintains
 * the exact provider chain as analyzeImage(): Anthropic vision first (circuit-
 * broken on fatal errors), Gemini as the cross-vendor fallback.
 *
 * `droppedForCap` reports how many images were dropped when over MAX_COMBINE_IMAGES.
 */
export async function analyzeImages(
  imageUrls: string[],
  options: Partial<MediaAnalysisOptions> = {},
): Promise<AnalysisResult & { imageCount?: number; droppedForCap?: number }> {
  const startTime = Date.now()

  const urls = imageUrls.filter((u) => typeof u === 'string' && u.length > 0)
  if (urls.length === 0) return { success: false, error: 'No images provided.' }

  const droppedForCap = Math.max(0, urls.length - MAX_COMBINE_IMAGES)
  // Bytes-not-URL for each (see toBase64ImageUrl) — reliable past r2.dev rate limits.
  const used = await Promise.all(urls.slice(0, MAX_COMBINE_IMAGES).map(toBase64ImageUrl))

  // Single image → the existing single-image path is identical work; reuse it.
  if (used.length === 1) {
    const single = await analyzeImage(used[0], options)
    return { ...single, imageCount: 1, droppedForCap }
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY
  const geminiKey = process.env.GOOGLE_AI_API_KEY
  if (!anthropicKey && !geminiKey) {
    return { success: false, error: 'No vision provider configured (ANTHROPIC_API_KEY / GOOGLE_AI_API_KEY).' }
  }

  try {
    const inventorySection = options.inventoryMode
      ? `\n- "inventoryItems": array of { "item": string, "quantity": number|null, "location": string|null } — the MERGED inventory across ALL images. When the same product appears in more than one image, list it ONCE and sum the counts; use "location" to note where it was seen (e.g. "top shelf", "image 2").`
      : ''

    const customSection = options.customPrompt ? `\n\nAdditional context: ${options.customPrompt}` : ''

    // The combine instruction — the whole reason this path exists.
    const systemPrompt = `You are a media analysis engine. You are given ${used.length} images that are DIFFERENT VIEWS OR SEGMENTS OF THE SAME SUBJECT (e.g. sections of one shelf, consecutive screenshots of one timeline, several angles of one drawer). Combine them into ONE unified analysis — do NOT describe each image separately. Merge and de-duplicate: an item or entry visible in multiple images is ONE thing, not several.

Return ONLY a valid JSON object with these fields:
- "description": string — combined description of the whole subject across all ${used.length} images (2-4 sentences)
- "objects": string[] — distinct objects/subjects across all images (de-duplicated)
- "colors": string[] — dominant colors (max 5)
- "sceneType": string — one of: "document", "product", "indoor", "outdoor", "portrait", "food", "abstract", "screenshot", "diagram", "inventory", "artwork", "other"
- "textContent": string — combined readable text across all images (labels, screenshots, signs)
- "confidence": number — 0.0 to 1.0
- "tags": string[] — 5-15 descriptive tags
- "entities": { "people": string[], "places": string[], "organizations": string[], "dates": string[], "amounts": string[] }
- "summary": string — one-line summary of the combined result (max 100 chars)${inventorySection}

Return ONLY the JSON object, no markdown, no commentary.${customSection}`

    const userText = `Combine these ${used.length} images into a single analysis according to the system instructions.`
    let rawText = ''
    let usedModel: string = VISION_MODEL

    // ── Provider 1: Anthropic vision (skipped while circuit-broken) ──────────
    if (anthropicKey && !isDown('anthropic')) {
      try {
        const Anthropic = (await import('@anthropic-ai/sdk')).default
        const client = new Anthropic({ apiKey: anthropicKey })

        const content: any[] = []
        for (const imageUrl of used) {
          if (imageUrl.startsWith('data:')) {
            const [header, base64Data] = imageUrl.split(',')
            const mediaType = header?.match(/data:([^;]+)/)?.[1] || 'image/png'
            content.push({ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } })
          } else {
            content.push({ type: 'image', source: { type: 'url', url: imageUrl } })
          }
        }
        content.push({ type: 'text', text: userText })

        const response = await client.messages.create({
          model: VISION_MODEL,
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content }],
        })
        const textBlock = response.content.find((b) => b.type === 'text')
        rawText = textBlock?.type === 'text' ? textBlock.text : ''
        recordSuccess('anthropic')
      } catch (anthropicErr) {
        console.error('[mediaAnalysis] Anthropic multi-image vision failed:', anthropicErr)
        if (isFatalProviderError(anthropicErr)) {
          const firstDown = markDown('anthropic', anthropicErr instanceof Error ? anthropicErr.message : 'vision error')
          if (firstDown) console.error('[mediaAnalysis] ⚠ ESCALATE: Anthropic vision DOWN → falling back to Gemini')
        }
      }
    }

    // ── Provider 2: Gemini fallback (single multi-image call) ────────────────
    if (!rawText) {
      if (!geminiKey) {
        return { success: false, error: 'Vision unavailable — Anthropic failed and GOOGLE_AI_API_KEY not set.' }
      }
      try {
        rawText = await analyzeImagesWithGemini(used, systemPrompt, userText, { apiKey: geminiKey, expectJson: true })
        usedModel = process.env.GEMINI_VISION_MODEL || 'gemini-2.0-flash'
        recordSuccess('google')
      } catch (geminiErr) {
        console.error('[mediaAnalysis] Gemini multi-image vision failed:', geminiErr)
        if (isFatalProviderError(geminiErr)) markDown('google', geminiErr instanceof Error ? geminiErr.message : 'gemini error')
        return { success: false, error: `Vision analysis failed (all providers): ${geminiErr instanceof Error ? geminiErr.message : 'unknown'}` }
      }
    }

    // Parse the JSON response (same tolerant parse as analyzeImage)
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(rawText)
    } catch {
      const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) parsed = JSON.parse(jsonMatch[1])
      else {
        const braceMatch = rawText.match(/\{[\s\S]*\}/)
        if (braceMatch) parsed = JSON.parse(braceMatch[0])
        else throw new Error(`Could not parse vision response as JSON: ${rawText.slice(0, 200)}`)
      }
    }

    const durationMs = Date.now() - startTime

    return {
      success: true,
      imageCount: used.length,
      droppedForCap,
      vision: {
        description: String(parsed.description || ''),
        objects: Array.isArray(parsed.objects) ? parsed.objects.map(String) : [],
        colors: Array.isArray(parsed.colors) ? parsed.colors.map(String) : [],
        sceneType: String(parsed.sceneType || 'other'),
        textContent: String(parsed.textContent || ''),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        inventoryItems: Array.isArray(parsed.inventoryItems) ? parsed.inventoryItems : undefined,
        rawNotes: undefined,
      },
      ocrText: parsed.textContent ? String(parsed.textContent) : undefined,
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
      entities: parsed.entities
        ? {
            people: Array.isArray((parsed.entities as any).people) ? (parsed.entities as any).people.map(String) : [],
            places: Array.isArray((parsed.entities as any).places) ? (parsed.entities as any).places.map(String) : [],
            organizations: Array.isArray((parsed.entities as any).organizations) ? (parsed.entities as any).organizations.map(String) : [],
            dates: Array.isArray((parsed.entities as any).dates) ? (parsed.entities as any).dates.map(String) : [],
            amounts: Array.isArray((parsed.entities as any).amounts) ? (parsed.entities as any).amounts.map(String) : [],
          }
        : undefined,
      summary: parsed.summary ? String(parsed.summary).slice(0, 200) : undefined,
      modelUsed: usedModel,
      durationMs,
    }
  } catch (err) {
    const durationMs = Date.now() - startTime
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[MediaAnalysis] Multi-image analysis failed:', message)
    return { success: false, error: message, durationMs }
  }
}

// ── Media URL Resolution ───────────────────────────────────────────────────

/**
 * Resolve a media document to a fetchable URL.
 * Handles both local files and Vercel Blob URLs.
 */
export function resolveMediaUrl(mediaDoc: Record<string, unknown>): string | null {
  // Vercel Blob or external URL
  if (typeof mediaDoc.url === 'string' && mediaDoc.url.startsWith('http')) {
    return mediaDoc.url
  }

  // Served via Payload's /api/media/file route (relative) — prefix an ABSOLUTE
  // base. Mirror leo-stream's working vision path exactly: NEXT_PUBLIC_SERVER_URL
  // (or PAYLOAD_PUBLIC_SERVER_URL) first, then the Vercel prod URL, then localhost.
  // The old form `A || B ? https://B : localhost` mis-parsed as `(A||B) ? https://B
  // : localhost`, ignoring A and yielding `https://undefined` → the vision 404.
  const serverUrl =
    process.env.NEXT_PUBLIC_SERVER_URL ||
    process.env.PAYLOAD_PUBLIC_SERVER_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : 'http://localhost:3000')

  if (typeof mediaDoc.url === 'string') {
    return `${serverUrl}${mediaDoc.url}`
  }

  if (typeof mediaDoc.filename === 'string') {
    return `${serverUrl}/media/${mediaDoc.filename}`
  }

  return null
}

/**
 * Determine the MIME type of a media document.
 */
export function getMediaMimeType(mediaDoc: Record<string, unknown>): string {
  if (typeof mediaDoc.mimeType === 'string') return mediaDoc.mimeType

  // Infer from filename
  const filename = String(mediaDoc.filename || mediaDoc.url || '')
  const ext = filename.split('.').pop()?.toLowerCase()

  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
  }

  return mimeMap[ext || ''] || 'application/octet-stream'
}

/**
 * Check if a media document is an analyzable image.
 */
export function isAnalyzableImage(mediaDoc: Record<string, unknown>): boolean {
  const mime = getMediaMimeType(mediaDoc)
  return ANALYZABLE_IMAGE_TYPES.includes(mime)
}

/**
 * Check if a media document is a PDF.
 */
export function isPdf(mediaDoc: Record<string, unknown>): boolean {
  return getMediaMimeType(mediaDoc) === PDF_MIME
}

// ── Orchestrator ───────────────────────────────────────────────────────────

/**
 * Main orchestrator: analyze a media item and create/update MediaMeta records.
 *
 * Routes to the correct analyzer based on MIME type:
 *   - Image → analyzeImage()
 *   - PDF → extractPdfPages() (each page becomes a separate MediaMeta)
 *   - Other → basic metadata only
 *
 * Returns the created MediaMeta document IDs.
 */
export async function buildMediaMeta(
  payload: Payload,
  options: MediaAnalysisOptions,
): Promise<{ success: boolean; metaIds: (number | string)[]; error?: string }> {
  const { mediaDoc, tenantId, sourceMessageId } = options
  const mediaId =
    typeof mediaDoc.id === 'number' || typeof mediaDoc.id === 'string'
      ? mediaDoc.id
      : undefined

  if (!mediaId) {
    return { success: false, metaIds: [], error: 'Media document has no ID' }
  }

  const mime = getMediaMimeType(mediaDoc)
  const metaIds: (number | string)[] = []

  // ── Check for existing analysis ────────────────────────────────────
  const existing = await payload.find({
    collection: 'media-meta' as any,
    where: {
      media: { equals: mediaId },
      status: { in: ['complete', 'processing'] },
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) {
    // Already analyzed or in progress
    return {
      success: true,
      metaIds: existing.docs.map((d) => d.id),
      error: undefined,
    }
  }

  // ── Route by type ──────────────────────────────────────────────────

  if (isAnalyzableImage(mediaDoc)) {
    // Single image analysis
    const url = resolveMediaUrl(mediaDoc)
    if (!url) {
      return { success: false, metaIds: [], error: 'Could not resolve media URL' }
    }

    // Create pending record
    const meta = await payload.create({
      collection: 'media-meta' as any,
      data: {
        media: mediaId,
        status: 'processing',
        extractionType: 'image_vision',
        ...(sourceMessageId ? { sourceMessage: sourceMessageId } : {}),
        ...(tenantId ? { tenant: tenantId } : {}),
      } as any,
      overrideAccess: true,
    })

    // Run analysis
    const result = await analyzeImage(url, options)

    // Update with results
    await payload.update({
      collection: 'media-meta' as any,
      id: meta.id,
      data: {
        status: result.success ? 'complete' : 'error',
        visionAnalysis: result.vision || undefined,
        ocrText: result.ocrText || undefined,
        tags: result.tags || undefined,
        entities: result.entities || undefined,
        summary: result.summary || undefined,
        processedAt: new Date().toISOString(),
        processedBy: result.modelUsed || 'unknown',
        processingDurationMs: result.durationMs || undefined,
        processingError: result.error || undefined,
      } as any,
      overrideAccess: true,
    })

    metaIds.push(meta.id)
  } else if (isPdf(mediaDoc)) {
    // PDF processing
    const url = resolveMediaUrl(mediaDoc)
    if (!url) {
      return { success: false, metaIds: [], error: 'Could not resolve media URL' }
    }

    try {
      const pageResults = await extractPdfPages(payload, url, mediaDoc, options)
      metaIds.push(...pageResults)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      // Create error record
      const meta = await payload.create({
        collection: 'media-meta' as any,
        data: {
          media: mediaId,
          status: 'error',
          extractionType: 'pdf_page',
          processingError: `PDF extraction failed: ${message}`,
          ...(sourceMessageId ? { sourceMessage: sourceMessageId } : {}),
          ...(tenantId ? { tenant: tenantId } : {}),
        } as any,
        overrideAccess: true,
      })
      metaIds.push(meta.id)
      return { success: false, metaIds, error: message }
    }
  } else {
    // Unsupported type — create basic metadata record
    const meta = await payload.create({
      collection: 'media-meta' as any,
      data: {
        media: mediaId,
        status: 'complete',
        extractionType: 'manual',
        summary: `${mime} file: ${mediaDoc.filename || 'unknown'}`,
        tags: [mime.split('/')[0], mime.split('/')[1]],
        ...(sourceMessageId ? { sourceMessage: sourceMessageId } : {}),
        ...(tenantId ? { tenant: tenantId } : {}),
        processedAt: new Date().toISOString(),
        processedBy: 'system',
      } as any,
      overrideAccess: true,
    })
    metaIds.push(meta.id)
  }

  return { success: true, metaIds }
}

// ── PDF Page Extraction ────────────────────────────────────────────────────

/**
 * Extract pages from a PDF and create a MediaMeta record for each page.
 *
 * Strategy:
 *   1. Fetch the PDF
 *   2. Use pdf-lib to determine page count
 *   3. For each page, use Anthropic Vision to analyze the page
 *      (Claude can process PDFs directly as document images)
 *   4. Create a MediaMeta per page with documentGroup linking them
 *
 * Note: Claude Vision can analyze PDF files directly. We send the full PDF
 * with a page-specific prompt to extract per-page content.
 *
 * Returns array of created MediaMeta IDs.
 */
async function extractPdfPages(
  payload: Payload,
  pdfUrl: string,
  mediaDoc: Record<string, unknown>,
  options: MediaAnalysisOptions,
): Promise<(number | string)[]> {
  const { tenantId, sourceMessageId } = options
  const mediaId = mediaDoc.id as number | string
  const documentGroup = `doc_${mediaId}_${Date.now().toString(36)}`
  const metaIds: (number | string)[] = []

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured')
  }

  // Fetch the PDF as base64
  let pdfBase64: string
  try {
    const response = await fetch(pdfUrl, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const buffer = await response.arrayBuffer()
    pdfBase64 = Buffer.from(buffer).toString('base64')
  } catch (err) {
    throw new Error(`Failed to fetch PDF: ${err instanceof Error ? err.message : 'Unknown'}`)
  }

  // Determine page count — use Claude to count pages
  // (pdf-lib would be ideal but we avoid the dependency for now)
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const client = new Anthropic({ apiKey })

  // First pass: get page count and overall summary
  const countResponse = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 512,
    system: 'You are analyzing a PDF document. Return ONLY a JSON object with: { "pageCount": number, "documentType": string, "title": string }. No markdown, no commentary.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: pdfBase64,
            },
          } as any,
          {
            type: 'text',
            text: 'How many pages does this PDF have? What type of document is it? What is its title?',
          },
        ],
      },
    ],
  })

  let pageCount = 1
  let docTitle = 'Unknown Document'
  try {
    const countText =
      countResponse.content.find((b) => b.type === 'text')?.type === 'text'
        ? (countResponse.content.find((b) => b.type === 'text') as any).text
        : ''
    const countParsed = JSON.parse(
      countText.match(/\{[\s\S]*\}/)?.[0] || '{}',
    )
    pageCount = Math.min(Number(countParsed.pageCount) || 1, 100) // Cap at 100 pages
    docTitle = String(countParsed.title || countParsed.documentType || 'Document')
  } catch {
    // Default to 1 page if parsing fails
  }

  // Process each page (or small batches for large documents)
  const BATCH_SIZE = 5 // Process 5 pages at a time to manage API costs
  const totalPages = pageCount

  for (let batchStart = 1; batchStart <= totalPages; batchStart += BATCH_SIZE) {
    const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages)
    const pageRange = `${batchStart}-${batchEnd}`

    // Analyze this batch of pages
    const batchPrompt = totalPages === 1
      ? 'Analyze the content of this PDF page.'
      : `Analyze pages ${pageRange} of this ${totalPages}-page PDF document. For EACH page in this range, provide analysis.`

    const batchSystemPrompt = `You are analyzing a PDF document titled "${docTitle}".
Return ONLY a JSON array where each element represents one page with these fields:
- "pageNumber": number
- "description": string — what's on this page (2-3 sentences)
- "textContent": string — all readable text on this page
- "objects": string[] — notable visual elements
- "sceneType": "document" | "diagram" | "photograph" | "table" | "form" | "artwork" | "other"
- "tags": string[] — 3-8 descriptive tags
- "entities": { "people": string[], "places": string[], "organizations": string[], "dates": string[], "amounts": string[] }
- "summary": string — one-line summary (max 80 chars)

Return ONLY the JSON array. No markdown, no commentary.`

    try {
      const pageResponse = await client.messages.create({
        model: VISION_MODEL,
        max_tokens: 4096,
        system: batchSystemPrompt,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document',
                source: {
                  type: 'base64',
                  media_type: 'application/pdf',
                  data: pdfBase64,
                },
              } as any,
              { type: 'text', text: batchPrompt },
            ],
          },
        ],
      })

      const pageText =
        pageResponse.content.find((b) => b.type === 'text')?.type === 'text'
          ? (pageResponse.content.find((b) => b.type === 'text') as any).text
          : '[]'

      let pages: Array<Record<string, unknown>>
      try {
        const jsonStr = pageText.match(/\[[\s\S]*\]/)?.[0] || '[]'
        pages = JSON.parse(jsonStr)
      } catch {
        // If parsing fails, treat as single page
        pages = [
          {
            pageNumber: batchStart,
            description: pageText.slice(0, 500),
            textContent: pageText,
            objects: [],
            sceneType: 'document',
            tags: ['document'],
            entities: {},
            summary: docTitle,
          },
        ]
      }

      // Create MediaMeta for each page
      for (const page of pages) {
        const pageNum = Number(page.pageNumber) || batchStart

        const meta = await payload.create({
          collection: 'media-meta' as any,
          data: {
            media: mediaId,
            status: 'complete',
            extractionType: 'pdf_page',
            documentGroup,
            pageNumber: pageNum,
            totalPages,
            visionAnalysis: {
              description: String(page.description || ''),
              objects: Array.isArray(page.objects) ? page.objects.map(String) : [],
              colors: [],
              sceneType: String(page.sceneType || 'document'),
              textContent: String(page.textContent || ''),
              confidence: 0.8,
            },
            ocrText: String(page.textContent || ''),
            tags: Array.isArray(page.tags) ? page.tags.map(String) : ['document', 'pdf'],
            entities: page.entities || undefined,
            summary: page.summary
              ? `${docTitle} — p${pageNum}: ${String(page.summary).slice(0, 150)}`
              : `${docTitle} — page ${pageNum}/${totalPages}`,
            processedAt: new Date().toISOString(),
            processedBy: VISION_MODEL,
            ...(sourceMessageId ? { sourceMessage: sourceMessageId } : {}),
            ...(tenantId ? { tenant: tenantId } : {}),
          } as any,
          overrideAccess: true,
        })

        metaIds.push(meta.id)
      }
    } catch (batchErr) {
      console.warn(
        `[MediaAnalysis] Failed to analyze pages ${pageRange}:`,
        batchErr instanceof Error ? batchErr.message : batchErr,
      )
      // Create error record for this batch
      const meta = await payload.create({
        collection: 'media-meta' as any,
        data: {
          media: mediaId,
          status: 'error',
          extractionType: 'pdf_page',
          documentGroup,
          pageNumber: batchStart,
          totalPages,
          processingError: `Failed to analyze pages ${pageRange}: ${batchErr instanceof Error ? batchErr.message : 'Unknown'}`,
          ...(sourceMessageId ? { sourceMessage: sourceMessageId } : {}),
          ...(tenantId ? { tenant: tenantId } : {}),
        } as any,
        overrideAccess: true,
      })
      metaIds.push(meta.id)
    }
  }

  return metaIds
}
