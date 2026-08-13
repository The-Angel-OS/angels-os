import type { CollectionAfterChangeHook } from 'payload'
import { runWorkflowsForMessage } from '@/utilities/workflowRunner'
import { extractTextFromContent } from '@/utilities/messageContent'

/**
 * After a message is created, run any matching channel workflows (e.g. inventory_from_image).
 * Handles UMS JSON content via extractTextFromContent.
 */
export const runWorkflows: CollectionAfterChangeHook = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create') return doc

  const attachments = (doc as { attachments?: Array<{ media: number | string }> }).attachments
  if (!attachments?.length) return doc

  // Passed through as-is: an afterChange doc carries `tenant` as a populated
  // OBJECT, and runWorkflowsForMessage normalizes it. Coercing here instead
  // would only move the same mistake one file over.
  const tenantId = (doc as { tenant?: unknown }).tenant as never
  const spaceId = (doc as { space?: number }).space

  try {
    await runWorkflowsForMessage(
      req.payload,
      {
        id: doc.id,
        // UMS: content is now JSON — extract text for workflow processing
        content: extractTextFromContent((doc as { content?: unknown }).content),
        messageType: (doc as { messageType?: string }).messageType,
        attachments,
        channel: (doc as { channel?: string }).channel,
        space: spaceId,
      },
      tenantId,
      // The product draft this can create is a nested write inside the message's
      // transaction — without req it lands on a second connection and blocks on
      // the still-uncommitted parent.
      { req },
    )
  } catch (err) {
    // Log but don't fail the message create
    req.payload.logger?.error?.({ err, msg: `runWorkflows failed for message ${doc.id}` })
  }

  return doc
}
