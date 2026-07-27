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
import { getImageModel, isGatewayAvailable, resolveImageProvider, resolveImageProviderChain } from './ai-gateway'
import type { TenantAiConfig, ResolvedImageProvider } from './ai-gateway'
import { isDown, markDown, recordSuccess, isFatalProviderError } from './providerHealth'

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
  /**
   * Reference images (absolute URLs or data: URLs) to CONDITION the generation on —
   * image-to-image / subject-consistent editing ("nano-banana"). E.g. a photo of a
   * person → "put them driving the Morgan" keeps their likeness; a product shot →
   * restyle it. Sent as image parts alongside the prompt to a Gemini image model
   * (which natively accepts image+text→image). When present, generation is routed to
   * the OpenRouter/Gemini path since not every provider accepts input images.
   */
  inputImages?: string[]
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
// Core Generation — Multi-Provider Router (Sprint 44)
// ---------------------------------------------------------------------------

/**
 * Generate an image using the best available provider.
 *
 * Provider resolution order (configurable per-tenant via aiConfig.preferredImageProvider):
 *   1. Vercel AI Gateway (preferred — routes to any model)
 *   2. OpenRouter (multi-model, tenant or platform key)
 *   3. OpenAI DALL-E (tenant key)
 *   4. Google Imagen / Gemini (tenant key)
 *   5. Cloudflare Workers AI Flux (tenant key — free tier)
 *
 * Returns base64 image data — auto-uploads to Payload Media if requested.
 *
 * @param tenantOpenRouterKey — DEPRECATED: use tenantAiConfig instead (kept for backward compat)
 */
export async function generateImage(
  options: ImageGenerationOptions,
  payload?: Payload,
  tenantOpenRouterKey?: string,
  tenantAiConfig?: TenantAiConfig,
): Promise<ImageGenerationResult> {
  const enhancedPrompt = enhancePromptForProduct(options.prompt, options.enhancementContext)

  // Build effective config (merge legacy param into config)
  const effectiveConfig: TenantAiConfig = {
    ...tenantAiConfig,
    ...(tenantOpenRouterKey && !tenantAiConfig?.openrouterApiKey
      ? { openrouterApiKey: tenantOpenRouterKey }
      : {}),
  }

  // Reference-image (image-to-image) requests need a model that accepts image
  // input (Gemini via OpenRouter). Route those directly to that path.
  if (options.inputImages?.length) {
    const orProvider = resolveImageProviderChain(effectiveConfig).find(
      (c) => c.provider === 'openrouter' || c.provider === 'google',
    )
    const orKey = effectiveConfig.openrouterApiKey || process.env.OPENROUTER_API_KEY || orProvider?.apiKey
    if (orKey) {
      const imgModel = options.model || 'google/gemini-3-pro-image-preview'
      return generateViaOpenRouter(enhancedPrompt, orKey, options, payload, imgModel)
    }
    console.warn('[ImageGeneration] Reference images provided but no OpenRouter/Google key — generating from text only.')
  }

  // Fail-soft / fail-up: walk the provider chain, skipping any whose circuit is
  // open (cooling down after a recent failure) so we never hammer a rate-limited
  // or down provider. The real calls ARE the health signal — a failure opens that
  // provider's circuit for an exponentially-backing-off cooldown and we fail up to
  // the next; a success closes it. No separate health-check traffic.
  const chain = resolveImageProviderChain(effectiveConfig)
  if (chain.length === 0) {
    return { success: false, error: 'Image generation unavailable — no AI provider keys configured.' }
  }

  let lastError = 'Image generation failed.'
  let anyTried = false
  for (const resolved of chain) {
    // Namespace the circuit per-purpose: image-gen quota is separate from the
    // vision/analysis quota, so an image 429 on Google shouldn't skip Gemini
    // vision (and vice-versa). Shares the ONE providerHealth breaker + CIC panel.
    const key = `image:${resolved.provider}`
    if (isDown(key)) continue
    anyTried = true
    console.log(`[ImageGeneration] Trying provider: ${resolved.provider}`)
    const result = await runImageProvider(resolved, enhancedPrompt, options, payload)
    if (result.success) {
      recordSuccess(key)
      return result
    }
    lastError = result.error || lastError
    // A content-policy / bad-prompt failure fails on EVERY provider — don't burn
    // the chain or mark the provider down over it; return it as-is.
    if (!isFatalProviderError(result.error || '')) return result
    markDown(key, result.error || 'image generation failed', 5 * 60 * 1000)
    console.warn(`[ImageGeneration] ${resolved.provider} unhealthy — failing up. (${result.error})`)
  }

  return {
    success: false,
    error: anyTried
      ? lastError
      : 'All image providers are cooling down after recent failures — please try again shortly.',
  }
}

/** Dispatch a single resolved provider to its generation function. */
function runImageProvider(
  resolved: ResolvedImageProvider,
  prompt: string,
  options: ImageGenerationOptions,
  payload?: Payload,
): Promise<ImageGenerationResult> {
  switch (resolved.provider) {
    case 'gateway':
      return generateViaGateway(prompt, options, payload)
    case 'openai':
      return generateViaOpenAI(prompt, resolved.apiKey, options, payload)
    case 'cloudflare':
      return generateViaCloudflare(prompt, resolved.apiKey, resolved.accountId!, options, payload)
    case 'google':
      // NATIVE Gemini image gen (generativelanguage generateContent). A Google AI
      // key is NOT an OpenRouter key, so the old OpenRouter route could never work
      // with a `google` provider — this calls Google directly.
      return generateViaGemini(prompt, resolved.apiKey, options, payload)
    case 'openrouter':
    default:
      return generateViaOpenRouter(prompt, resolved.apiKey, options, payload)
  }
}

// ---------------------------------------------------------------------------
// Native Google Gemini image generation (generativelanguage generateContent)
// ---------------------------------------------------------------------------

/** Gemini image models that emit inline image parts, in fallback order. */
const GEMINI_IMAGE_MODELS = ['gemini-2.5-flash-image', 'gemini-3-pro-image', 'gemini-3.1-flash-image']

/**
 * Generate an image via Google's Gemini API directly (not OpenRouter). Uses
 * generateContent with responseModalities:['IMAGE','TEXT'] and extracts the
 * inline base64 image part. Tries the configured model then falls back through
 * GEMINI_IMAGE_MODELS on a 404 (model not available to this key).
 */
async function generateViaGemini(
  prompt: string,
  apiKey: string,
  options: ImageGenerationOptions,
  payload?: Payload,
): Promise<ImageGenerationResult> {
  const models = options.model
    ? [options.model, ...GEMINI_IMAGE_MODELS.filter((m) => m !== options.model)]
    : [process.env.GEMINI_IMAGE_MODEL || GEMINI_IMAGE_MODELS[0], ...GEMINI_IMAGE_MODELS]
  const tried = new Set<string>()
  let lastError = 'Gemini image generation failed.'

  for (const model of models) {
    if (tried.has(model)) continue
    tried.add(model)
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
          }),
          signal: AbortSignal.timeout(120_000),
        },
      )

      if (!res.ok) {
        const body = await res.text()
        lastError = `Gemini image failed (HTTP ${res.status}).`
        // 404 = this model isn't available to the key → try the next model.
        // 429/5xx = provider health → bubble up so the breaker/chain fails up.
        if (res.status === 404) {
          console.warn(`[ImageGeneration] Gemini ${model} unavailable (404) — trying next model.`)
          continue
        }
        console.error('[ImageGeneration] Gemini error:', res.status, body.slice(0, 200))
        return { success: false, error: `${lastError} ${body.slice(0, 120)}` }
      }

      const data = await res.json()
      const parts = data?.candidates?.[0]?.content?.parts ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inline = parts.find((p: any) => p?.inlineData || p?.inline_data)
      const blob = inline?.inlineData || inline?.inline_data
      if (!blob?.data) {
        lastError = 'Gemini returned text but no image part.'
        continue
      }
      const mime = blob.mimeType || blob.mime_type || 'image/png'
      const imageDataUrl = `data:${mime};base64,${blob.data}`

      const result: ImageGenerationResult = { success: true, imageDataUrl, modelUsed: `google/${model}` }
      if (options.autoUpload && payload) {
        await tryUploadToMedia(result, imageDataUrl, options, payload)
      }
      return result
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      console.error('[ImageGeneration] Gemini exception:', lastError)
      // Network/timeout — provider health; stop and let the chain fail up.
      return { success: false, error: `Gemini image generation failed: ${lastError}` }
    }
  }

  return { success: false, error: lastError }
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
      // Image generation can take 30-60s — allow up to 120s before aborting
      abortSignal: AbortSignal.timeout(120_000),
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

  // Reference images → send a multimodal content array (text + image parts) so the
  // model conditions on them (image-to-image / subject-consistent edit). Without
  // references, keep the simple string content.
  const refs = (options.inputImages || []).filter((u) => typeof u === 'string' && u.length > 0)
  const content: unknown = refs.length
    ? [
        { type: 'text', text: prompt },
        ...refs.map((url) => ({ type: 'image_url', image_url: { url } })),
      ]
    : prompt

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
            content,
          },
        ],
        modalities: ['image', 'text'],
      }),
      // Image generation can take 30-60s — allow up to 120s before aborting
      signal: AbortSignal.timeout(120_000),
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

// ---------------------------------------------------------------------------
// OpenAI DALL-E Generation (Sprint 44)
// ---------------------------------------------------------------------------

const OPENAI_IMAGE_URL = 'https://api.openai.com/v1/images/generations'

/**
 * Generate an image via OpenAI DALL-E API.
 */
async function generateViaOpenAI(
  prompt: string,
  apiKey: string,
  options: ImageGenerationOptions,
  payload?: Payload,
): Promise<ImageGenerationResult> {
  try {
    const response = await fetch(OPENAI_IMAGE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[ImageGeneration] OpenAI DALL-E error:', response.status, errorBody)

      if (response.status === 400 && errorBody.includes('content_policy')) {
        return {
          success: false,
          error: 'The image prompt was flagged by content policy. Please try a different description.',
        }
      }

      return { success: false, error: `OpenAI DALL-E failed (HTTP ${response.status}).` }
    }

    const data = await response.json()
    const b64 = data?.data?.[0]?.b64_json

    if (!b64) {
      return { success: false, error: 'OpenAI DALL-E returned no image data.' }
    }

    const imageDataUrl = `data:image/png;base64,${b64}`
    const result: ImageGenerationResult = {
      success: true,
      imageDataUrl,
      modelUsed: 'openai/dall-e-3',
    }

    if (options.autoUpload && payload) {
      await tryUploadToMedia(result, imageDataUrl, options, payload)
    }

    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[ImageGeneration] OpenAI error:', msg)
    return { success: false, error: `OpenAI DALL-E failed: ${msg}` }
  }
}

// ---------------------------------------------------------------------------
// Cloudflare Workers AI Flux Generation (Sprint 44)
// ---------------------------------------------------------------------------

/**
 * Generate an image via Cloudflare Workers AI (Flux model — free tier).
 *
 * @see https://developers.cloudflare.com/workers-ai/models/flux-1-schnell/
 */
async function generateViaCloudflare(
  prompt: string,
  apiToken: string,
  accountId: string,
  options: ImageGenerationOptions,
  payload?: Payload,
): Promise<ImageGenerationResult> {
  // LOWERCASE, and no dot. `@cf/black-forest-labs/FLUX.1-schnell` — the id in
  // Cloudflare's own docs page title — returns 7000 "No route for that URI",
  // which reads like a broken account or a dead token rather than a typo.
  // `…/ai/models/search?task=Text-to-Image` lists what the account can actually
  // reach; check there before believing any model id. FOOTGUNS §2.5.
  const model = options.model || '@cf/black-forest-labs/flux-1-schnell'
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        num_steps: 8,
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!response.ok) {
      const errorBody = await response.text()
      console.error('[ImageGeneration] Cloudflare AI error:', response.status, errorBody)
      // Carry Cloudflare's own words through. A bare "HTTP 400" tells the model
      // nothing, so it invents a cause — "rate limit" for what was actually
      // 7000 "No route for that URI", i.e. a model id that no longer exists.
      return {
        success: false,
        error: `Cloudflare Workers AI failed (HTTP ${response.status}): ${errorBody.slice(0, 300)}`,
      }
    }

    // Flux answers `{"result":{"image":"<base64 JPEG>"}}` — NOT the raw PNG bytes
    // this used to assume. Reading it as an arrayBuffer base64-encodes the JSON
    // envelope and labels it image/png, so the fix for the model id above would
    // have produced a corrupt data URL and looked like a second, unrelated bug.
    // Branch on what the response says it is; Cloudflare has changed this once.
    const contentType = response.headers.get('content-type') || ''
    let imageDataUrl: string
    if (contentType.includes('application/json')) {
      const body = (await response.json()) as { result?: { image?: string } }
      const b64 = body?.result?.image
      if (!b64) return { success: false, error: 'Cloudflare Workers AI returned no image.' }
      // JPEG magic in base64 is "/9j/"; anything else from this endpoint is PNG.
      const mime = b64.startsWith('/9j/') ? 'image/jpeg' : 'image/png'
      imageDataUrl = `data:${mime};base64,${b64}`
    } else {
      const arrayBuffer = await response.arrayBuffer()
      imageDataUrl = `data:image/png;base64,${Buffer.from(arrayBuffer).toString('base64')}`
    }

    const result: ImageGenerationResult = {
      success: true,
      imageDataUrl,
      modelUsed: `cloudflare/${model}`,
    }

    if (options.autoUpload && payload) {
      await tryUploadToMedia(result, imageDataUrl, options, payload)
    }

    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    console.error('[ImageGeneration] Cloudflare error:', msg)
    return { success: false, error: `Cloudflare Workers AI failed: ${msg}` }
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
  options?: { collection?: string; documentId?: number; tenantId?: number },
): Promise<{ success: boolean; updatedDocuments: number; error?: string }> {
  let updatedCount = 0

  // Build tenant filter for multi-tenant isolation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenantFilter: Record<string, any> = options?.tenantId
    ? { tenant: { equals: options.tenantId } }
    : {}

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
        // Tenant isolation — verify document belongs to this tenant
        if (options?.tenantId) {
          const docTenant = (doc as any)?.tenant
          const tenantVal = typeof docTenant === 'object' ? docTenant?.id : docTenant
          if (tenantVal && tenantVal !== options.tenantId) {
            return { success: false, updatedDocuments: 0, error: 'Document belongs to a different tenant.' }
          }
        }

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

    // Otherwise, search and replace across products, posts, pages
    // (skip 'tenants' — tenant docs should not be modified by tenant LEO agents)
    for (const collection of ['products', 'posts', 'pages'] as const) {
      try {
        const results = await payload.find({
          collection,
          where: tenantFilter,
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
 * Checks all configured providers via resolveImageProvider().
 *
 * @param tenantOpenRouterKey — DEPRECATED: use tenantAiConfig instead
 */
export function isImageGenerationAvailable(
  tenantOpenRouterKey?: string,
  tenantAiConfig?: TenantAiConfig,
): boolean {
  const config: TenantAiConfig = {
    ...tenantAiConfig,
    ...(tenantOpenRouterKey && !tenantAiConfig?.openrouterApiKey
      ? { openrouterApiKey: tenantOpenRouterKey }
      : {}),
  }
  return resolveImageProvider(config) !== null
}
