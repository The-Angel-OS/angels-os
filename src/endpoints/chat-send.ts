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
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
import { ensurePageChannel } from '@/utilities/ensurePageChannel'

export const chatSendHandler: PayloadHandler = async (req) => {
  // Require authenticated user (session cookie)
  if (!req.user) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit: 20 messages per minute per user
  const rateLimited = applyRateLimit(req, 'chat_send')
  if (rateLimited) return rateLimited

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

  // Validate content is not whitespace-only and enforce length limits.
  // Allow empty text when attachments are present (image-only messages).
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0
  const MAX_MESSAGE_LENGTH = 50_000 // 50K characters — generous but prevents abuse
  if (typeof content === 'object' && content !== null) {
    const textContent = (content as Record<string, unknown>).text
    if (typeof textContent === 'string') {
      if (!textContent.trim() && !hasAttachments) {
        return Response.json({ message: 'Message content cannot be empty' }, { status: 400 })
      }
      if (textContent.length > MAX_MESSAGE_LENGTH) {
        return Response.json(
          { message: `Message too long (${textContent.length} chars). Maximum is ${MAX_MESSAGE_LENGTH}.` },
          { status: 400 },
        )
      }
    }
  } else if (typeof content === 'string') {
    if (!content.trim() && !hasAttachments) {
      return Response.json({ message: 'Message content cannot be empty' }, { status: 400 })
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      return Response.json(
        { message: `Message too long (${content.length} chars). Maximum is ${MAX_MESSAGE_LENGTH}.` },
        { status: 400 },
      )
    }
  }

  const spaceId = typeof space === 'string' ? Number(space) || space : space

  // Look up the space to resolve its tenant + visibility
  let tenantId: number | string | undefined
  let spaceVisibility: string | undefined
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
    spaceVisibility = (spaceDoc as any).visibility
  } catch (err) {
    console.error('[chat-send] Failed to resolve space:', err)
    return Response.json({ message: `Space ${spaceId} not found` }, { status: 404 })
  }

  // Verify the user has access to this space (tenant isolation + membership)
  try {
    const userId = (req.user as { id: number }).id
    const membership = await req.payload.find({
      collection: 'space-memberships',
      where: {
        and: [
          { user: { equals: userId } },
          { space: { equals: spaceId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    // Allow if user has membership, or if user is a platform admin,
    // or if the space has public visibility (any authenticated user can post)
    const isAdmin = checkRole(ADMIN_ROLES, req.user)
    const isPublicSpace = spaceVisibility === 'public'

    if (!membership.docs?.length && !isAdmin && !isPublicSpace) {
      return Response.json({ message: 'You do not have access to this space' }, { status: 403 })
    }
  } catch (err) {
    console.error('[chat-send] Failed to verify space membership:', err)
    return Response.json({ message: 'Failed to verify access' }, { status: 500 })
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

    // Surface page-comment channels in the Spaces viewer (find-or-create,
    // non-blocking — never delays the send or fails it). The channel always
    // homes on the AI Bus, regardless of which space the comment was posted from.
    if (channel.startsWith('page:') && tenantId != null) {
      ensurePageChannel(req.payload, { channel, tenantId }).catch((e) =>
        console.warn('[chat-send] ensurePageChannel failed:', e instanceof Error ? e.message : e),
      )
    }

    return Response.json({ doc: saved }, { status: 201 })
  } catch (err) {
    console.error('[chat-send] Failed to create message:', err)
    return Response.json(
      { message: 'Failed to create message', errors: [{ message: String(err) }] },
      { status: 500 },
    )
  }
}
