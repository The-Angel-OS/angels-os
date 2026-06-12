/**
 * setMediaField — generic "assign an image to an upload field on any doc".
 *
 * The factory primitive behind both the /provision-ops/set-media endpoint and
 * the LEO `set_media_field` tool. It answers one need that kept recurring as a
 * one-off SQL poke: "this Endeavor (or Page, or Tenant) has no logo/cover/OG
 * image — give it one." Works for ANY single `upload` field, addressed by a
 * dot-path (`logo`, `coverImage`, `meta.image`, `branding.logo`).
 *
 * The image can come from three sources, in order of cost:
 *   - mediaId    — an existing Media doc (cheapest; no upload)
 *   - imageUrl   — fetch the URL and upload it to Media (reuses uploadGeneratedImage)
 *   - generate   — AI-generate from a prompt, then upload (reuses generateImage)
 *
 * Nothing here is destructive: it only sets one FK column on one doc. It never
 * deletes media and never touches other fields (the nested-path merge preserves
 * sibling keys).
 */

import type { Payload } from 'payload'
import { generateImage, uploadGeneratedImage } from './imageGeneration'

/** Where the image comes from. Exactly one of these should be set. */
export type MediaSource = {
  /** Use an existing Media document by id. */
  mediaId?: number
  /** Fetch this URL and upload it to the Media collection. */
  imageUrl?: string
  /** AI-generate an image from this prompt, then upload it. */
  generate?: { prompt: string; model?: string }
}

export type SetMediaFieldArgs = {
  collection: string
  id: number | string
  /** Dot-path to a single `upload` field, e.g. 'logo', 'coverImage', 'meta.image'. */
  field: string
  source: MediaSource
  /** Tenant scope for new Media uploads + alt text. */
  tenantId?: number
  /** Alt text for newly uploaded/generated media. */
  alt?: string
}

export type SetMediaFieldResult = {
  success: boolean
  mediaId?: number
  /** How the mediaId was obtained: 'existing' | 'uploaded' | 'generated'. */
  via?: 'existing' | 'uploaded' | 'generated'
  error?: string
}

/**
 * Resolve a MediaSource to a concrete Media id, uploading or generating if needed.
 */
export async function resolveMediaSource(
  payload: Payload,
  source: MediaSource,
  opts: { tenantId?: number; alt?: string } = {},
): Promise<{ mediaId: number; via: 'existing' | 'uploaded' | 'generated' } | { error: string }> {
  // 1. Existing media id — verify it exists.
  if (source.mediaId != null) {
    const media = await payload
      .findByID({ collection: 'media', id: source.mediaId, depth: 0, overrideAccess: true })
      .catch(() => null)
    if (!media) return { error: `Media #${source.mediaId} not found.` }
    return { mediaId: Number(media.id), via: 'existing' }
  }

  // 2. Upload from a URL.
  if (source.imageUrl) {
    const res = await uploadGeneratedImage(payload, source.imageUrl, {
      alt: opts.alt || 'Uploaded image',
      tenantId: opts.tenantId,
    })
    if ('error' in res) return { error: res.error }
    return { mediaId: res.mediaId, via: 'uploaded' }
  }

  // 3. AI-generate then upload.
  if (source.generate?.prompt) {
    const gen = await generateImage(
      {
        prompt: source.generate.prompt,
        model: source.generate.model,
        autoUpload: true,
        tenantId: opts.tenantId,
        enhancementContext: opts.alt ? { productName: opts.alt } : undefined,
      },
      payload,
    )
    if (!gen.success || gen.mediaId == null) {
      return { error: gen.error || gen.uploadWarning || 'Image generation failed.' }
    }
    return { mediaId: gen.mediaId, via: 'generated' }
  }

  return { error: 'No media source provided — pass mediaId, imageUrl, or generate.prompt.' }
}

/**
 * Build a nested data object that sets a dot-path leaf to `value`, e.g.
 * setNested('meta.image', 5) => { meta: { image: 5 } }. Only the addressed
 * leaf is included, so Payload merges it without disturbing sibling fields.
 */
function buildNestedData(field: string, value: unknown): Record<string, unknown> {
  const parts = field.split('.').filter(Boolean)
  if (parts.length === 0) throw new Error('Empty field path')
  const root: Record<string, unknown> = {}
  let cursor = root
  for (let i = 0; i < parts.length - 1; i++) {
    cursor[parts[i]] = {}
    cursor = cursor[parts[i]] as Record<string, unknown>
  }
  cursor[parts[parts.length - 1]] = value
  return root
}

/**
 * Assign an image to a single upload field on a document. Resolves the source
 * (existing/uploaded/generated), then sets the field. Idempotent in effect:
 * re-running with the same source leaves the field pointing at the same media.
 */
export async function setMediaField(
  payload: Payload,
  args: SetMediaFieldArgs,
): Promise<SetMediaFieldResult> {
  const resolved = await resolveMediaSource(payload, args.source, {
    tenantId: args.tenantId,
    alt: args.alt,
  })
  if ('error' in resolved) return { success: false, error: resolved.error }

  try {
    await (payload.update as (a: unknown) => Promise<unknown>)({
      collection: args.collection,
      id: args.id,
      data: buildNestedData(args.field, resolved.mediaId),
      depth: 0,
      overrideAccess: true,
      overrideLock: true,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { success: false, mediaId: resolved.mediaId, via: resolved.via, error: msg }
  }

  return { success: true, mediaId: resolved.mediaId, via: resolved.via }
}
