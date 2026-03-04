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

  const tenantId = (doc as { tenant?: number }).tenant
  const spaceId = (doc as { space?: number }).space

  try {
    await runWorkflowsForMessage(req.payload, {
      id: doc.id,
      // UMS: content is now JSON — extract text for workflow processing
      content: extractTextFromContent((doc as { content?: unknown }).content),
      messageType: (doc as { messageType?: string }).messageType,
      attachments,
      channel: (doc as { channel?: string }).channel,
      space: spaceId,
    }, tenantId)
  } catch (err) {
    // Log but don't fail the message create
    req.payload.logger?.error?.({ err, msg: `runWorkflows failed for message ${doc.id}` })
  }

  return doc
}
