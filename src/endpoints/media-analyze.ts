/**
 * Media Analyze Endpoint — POST /api/media-ops/analyze
 *
 * Triggers analysis of a specific media item. Can be called from:
 *   - Chat UI (user clicks "Analyze" on an image)
 *   - Leo tools (analyze_image, extract_pdf_pages)
 *   - Automated hooks (message afterChange)
 *   - Cron jobs (batch analysis of unprocessed media)
 *
 * Request body:
 *   { mediaId: number, inventoryMode?: boolean, customPrompt?: string }
 *
 * Response:
 *   { success, metaIds[], message }
 *
 * Authentication: requires session cookie (logged-in user)
 *
 * @see src/utilities/mediaAnalysis.ts — analysis engine
 */

import type { PayloadHandler } from 'payload'
import { buildMediaMeta } from '@/utilities/mediaAnalysis'
import { applyRateLimit } from '@/utilities/apiRateLimiter'

export const mediaAnalyzeHandler: PayloadHandler = async (req) => {
  // Auth check
  if (!req.user) {
    return Response.json({ success: false, error: 'Authentication required' }, { status: 401 })
  }

  const rateLimited = applyRateLimit(req, 'default')
  if (rateLimited) return rateLimited

  // Parse body
  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const mediaId = body.mediaId as number | string | undefined
  if (!mediaId) {
    return Response.json(
      { success: false, error: 'mediaId is required' },
      { status: 400 },
    )
  }

  // Fetch the media document
  let mediaDoc: Record<string, unknown>
  try {
    mediaDoc = (await req.payload.findByID({
      collection: 'media',
      id: mediaId,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch {
    return Response.json(
      { success: false, error: `Media ${mediaId} not found` },
      { status: 404 },
    )
  }

  // Resolve tenant
  const tenantId =
    typeof (mediaDoc as any).tenant === 'object'
      ? (mediaDoc as any).tenant?.id
      : (mediaDoc as any).tenant

  // Run analysis
  try {
    const result = await buildMediaMeta(req.payload, {
      mediaDoc,
      tenantId: tenantId ? Number(tenantId) : undefined,
      sourceMessageId: body.messageId as number | undefined,
      customPrompt: body.customPrompt as string | undefined,
      inventoryMode: Boolean(body.inventoryMode),
    })

    return Response.json({
      success: result.success,
      metaIds: result.metaIds,
      message: result.success
        ? `Analysis complete: ${result.metaIds.length} metadata record(s) created`
        : result.error,
    })
  } catch (err) {
    console.error('[MediaAnalyze] Error:', err)
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Analysis failed',
      },
      { status: 500 },
    )
  }
}
