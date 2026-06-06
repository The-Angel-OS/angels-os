/**
 * Flag a page comment for moderation — POST /api/comment-ops/flag
 *
 * Any authenticated user can REPORT a message (page comments are messages on the
 * AI bus). Flagging is non-destructive: it sets metadata.flagged + moves the
 * message to `pending` so a moderator can review it (admin/comments, the
 * moderate_content tool, or LEO). Deletion is a separate, access-controlled
 * action (Payload REST DELETE /api/messages/:id — owner or admin only).
 */
import type { PayloadHandler } from 'payload'

export const commentFlagHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'auth required' }, { status: 401 })

  let body: { messageId?: string | number } = {}
  try {
    body = (await (req as unknown as Request).json()) as typeof body
  } catch {
    /* empty body */
  }
  const messageId = body.messageId
  if (!messageId) return Response.json({ error: 'messageId required' }, { status: 400 })

  try {
    const msg = (await payload.findByID({
      collection: 'messages',
      id: messageId,
      depth: 0,
      overrideAccess: true,
    })) as { metadata?: Record<string, unknown> } | null
    if (!msg) return Response.json({ error: 'not found' }, { status: 404 })

    const meta = msg.metadata && typeof msg.metadata === 'object' ? msg.metadata : {}
    await payload.update({
      collection: 'messages',
      id: messageId,
      data: {
        status: 'pending',
        metadata: { ...meta, flagged: true, flaggedBy: user.id, flaggedAt: new Date().toISOString() },
      } as never,
      overrideAccess: true,
    })
    return Response.json({ ok: true })
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : 'flag failed' }, { status: 500 })
  }
}
