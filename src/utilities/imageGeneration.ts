/**
 * Image Generation Utility — LEO Media Creation
 *
 * Dual-path architecture:
 *   Path A (preferred): Vercel AI Gateway → generateImage() from AI SDK
 *   Path B (fallback):  OpenRouter API → chat completions with image models
 *
 * Architecture:
 *   1. LEO's `generate_image` tool calls generateImage() with a prompt
 *   2. AI Gateway (or OpenRouter fallback) generates the image
 *   3. We upload the image to Payload Media (→ Vercel Blob in prod)
 *   4. The Media doc ID can be attached to products, messages, etc.
 *
 * Also uses Anthropic for image understanding/feedback (vision API).
 *
 * @see leo-data-tools.ts — tool definitions
 * @see ai-gateway.ts — gateway image model factory
 */

import type { Payload } from 'payload'
import { getImageModel, isGatewayAvailable } from './ai-gateway'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1/chat/completions'

/** Default OpenRouter image model (fallback path) */
const DEFAULT_OPENROUTER_MODEL = 'google/gemini-3-pro-image-preview'

/** Fallback OpenRouter models in priority order */
const OPENROUTER_FALLBACK_MODELS = [
  'google/gemini-3-pro-image-preview',
  'google/gemini-3.1-flash-image-preview',
  'google/gemini-2.5-flash-image',
  'openai/gpt-5-image-mini',
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImageGenerationOptions = {
  /** The user's description of what to generate */
  prompt: string
  /** Additional context to enhance the prompt (product name, brand, style) */
  enhancementContext?: {
    productName?: string
    brandStyle?: string
    category?: string
    backgroundColor?: string
    existingImageDescription?: string
  }
  /** Which model to use (defaults to Gemini 3 Pro Image Preview via OpenRouter) */
  model?: string
  /** Whether to auto-upload to Payload Media */
  autoUpload?: boolean
  /** Tenant ID for multi-tenant media scoping */
  tenantId?: number
}

export type ImageGenerationResult = {
  success: boolean
  /** Base64 data URL of the generated image */
  imageDataUrl?: string
  /** Text response from the model (if any) */
  modelText?: string
  /** The model that was actually used */
  modelUsed?: string
  /** If uploaded to Payload, the Media document ID */
  mediaId?: number
  /** The permanent URL from Vercel Blob / Media collection */
  permanentUrl?: string
  /** Error message if generation failed */
  error?: string
  /** Warning if image was generated but upload to media library failed */
  uploadWarning?: string
}

export type ImageFeedbackOptions = {
  /** The current image URL or base64 to analyze */
  imageUrl: string
  /** User's feedback about what to change */
  feedback: string
  /** Context about what the image is for */
  context?: string
}

export type ImageFeedbackResult = {
  /** The improved prompt based on feedback */
  improvedPrompt: string
  /** Analysis of what needs to change */
  analysis: string
  /** Whether the feedback suggests regeneration or just adjustment */
  suggestsRegeneration: boolean
}

// ---------------------------------------------------------------------------
// Prompt Enhancement
// ---------------------------------------------------------------------------

/**
 * Enhances a user prompt to produce better product photography.
 * Adds professional photography direction without changing the user's intent.
 */
function enhancePromptForProduct(
  userPrompt: string,
  context?: ImageGenerationOptions['enhancementContext'],
): string {
  const parts: string[] = []

  // Base: user's description
  parts.push(userPrompt)

  // Add product photography direction
  if (context?.productName) {
    parts.push(`Product: "${context.productName}".`)
  }

  if (context?.category) {
    const categoryStyles: Record<string, string> = {
      candles: 'Warm ambient lighting, soft bokeh background, lifestyle product photography.',
      jewelry: 'Clean white background, soft diffused lighting, macro detail, luxury product photography.',
      clothing: 'Fashion editorial style, natural lighting, clean background.',
      food: 'Food photography styling, appetizing presentation, natural daylight.',
      electronics: 'Clean tech product photography, gradient background, crisp reflections.',
      art: 'Gallery-quality documentation, neutral background, true color reproduction.',
      wellness: 'Serene natural setting, soft earth tones, mindful lifestyle photography.',
      massage: 'Spa environment, calming earth tones, warm lighting, relaxation lifestyle.',
      cactus: 'Desert botanical photography, natural sunlight, rustic southwestern aesthetic.',
      signs: 'CNC-cut wood sign product photography, rustic wood grain texture visible, clean workshop or outdoor Florida setting, warm natural sunlight, slight shadow depth showing laser-cut edges and layers.',
      decor: 'Handcrafted home decor product photography, warm interior setting, natural wood grain and painted details visible, lifestyle staging with complementary props.',
      woodwork: 'CNC and laser-cut plywood craft photography, workshop or lifestyle setting, visible wood texture and precision-cut edges, warm lighting showcasing three-dimensional layering.',
      crafts: 'Handmade artisan product photography, warm lifestyle setting, detailed close-up showing craftsmanship and materials, natural daylight.',
      outdoor: 'Outdoor product photography, Florida sunshine, tropical or coastal setting, vibrant colors, natural dappled sunlight.',
    }
    const style =
      categoryStyles[context.category.toLowerCase()] ||
      'Professional product photography, clean composition.'
    parts.push(style)
  }

  if (context?.brandStyle) {
    parts.push(`Brand aesthetic: ${context.brandStyle}.`)
  }

  if (context?.backgroundColor) {
    parts.push(`Background: ${context.backgroundColor}.`)
  }

  if (context?.existingImageDescription) {
    parts.push(`Improving upon: ${context.existingImageDescription}.`)
  }

  // Universal quality markers
  parts.push('High-resolution, professional photography, sharp focus, beautiful composition.')

  return parts.join(' ')
}

// ---------------------------------------------------------------------------
// Core Generation via OpenRouter
// ---------------------------------------------------------------------------

/**
 * Generate an image using Vercel AI Gateway (preferred) or OpenRouter (fallback).
 *
 * Path A: AI Gateway → AI SDK generateImage() → base64
 * Path B: OpenRouter → chat completions → extract image from response
 *
 * Returns base64 image data — auto-uploads to Payload Media if requested.
 */
export async function generateImage(
  options: ImageGenerationOptions,
  payload?: Payload,
  tenantOpenRouterKey?: string,
): Promise<ImageGenerationResult> {
  const enhancedPrompt = enhancePromptForProduct(options.prompt, options.enhancementContext)

  // --- Path A: Vercel AI Gateway (preferred) ---
  if (isGatewayAvailable()) {
    try {
      const result = await generateViaGateway(enhancedPrompt, options, payload)
      if (result.success) return result
      console.warn('[ImageGeneration] Gateway failed, trying OpenRouter fallback:', result.error)
    } catch (err) {
      console.warn('[ImageGeneration] Gateway error, falling back to OpenRouter:', err)
    }
  }

  // --- Path B: OpenRouter (fallback) ---
  const apiKey = tenantOpenRouterKey || process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    return {
      success: false,
      error: 'Image generation unavailable — neither AI_GATEWAY_API_KEY nor OPENROUTER_API_KEY is configured.',
    }
  }

  return generateViaOpenRouter(enhancedPrompt, apiKey, options, payload)
}

/**
 * Generate an image via Vercel AI Gateway using the AI SDK generateImage().
 */
async function generateViaGateway(
  prompt: string,
  options: ImageGenerationOptions,
  payload?: Payload,
): Promise<ImageGenerationResult> {
  const { generateImage: aiGenerateImage } = await import('ai')
  const imageModel = getImageModel(options.model)

  if (!imageModel) {
    return { success: false, error: 'AI Gateway image model not available.' }
  }

  try {
    const response = await aiGenerateImage({
      model: imageModel,
      prompt,
      n: 1,
    })

    if (!response.images || response.images.length === 0) {
      return { success: false, error: 'AI Gateway returned no images.' }
    }

    const img = response.images[0]
    // AI SDK returns base64 string; convert to data URL
    const imageDataUrl = img.base64.startsWith('data:')
      ? img.base64
      : `data:image/png;base64,${img.base64}`

    const result: ImageGenerationResult = {
      success: true,
      imageDataUrl,
      modelUsed: `gateway/${imageModel.modelId}`,
    }

    // Auto-upload to Payload Media
    if (options.autoUpload && payload) {
      await tryUploadToMedia(result, imageDataUrl, options, payload)
    }

    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[ImageGeneration] Gateway generation error:', msg)

    if (msg.includes('content_policy') || msg.includes('safety')) {
      return {
        success: false,
        error: 'The image prompt was flagged by content policy. Please try a different description.',
      }
    }

    return { success: false, error: `Gateway image generation failed: ${msg}` }
  }
}

/**
 * Generate an image via OpenRouter chat completions API.
 */
async function generateViaOpenRouter(
  prompt: string,
  apiKey: string,
  options: ImageGenerationOptions,
  payload?: Payload,
  model?: string,
): Promise<ImageGenerationResult> {
  const selectedModel = model || options.model || DEFAULT_OPENROUTER_MODEL

  try {
    const response = await fetch(OPENROUTER_BASE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SERVER_URL || 'https://spacesangels.com',
        'X-Title': 'Angel OS - LEO Image Generation',
      },
      body: JSON.stringify({
        model: selectedModel,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        modalities: ['image', 'text'],
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[ImageGeneration] OpenRouter error:', response.status, errorBody)

      // Try fallback models
      if (selectedModel === DEFAULT_OPENROUTER_MODEL) {
        for (const fallbackModel of OPENROUTER_FALLBACK_MODELS.slice(1)) {
          const fallbackResult = await generateViaOpenRouter(
            prompt, apiKey, options, payload, fallbackModel,
          )
          if (fallbackResult.success) return fallbackResult
        }
      }

      return {
        success: false,
        error: `Image generation failed (HTTP ${response.status}). Please try again.`,
      }
    }

    const data = await response.json()
    const choice = data?.choices?.[0]?.message

    if (!choice) {
      return { success: false, error: 'Image generation returned no data.' }
    }

    // Extract image — OpenRouter models return images in different formats
    let imageDataUrl: string | undefined

    // Format 1: message.images array (Gemini models)
    if (choice.images && Array.isArray(choice.images) && choice.images.length > 0) {
      const img = choice.images[0]
      imageDataUrl = img.image_url?.url || img.url || img
      if (typeof imageDataUrl === 'object') imageDataUrl = undefined
    }

    // Format 2: content array with image_url blocks
    if (!imageDataUrl && Array.isArray(choice.content)) {
      for (const block of choice.content) {
        if (block.type === 'image_url' && block.image_url?.url) {
          imageDataUrl = block.image_url.url
          break
        }
      }
    }

    if (!imageDataUrl) {
      return {
        success: false,
        error: 'Image model returned text but no image. Try a different prompt or model.',
        modelText: typeof choice.content === 'string' ? choice.content : undefined,
      }
    }

    const result: ImageGenerationResult = {
      success: true,
      imageDataUrl,
      modelUsed: data?.model || selectedModel,
      modelText: typeof choice.content === 'string' ? choice.content : undefined,
    }

    // Auto-upload to Payload Media
    if (options.autoUpload && payload) {
      await tryUploadToMedia(result, imageDataUrl, options, payload)
    }

    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[ImageGeneration] OpenRouter error:', msg)

    if (msg.includes('content_policy')) {
      return {
        success: false,
        error: 'The image prompt was flagged by content policy. Please try a different description.',
      }
    }

    return { success: false, error: `Image generation failed: ${msg}` }
  }
}

/**
 * Tries to upload a generated image to Payload Media.
 * Mutates `result` to add mediaId/permanentUrl or uploadWarning.
 */
async function tryUploadToMedia(
  result: ImageGenerationResult,
  imageDataUrl: string,
  options: ImageGenerationOptions,
  payload: Payload,
): Promise<void> {
  try {
    const uploadResult = await uploadGeneratedImage(payload, imageDataUrl, {
      alt:
        options.enhancementContext?.productName
          ? `AI-generated image for ${options.enhancementContext.productName}`
          : 'AI-generated image',
      productName: options.enhancementContext?.productName,
      tenantId: options.tenantId,
    })

    if ('mediaId' in uploadResult) {
      result.mediaId = uploadResult.mediaId
      result.permanentUrl = uploadResult.permanentUrl
    } else {
      console.warn('[ImageGeneration] Upload returned no mediaId')
      result.uploadWarning = 'Image generated but could not be saved to media library.'
    }
  } catch (uploadErr) {
    console.error('[ImageGeneration] Upload failed:', uploadErr)
    result.uploadWarning = `Image generated but upload failed: ${uploadErr instanceof Error ? uploadErr.message : 'Unknown error'}`
  }
}

// ---------------------------------------------------------------------------
// Image Feedback via Anthropic Vision
// ---------------------------------------------------------------------------

/**
 * Analyze an existing image and generate an improved prompt based on user feedback.
 * Uses Anthropic's vision API to understand the current image, then crafts
 * a better generation prompt incorporating the feedback.
 *
 * This is the "respond to feedback about existing images" capability —
 * LEO sees the image, understands what's wrong, and knows how to fix it.
 */
export async function analyzeImageForFeedback(
  options: ImageFeedbackOptions,
): Promise<ImageFeedbackResult> {
  const Anthropic = (await import('@anthropic-ai/sdk')).default
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      improvedPrompt: options.feedback,
      analysis: 'Vision analysis unavailable — using feedback directly as prompt.',
      suggestsRegeneration: true,
    }
  }

  try {
    const client = new Anthropic({ apiKey })

    // Build image content for vision
    const imageContent: Array<{ type: string; source?: Record<string, string>; text?: string }> = []

    if (options.imageUrl.startsWith('data:')) {
      // Base64 image
      const [header, base64Data] = options.imageUrl.split(',')
      const mediaType = header?.match(/data:([^;]+)/)?.[1] || 'image/png'
      imageContent.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType,
          data: base64Data,
        },
      })
    } else {
      // URL image
      imageContent.push({
        type: 'image',
        source: {
          type: 'url',
          url: options.imageUrl,
        },
      })
    }

    imageContent.push({
      type: 'text',
      text: `You are an expert product photographer and image director for an e-commerce platform called Angel OS.

Analyze this image and the user's feedback, then provide:
1. A brief analysis of what the current image shows and what needs improvement
2. An improved image generation prompt that addresses the feedback
3. Whether this requires a complete regeneration or could be a minor adjustment

User's feedback: "${options.feedback}"
${options.context ? `Context: ${options.context}` : ''}

Respond in this exact JSON format:
{
  "analysis": "Brief description of the current image and what needs to change",
  "improvedPrompt": "A complete, detailed prompt for generating an improved version",
  "suggestsRegeneration": true/false
}`,
    })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: imageContent as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        },
      ],
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const text = textBlock && 'text' in textBlock ? textBlock.text : ''

    // Try to parse as JSON
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          improvedPrompt: parsed.improvedPrompt || options.feedback,
          analysis: parsed.analysis || 'Analysis completed.',
          suggestsRegeneration: parsed.suggestsRegeneration !== false,
        }
      }
    } catch {
      // JSON parse failed — use the text as analysis
    }

    return {
      improvedPrompt: options.feedback,
      analysis: text || 'Could not analyze the image.',
      suggestsRegeneration: true,
    }
  } catch (err) {
    console.error('[ImageGeneration] Vision analysis error:', err)
    return {
      improvedPrompt: options.feedback,
      analysis: 'Vision analysis failed — using feedback directly.',
      suggestsRegeneration: true,
    }
  }
}

// ---------------------------------------------------------------------------
// Upload to Payload Media
// ---------------------------------------------------------------------------

/**
 * Uploads an image (from URL or base64) to Payload's Media collection.
 * The Media collection uses Vercel Blob storage in production.
 */
export async function uploadGeneratedImage(
  payload: Payload,
  imageSource: string,
  options: {
    alt: string
    filename?: string
    productName?: string
    tenantId?: number
  },
): Promise<{ mediaId: number; permanentUrl: string } | { error: string }> {
  try {
    let buffer: Buffer
    let contentType = 'image/png'

    if (imageSource.startsWith('data:')) {
      // Base64 data URL
      const commaIdx = imageSource.indexOf(',')
      if (commaIdx < 0) {
        return { error: 'Malformed data URL: missing comma separator' }
      }
      const header = imageSource.slice(0, commaIdx)
      const base64Data = imageSource.slice(commaIdx + 1)
      if (!base64Data || base64Data.length < 10) {
        return { error: 'Malformed data URL: empty or invalid base64 payload' }
      }
      contentType = header.match(/data:([^;]+)/)?.[1] || 'image/png'
      buffer = Buffer.from(base64Data, 'base64')
      if (buffer.length === 0) {
        return { error: 'Decoded image buffer is empty — invalid base64 data' }
      }
    } else {
      // HTTP URL — fetch the image
      const response = await fetch(imageSource)
      if (!response.ok) {
        return { error: `Failed to download image: HTTP ${response.status}` }
      }
      buffer = Buffer.from(await response.arrayBuffer())
      contentType = response.headers.get('content-type') || 'image/png'
    }

    // Determine filename
    const ext = contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : 'png'
    const baseFilename =
      options.filename ||
      (options.productName
        ? `${options.productName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-generated`
        : `leo-generated-${Date.now()}`)
    const filename = `${baseFilename}.${ext}`

    // Create a File-like object for Payload upload
    const file = {
      data: buffer,
      mimetype: contentType,
      name: filename,
      size: buffer.length,
    }

    // Upload to Payload Media collection (→ Vercel Blob in production)
    const mediaDoc = await payload.create({
      collection: 'media',
      data: {
        alt: options.alt,
        ...(options.tenantId ? { tenant: options.tenantId } : {}),
      },
      file,
      overrideAccess: true,
    })

    // Get the URL from the created media document
    const url =
      (mediaDoc as unknown as Record<string, unknown>).url as string ||
      (mediaDoc as unknown as Record<string, unknown>).filename as string ||
      ''

    return {
      mediaId: mediaDoc.id as number,
      permanentUrl: url,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[ImageGeneration] Upload error:', msg)
    return { error: `Failed to upload image: ${msg}` }
  }
}

// ---------------------------------------------------------------------------
// Attach / Replace Image on Product
// ---------------------------------------------------------------------------

/**
 * Attaches a Media document to a product's gallery array.
 * Can append to existing gallery or replace a specific image.
 *
 * Gallery schema: array of { image: upload(media), variantOption?: rel }
 * At depth:0, image field is a numeric media ID.
 * We preserve all existing array row properties (including Payload's `id`
 * field) so Payload recognizes them as existing rows and doesn't orphan them.
 */
export async function attachImageToProduct(
  payload: Payload,
  productId: number,
  mediaId: number,
  options?: { replaceIndex?: number },
): Promise<{ success: boolean; galleryCount?: number; error?: string }> {
  try {
    // Verify media exists first
    const media = await payload.findByID({
      collection: 'media',
      id: mediaId,
      depth: 0,
      overrideAccess: true,
    }).catch(() => null)

    if (!media) {
      return { success: false, error: `Media #${mediaId} not found — it may have been deleted.` }
    }

    const product = await payload.findByID({
      collection: 'products',
      id: productId,
      depth: 0,
      overrideAccess: true,
    })

    if (!product) {
      return { success: false, error: `Product #${productId} not found.` }
    }

    // Gallery is an array of objects. At depth:0, each item looks like:
    // { id: 'row-uuid', image: <mediaId:number>, variantOption?: <id:number> }
    // We MUST preserve all properties (especially `id`) so Payload knows
    // these are existing rows. New items get auto-assigned an id by Payload.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawGallery = (product as any).gallery
    const existingGallery: Array<Record<string, unknown>> = Array.isArray(rawGallery) ? rawGallery : []

    // Check for duplicate — don't add the same media ID twice
    const alreadyAttached = existingGallery.some((item) => {
      const imgId = typeof item.image === 'object' && item.image !== null
        ? (item.image as { id?: number }).id
        : item.image
      return imgId === mediaId
    })

    if (alreadyAttached) {
      return { success: true, galleryCount: existingGallery.length }
    }

    let updatedGallery: Array<Record<string, unknown>>

    if (options?.replaceIndex !== undefined && existingGallery.length > 0) {
      // Replace a specific image in the gallery — preserve the row ID
      updatedGallery = existingGallery.map((item, i) => {
        if (i === options.replaceIndex) {
          return { ...item, image: mediaId }
        }
        return item
      })
      // If replaceIndex is out of bounds, append instead
      if (options.replaceIndex < 0 || options.replaceIndex >= existingGallery.length) {
        updatedGallery = [...existingGallery, { image: mediaId }]
      }
    } else {
      // Append to gallery
      updatedGallery = [...existingGallery, { image: mediaId }]
    }

    await (payload.update as any)({ // eslint-disable-line @typescript-eslint/no-explicit-any
      collection: 'products',
      id: productId,
      data: { gallery: updatedGallery },
      overrideAccess: true,
    })

    // Verify the attachment stuck
    const updated = await payload.findByID({
      collection: 'products',
      id: productId,
      depth: 0,
      overrideAccess: true,
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalGallery = Array.isArray((updated as any).gallery) ? (updated as any).gallery : []
    const attached = finalGallery.some((item: Record<string, unknown>) => {
      const imgId = typeof item.image === 'object' && item.image !== null
        ? (item.image as { id?: number }).id
        : item.image
      return imgId === mediaId
    })

    if (!attached) {
      console.error(`[ImageGeneration] Gallery update did NOT persist for product #${productId}. Sent ${updatedGallery.length} items, got ${finalGallery.length} back.`)
      return { success: false, galleryCount: finalGallery.length, error: `Gallery update did not persist — the image may not have been saved. Try attaching it manually via the admin panel.` }
    }

    return { success: true, galleryCount: finalGallery.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[ImageGeneration] Attach error:', msg)
    return { success: false, error: `Failed to attach image to product: ${msg}` }
  }
}

// ---------------------------------------------------------------------------
// Replace Any Media Reference
// ---------------------------------------------------------------------------

/**
 * Replaces media for any content type — products, posts, messages.
 * This is the "replace any image" capability Kenneth requested.
 */
export async function replaceMediaOnContent(
  payload: Payload,
  oldMediaId: number,
  newMediaId: number,
  options?: { collection?: string; documentId?: number },
): Promise<{ success: boolean; updatedDocuments: number; error?: string }> {
  let updatedCount = 0

  try {
    // If specific document targeted, update just that one
    if (options?.collection && options?.documentId) {
      const doc = await payload.findByID({
        collection: options.collection as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        id: options.documentId,
        depth: 0,
        overrideAccess: true,
      })

      if (doc) {
        // Deep replace mediaId references in the document
        const docData = JSON.parse(JSON.stringify(doc))
        const replaced = deepReplaceMediaId(docData, oldMediaId, newMediaId)
        if (replaced) {
          await (payload.update as any)({ // eslint-disable-line @typescript-eslint/no-explicit-any
            collection: options.collection,
            id: options.documentId,
            data: docData,
            overrideAccess: true,
          })
          updatedCount++
        }
      }

      return { success: true, updatedDocuments: updatedCount }
    }

    // Otherwise, search and replace across products, posts, pages, tenants
    for (const collection of ['products', 'posts', 'pages', 'tenants'] as const) {
      try {
        const results = await payload.find({
          collection,
          where: {},
          limit: 100,
          depth: 0,
          overrideAccess: true,
        })

        for (const doc of results.docs) {
          const docData = JSON.parse(JSON.stringify(doc))
          const replaced = deepReplaceMediaId(docData, oldMediaId, newMediaId)
          if (replaced) {
            await (payload.update as any)({ // eslint-disable-line @typescript-eslint/no-explicit-any
              collection,
              id: doc.id,
              data: docData,
              overrideAccess: true,
            })
            updatedCount++
          }
        }
      } catch {
        // Collection might not exist yet — skip
      }
    }

    return { success: true, updatedDocuments: updatedCount }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return { success: false, updatedDocuments: updatedCount, error: msg }
  }
}

/**
 * Recursively replaces oldMediaId with newMediaId in a document object.
 * Returns true if any replacement was made.
 */
function deepReplaceMediaId(
  obj: Record<string, unknown>,
  oldId: number,
  newId: number,
): boolean {
  let replaced = false
  // Support both number and string comparisons (serialized docs may have string IDs)
  const matchesOldId = (v: unknown): boolean =>
    v === oldId || (typeof v === 'string' && v === String(oldId))

  for (const key of Object.keys(obj)) {
    const val = obj[key]

    // Direct ID reference (e.g., gallery[].image, meta.image)
    if (matchesOldId(val)) {
      obj[key] = newId
      replaced = true
    }
    // Nested object
    else if (val && typeof val === 'object' && !Array.isArray(val)) {
      if (deepReplaceMediaId(val as Record<string, unknown>, oldId, newId)) {
        replaced = true
      }
    }
    // Array
    else if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i++) {
        if (matchesOldId(val[i])) {
          val[i] = newId
          replaced = true
        } else if (val[i] && typeof val[i] === 'object') {
          if (deepReplaceMediaId(val[i] as Record<string, unknown>, oldId, newId)) {
            replaced = true
          }
        }
      }
    }
  }

  return replaced
}

// ---------------------------------------------------------------------------
// Feature Check
// ---------------------------------------------------------------------------

/**
 * Returns true if image generation is available.
 * Checks: AI Gateway (preferred) → OpenRouter → tenant BYOAI key.
 */
export function isImageGenerationAvailable(tenantOpenRouterKey?: string): boolean {
  return isGatewayAvailable() || Boolean(tenantOpenRouterKey || process.env.OPENROUTER_API_KEY)
}
