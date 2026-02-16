/**
 * LEO Chat Endpoint — POST /api/leo
 *
 * Handles browser-based chat messages from authenticated users.
 * Uses standard Payload session/cookie auth (no Bearer token needed).
 *
 * This is the lightweight alternative to the MCP endpoint for
 * browser clients. External Angels (Merlin, etc.) use /api/mcp
 * with Bearer token auth via the MCP protocol.
 *
 * Request body:
 *   { message: string, spaceId?: number|string, conversationId?: string, channelSlug?: string }
 *
 * Response:
 *   { text: string, agentName: string, agentType: string, conversationId?: string, messageId?: number }
 */

import type { PayloadHandler } from 'payload'

import { leoProcessMessage } from '@/utilities/leoProcessMessage'

export const leoChatHandler: PayloadHandler = async (req) => {
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

  const { message, conversationId, channelSlug, spaceId } = body

  if (!message || typeof message !== 'string' || !message.trim()) {
    return Response.json({ message: 'Missing or empty: message' }, { status: 400 })
  }

  // Resolve tenant from host or x-tenant-id header
  let tenantId: number | undefined
  const tenantSlug =
    req.headers.get('x-tenant-id') || process.env.DEFAULT_TENANT_SLUG || 'default'

  if (tenantSlug) {
    try {
      const tenants = await req.payload.find({
        collection: 'tenants',
        where: { slug: { equals: tenantSlug } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      tenantId = tenants.docs?.[0]?.id
    } catch {
      // Non-critical — LEO can still respond without tenant context
    }
  }

  try {
    const result = await leoProcessMessage({
      message: message.trim(),
      conversationId: typeof conversationId === 'string' ? conversationId : undefined,
      tenantId,
      payload: req.payload,
    })

    const resolvedChannel = typeof channelSlug === 'string' ? channelSlug : 'general'
    const resolvedSpaceId = spaceId ? Number(spaceId) : undefined

    // Persist LEO's response to the Messages collection so it survives polling
    let savedMessageId: number | undefined
    if (resolvedSpaceId && result.text) {
      try {
        // Find the LEO system user for this tenant to use as author
        let leoUserId: number | undefined
        if (tenantSlug) {
          const leoEmail = `leo-${tenantSlug}@system.angelos.local`
          const leoUsers = await req.payload.find({
            collection: 'users',
            where: {
              and: [
                { email: { equals: leoEmail } },
                { isSystemUser: { equals: true } },
              ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
          })
          leoUserId = leoUsers.docs?.[0]?.id
        }

        const saved = await req.payload.create({
          collection: 'messages',
          data: {
            content: result.text,
            space: resolvedSpaceId,
            channel: resolvedChannel,
            messageType: 'ai_agent',
            ...(leoUserId ? { author: leoUserId } : {}),
          } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          overrideAccess: true,
        })
        savedMessageId = saved.id as number
      } catch (saveErr) {
        // Non-critical — response still returned to client even if DB save fails
        console.warn('[LEO Chat] Failed to persist response:', saveErr)
      }
    }

    return Response.json({
      text: result.text,
      response: result.text,
      agentName: result.agentName,
      agentType: result.agentType || 'leo',
      conversationId: result.conversationId,
      channelSlug: resolvedChannel,
      messageId: savedMessageId,
    })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[LEO Chat] Error processing message:', errMsg)
    return Response.json(
      {
        text: "I'm having trouble processing your message right now. Please try again.",
        agentName: 'LEO',
        agentType: 'leo',
        error: errMsg,
      },
      { status: 500 },
    )
  }
}
