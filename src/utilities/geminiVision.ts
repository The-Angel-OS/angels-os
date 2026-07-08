/**
 * geminiVision.ts — Google Gemini vision, used as the cross-vendor fallback when
 * Anthropic vision is unavailable (credits/auth/quota). Gemini multimodal is
 * excellent at image description/OCR/tagging.
 *
 * Key: GOOGLE_AI_API_KEY (same env the ai-gateway already uses), or a per-tenant
 * aiConfig.googleAiApiKey passed in. Gemini needs inline image bytes — for a
 * remote URL we fetch + base64 it.
 */

const GEMINI_VISION_MODEL = process.env.GEMINI_VISION_MODEL || 'gemini-2.0-flash'

async function toInlineImage(imageUrl: string): Promise<{ mimeType: string; data: string }> {
  if (imageUrl.startsWith('data:')) {
    const [header, base64Data] = imageUrl.split(',')
    const mimeType = header?.match(/data:([^;]+)/)?.[1] || 'image/png'
    return { mimeType, data: base64Data }
  }
  const res = await fetch(imageUrl)
  if (!res.ok) throw new Error(`Gemini vision: could not fetch image (${res.status})`)
  const mimeType = res.headers.get('content-type') || 'image/jpeg'
  const buf = Buffer.from(await res.arrayBuffer())
  return { mimeType, data: buf.toString('base64') }
}

/**
 * Run a vision prompt against Gemini and return the raw model text (the caller
 * parses it — typically JSON). `expectJson` asks Gemini to emit clean JSON.
 * Single-image convenience — delegates to the multi-image path.
 */
export async function analyzeImageWithGemini(
  imageUrl: string,
  systemPrompt: string,
  userText = 'Analyze this image according to the system instructions.',
  opts: { apiKey?: string; expectJson?: boolean } = {},
): Promise<string> {
  return analyzeImagesWithGemini([imageUrl], systemPrompt, userText, opts)
}

/**
 * Multi-image vision against Gemini in a SINGLE call — the model sees all images
 * at once, so it can combine/merge them (stitch a timeline, dedupe an inventory
 * across shelf photos, etc.). Gemini takes many inline images per request; we
 * just add one inline_data part per image alongside the prompt.
 */
export async function analyzeImagesWithGemini(
  imageUrls: string[],
  systemPrompt: string,
  userText = 'Analyze these images according to the system instructions.',
  opts: { apiKey?: string; expectJson?: boolean } = {},
): Promise<string> {
  const apiKey = opts.apiKey || process.env.GOOGLE_AI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_AI_API_KEY not configured — Gemini vision unavailable.')
  if (!imageUrls.length) throw new Error('Gemini vision: no images provided.')

  const inlines = await Promise.all(imageUrls.map((u) => toInlineImage(u)))

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_VISION_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Gemini has no separate system role — prepend the instructions.
        contents: [
          {
            role: 'user',
            parts: [
              { text: `${systemPrompt}\n\n${userText}` },
              ...inlines.map((inline) => ({
                inline_data: { mime_type: inline.mimeType, data: inline.data },
              })),
            ],
          },
        ],
        generationConfig: {
          // More images → more to describe; give the combine room to breathe.
          maxOutputTokens: 4096,
          ...(opts.expectJson ? { responseMimeType: 'application/json' } : {}),
        },
      }),
    },
  )

  const data = (await res.json().catch(() => ({}))) as any
  if (!res.ok) {
    const detail = data?.error?.message || JSON.stringify(data).slice(0, 200)
    throw new Error(`Gemini vision ${res.status}: ${detail}`)
  }
  const text: string =
    data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('') || ''
  if (!text) throw new Error('Gemini vision returned no text')
  return text
}
