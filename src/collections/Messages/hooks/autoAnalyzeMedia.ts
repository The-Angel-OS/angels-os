/**
 * Auto-Analyze Media Hook — afterChange on Messages
 *
 * When a message with attachments is created, this hook queues analysis
 * for each attached media item. Analysis runs asynchronously (non-blocking)
 * so the message save completes immediately.
 *
 * The analysis creates MediaMeta records that progressively build the
 * tenant's knowledge base for RAG retrieval.
 *
 * Behavior:
 *   - Only triggers on 'create' operations
 *   - Only processes messages with attachments
 *   - Skips if ANTHROPIC_API_KEY is not set
 *   - Non-fatal: analysis failures don't affect message creation
 *   - Duplicate-safe: buildMediaMeta checks for existing analysis
 *
 * @see src/utilities/mediaAnalysis.ts — buildMediaMeta orchestrator
 * @see src/collections/MediaMeta/index.ts — storage collection
 */

import type { CollectionAfterChangeHook } from 'payload'

export const autoAnalyzeMedia: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  // Only analyze on new message creation
  if (operation !== 'create') return doc

  // Must have attachments
  const attachments = doc.attachments as
    | Array<{ media?: unknown; caption?: string }>
    | undefined
  if (!Array.isArray(attachments) || attachments.length === 0) return doc

  // Must have API key for analysis
  if (!process.env.ANTHROPIC_API_KEY) return doc

  // Resolve tenant ID
  const tenantId =
    typeof doc.tenant === 'object' && doc.tenant
      ? (doc.tenant as any).id
      : doc.tenant

  // Fire and forget — don't block message save
  // Use setImmediate to push analysis to the next tick
  setImmediate(async () => {
    try {
      const { buildMediaMeta } = await import('@/utilities/mediaAnalysis')

      for (const attachment of attachments) {
        const media = attachment.media
        if (!media || typeof media !== 'object') continue

        const mediaDoc = media as Record<string, unknown>

        try {
          await buildMediaMeta(req.payload, {
            mediaDoc,
            tenantId: tenantId ? Number(tenantId) : undefined,
            sourceMessageId: doc.id,
          })
        } catch (err) {
          console.warn(
            `[AutoAnalyze] Failed to analyze media ${mediaDoc.id} from message ${doc.id}:`,
            err instanceof Error ? err.message : err,
          )
        }
      }
    } catch (err) {
      console.warn('[AutoAnalyze] Hook error:', err instanceof Error ? err.message : err)
    }
  })

  return doc
}
