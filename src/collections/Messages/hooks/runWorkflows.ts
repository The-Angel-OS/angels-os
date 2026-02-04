import type { CollectionAfterChangeHook } from 'payload'
import { runWorkflowsForMessage } from '@/utilities/workflowRunner'

/**
 * After a message is created, run any matching channel workflows (e.g. inventory_from_image).
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
      content: (doc as { content?: string }).content ?? '',
      messageType: (doc as { messageType?: string }).messageType,
      attachments,
      channel: (doc as { channel?: string }).channel,
      space: spaceId,
    }, tenantId)
  } catch {
    // Log but don't fail the message create
  }

  return doc
}
