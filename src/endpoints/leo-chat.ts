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
 *   { message: string, conversationId?: string, channelSlug?: string }
 *
 * Response:
 *   { text: string, agentName: string, agentType: string, conversationId?: string }
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

  const { message, conversationId, channelSlug } = body

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

    return Response.json({
      text: result.text,
      response: result.text,
      agentName: result.agentName,
      agentType: result.agentType || 'leo',
      conversationId: result.conversationId,
      channelSlug: typeof channelSlug === 'string' ? channelSlug : undefined,
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
