/**
 * Auto-Analyze Upload Hook — afterChange on Media.
 *
 * Every newly uploaded asset is queued for metadata analysis (image vision / PDF
 * text) so it becomes DEEPLY SEARCHABLE later — the same MediaMeta + RAG pipeline
 * that chat attachments already feed, now triggered for ANY upload path
 * (dashboard uploader, Nimue camera, Merlin file bridge, provisioning), not only
 * media that happens to ride a message.
 *
 * Fire-and-forget (setImmediate) so the upload response never waits on analysis.
 * buildMediaMeta self-gates: it dedupes against existing analysis and routes by
 * type (images/PDFs analyzed, everything else skipped), so this is safe to call
 * for every create.
 *
 * @see src/utilities/mediaAnalysis.ts — buildMediaMeta orchestrator
 * @see src/collections/Messages/hooks/autoAnalyzeMedia.ts — the message-attachment twin
 */

import type { CollectionAfterChangeHook } from 'payload'

export const autoAnalyzeUpload: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc
  if (!process.env.ANTHROPIC_API_KEY) return doc

  const tenantId =
    typeof doc.tenant === 'object' && doc.tenant ? (doc.tenant as { id?: unknown }).id : doc.tenant

  // Push to the next tick so the upload response returns immediately.
  setImmediate(async () => {
    try {
      const { buildMediaMeta } = await import('@/utilities/mediaAnalysis')
      await buildMediaMeta(req.payload, {
        mediaDoc: doc as Record<string, unknown>,
        tenantId: tenantId ? Number(tenantId) : undefined,
      })
    } catch (err) {
      console.warn(
        `[AutoAnalyzeUpload] Failed to analyze media ${doc?.id}:`,
        err instanceof Error ? err.message : err,
      )
    }
  })

  return doc
}
