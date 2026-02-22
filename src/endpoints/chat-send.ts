/**
 * Chat Send Endpoint — POST /api/chat/send
 *
 * Creates a user message in the Messages collection, bypassing the
 * multi-tenant plugin's relationship-field filterOptions validation
 * that blocks the plain REST API when the `payload-tenant` cookie
 * isn't set (common in the custom dashboard).
 *
 * Uses Payload's local API with `overrideAccess: true` so the tenant
 * is resolved server-side from the space — no cookie required.
 *
 * Request body:
 *   { space: number|string, channel: string, content: object, messageType?: string }
 *
 * Response:
 *   { doc: Message }   (201 on success)
 */

import type { PayloadHandler } from 'payload'

export const chatSendHandler: PayloadHandler = async (req) => {
  // Require authenticated user (session cookie)
  if (!req.user) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // Parse request body
  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const { space, channel, content, messageType, attachments } = body

  // Validate required fields
  if (!space) {
    return Response.json({ message: 'Missing required field: space' }, { status: 400 })
  }
  if (!channel || typeof channel !== 'string') {
    return Response.json({ message: 'Missing required field: channel' }, { status: 400 })
  }
  if (!content) {
    return Response.json({ message: 'Missing required field: content' }, { status: 400 })
  }

  const spaceId = typeof space === 'string' ? Number(space) || space : space

  // Look up the space to resolve its tenant
  let tenantId: number | string | undefined
  try {
    const spaceDoc = await req.payload.findByID({
      collection: 'spaces',
      id: spaceId as number,
      depth: 0,
      overrideAccess: true,
    })
    if (!spaceDoc) {
      return Response.json({ message: `Space ${spaceId} not found` }, { status: 404 })
    }
    tenantId =
      typeof spaceDoc.tenant === 'object' && spaceDoc.tenant !== null
        ? (spaceDoc.tenant as { id: number | string }).id
        : (spaceDoc.tenant as number | string)
  } catch (err) {
    console.error('[chat-send] Failed to resolve space:', err)
    return Response.json({ message: `Space ${spaceId} not found` }, { status: 404 })
  }

  // Create the message via local API — overrideAccess bypasses
  // the multi-tenant plugin's filterOptions validation on relationships
  try {
    // Build message data — include attachments if provided
    const messageData: Record<string, unknown> = {
      content,
      space: spaceId,
      channel,
      messageType: typeof messageType === 'string' ? messageType : 'user',
      author: (req.user as { id: number }).id,
      tenant: tenantId,
    }

    // Pass through validated attachments array (media IDs + optional captions)
    if (Array.isArray(attachments) && attachments.length > 0) {
      messageData.attachments = attachments.filter(
        (a: unknown) => a && typeof a === 'object' && 'media' in (a as Record<string, unknown>),
      )
    }

    const saved = await req.payload.create({
      collection: 'messages',
      data: messageData as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      overrideAccess: true,
    })

    return Response.json({ doc: saved }, { status: 201 })
  } catch (err) {
    console.error('[chat-send] Failed to create message:', err)
    return Response.json(
      { message: 'Failed to create message', errors: [{ message: String(err) }] },
      { status: 500 },
    )
  }
}
