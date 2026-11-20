import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { deletePostTranscriptIndex, indexPostTranscripts } from '@/utilities/transcriptRag'

/**
 * Syncs `transcript` blocks inside a Post into `post_transcript_chunks`
 * (Postgres tsvector GIN + optional pgvector embeddings) on save/publish.
 *
 * Runs indexing asynchronously via `setImmediate` so it never blocks or
 * deadlocks Payload's outer `posts` row update transaction (which holds a lock
 * that conflicts with `post_transcript_chunks` foreign-key references under PgBouncer).
 */
export const indexTranscriptChunksAfterChange: CollectionAfterChangeHook = ({
  doc,
  previousDoc,
  req,
}) => {
  if (req.context?.disableTranscriptIndex) return doc

  setImmediate(async () => {
    try {
      await indexPostTranscripts(req.payload, doc, previousDoc)
    } catch (err) {
      req.payload.logger?.warn?.(
        { err, postId: doc?.id },
        '[transcriptRag] deferred post transcript indexing warning',
      )
    }
  })

  return doc
}

/**
 * Removes indexed transcript chunks when a Post is deleted.
 */
export const deleteTranscriptChunksAfterDelete: CollectionAfterDeleteHook = ({
  doc,
  req,
}) => {
  if (req.context?.disableTranscriptIndex) return doc
  if (doc?.id !== undefined && doc?.id !== null) {
    const postId = doc.id
    setImmediate(async () => {
      try {
        await deletePostTranscriptIndex(req.payload, postId)
      } catch (err) {
        req.payload.logger?.warn?.(
          { err, postId },
          '[transcriptRag] deferred delete post transcript chunks warning',
        )
      }
    })
  }
  return doc
}
