import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { deletePostTranscriptIndex, indexPostTranscripts } from '@/utilities/transcriptRag'

/**
 * Syncs `transcript` blocks inside a Post into `post_transcript_chunks`
 * (Postgres tsvector GIN + optional pgvector embeddings) on save/publish.
 */
export const indexTranscriptChunksAfterChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  req,
}) => {
  if (req.context?.disableTranscriptIndex) return doc
  await indexPostTranscripts(req.payload, doc, previousDoc)
  return doc
}

/**
 * Removes indexed transcript chunks when a Post is deleted.
 */
export const deleteTranscriptChunksAfterDelete: CollectionAfterDeleteHook = async ({
  doc,
  req,
}) => {
  if (req.context?.disableTranscriptIndex) return doc
  if (doc?.id !== undefined && doc?.id !== null) {
    await deletePostTranscriptIndex(req.payload, doc.id)
  }
  return doc
}
