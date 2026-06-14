/**
 * versionOnEdit — capture the prior content every time a message's content changes.
 *
 * Runs on UPDATE only, when `content` actually differs. Records the superseded
 * version into metadata.revisions[] (append-only, tamper-resistant — rebuilt from
 * the stored doc, not the client). An edit by someone other than the original
 * author is flagged as a moderation act. See utilities/messageRevisions.
 */
import type { CollectionBeforeChangeHook } from 'payload'
import {
  appendRevision,
  contentsDiffer,
  type MessageRevision,
  type RevisionMeta,
} from '@/utilities/messageRevisions'

export const versionOnEdit: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  if (operation !== 'update' || !originalDoc) return data
  // Streaming finalize is NOT an edit: LEO pre-creates a message, streams chunks
  // into it, then writes the assembled content once. That final write must not
  // mark the message "(edited)". The streaming path passes this context flag.
  if (req?.context?.skipMessageVersioning) return data
  // Only when content is actually being changed.
  if (!('content' in data) || !contentsDiffer(data.content, originalDoc.content)) return data

  const prevMeta = (originalDoc.metadata && typeof originalDoc.metadata === 'object'
    ? originalDoc.metadata
    : {}) as RevisionMeta
  const prevRevisions = (Array.isArray(prevMeta.revisions) ? prevMeta.revisions : []) as MessageRevision[]

  // Preserve every existing metadata key (intent, conversationId, …) — a PATCH of
  // just { content } must not wipe the rest of metadata.
  const mergedIncoming: RevisionMeta = {
    ...prevMeta,
    ...((data.metadata && typeof data.metadata === 'object' ? data.metadata : {}) as RevisionMeta),
  }

  const editorId = (req?.user?.id as string | number | undefined) ?? null
  const originalAuthorId =
    originalDoc.author && typeof originalDoc.author === 'object'
      ? (originalDoc.author as { id: string | number }).id
      : (originalDoc.author as string | number | null | undefined) ?? null
  const moderation =
    editorId != null && originalAuthorId != null && String(editorId) !== String(originalAuthorId)

  data.metadata = appendRevision(mergedIncoming, prevRevisions, {
    previousContent: originalDoc.content,
    editedBy: editorId,
    moderation,
    now: new Date().toISOString(),
  })

  return data
}
