/**
 * LEO Chat Endpoint — POST /api/leo
 *
 * Handles browser-based chat messages from authenticated users AND guests.
 * Uses standard Payload session/cookie auth, or guest mode via x-leo-guest header.
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

import { leoLegacyEmail, leoSystemUserEmail } from '@/utilities/leoEmail'
import { leoProcessMessage } from '@/utilities/leoProcessMessage'
import { wrapTextContent } from '@/utilities/messageContent'
import { applyRateLimit } from '@/utilities/apiRateLimiter'

export const leoChatHandler: PayloadHandler = async (req) => {
  const isGuest = !req.user
  const isGuestAllowed = req.headers.get('x-leo-guest') === 'true'

  // Allow guest access with stricter rate limiting, or require auth
  if (isGuest && !isGuestAllowed) {
    return Response.json({ message: 'Unauthorized' }, { status: 401 })
  }

  // Rate limit: 10/min for authenticated, 5/min for guests (IP-based)
  const rateLimited = applyRateLimit(req, isGuest ? 'leo_chat_guest' : 'leo_chat')
  if (rateLimited) return rateLimited

  // Parse request body
  let body: Record<string, unknown>
  try {
    body = (await (req as Request).json()) as Record<string, unknown>
  } catch {
    return Response.json({ message: 'Invalid JSON body' }, { status: 400 })
  }

  const { message, conversationId, channelSlug, spaceId, pageContext } = body

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
    const resolvedChannel = typeof channelSlug === 'string' ? channelSlug : 'general'
    const resolvedSpaceId = spaceId ? Number(spaceId) : undefined

    // Extract user context for LEO identity awareness
    // Guests get a minimal context with no persistence
    const user = req.user as unknown as Record<string, unknown> | undefined
    const userContext = user
      ? {
          id: user.id as number | string,
          name: (user.name as string) || undefined,
          email: (user.email as string) || undefined,
          roles: Array.isArray(user.roles) ? (user.roles as string[]) : undefined,
        }
      : {
          id: 'guest' as string | number,
          name: 'Guest',
          roles: [] as string[],
        }

    const result = await leoProcessMessage({
      message: message.trim(),
      conversationId: typeof conversationId === 'string' ? conversationId : undefined,
      tenantId,
      channelSlug: resolvedChannel,
      spaceId: resolvedSpaceId,
      payload: req.payload,
      userContext,
      pageContext: typeof pageContext === 'string' ? pageContext : undefined,
    })

    // Persist LEO's response to the Messages collection so it survives polling
    // Skip persistence for guest users — no message history for anonymous
    let savedMessageId: number | undefined
    if (resolvedSpaceId && result.text && !isGuest) {
      try {
        // Find the LEO system user for this tenant to use as author
        let leoUserId: number | undefined
        if (tenantSlug) {
          const leoEmail = leoSystemUserEmail(tenantSlug)
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
          // Fallback: try legacy email pattern during migration
          if (!leoUserId) {
            const legacyUsers = await req.payload.find({
              collection: 'users',
              where: { and: [{ email: { equals: leoLegacyEmail(tenantSlug) } }, { isSystemUser: { equals: true } }] },
              limit: 1, depth: 0, overrideAccess: true,
            })
            leoUserId = legacyUsers.docs?.[0]?.id
          }
        }

        const saved = await req.payload.create({
          collection: 'messages',
          data: {
            content: wrapTextContent(result.text),
            space: resolvedSpaceId,
            channel: resolvedChannel,
            messageType: 'ai_agent',
            // Pass tenant explicitly — same parity fix as leo-stream (2a04e36).
            // Relying solely on the setTenantFromSpace hook means the create throws
            // (reply vanishes) whenever that hook's space lookup fails on a flaky node.
            ...(tenantId ? { tenant: tenantId } : {}),
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
      isGuest,
      ...(isGuest ? { guestCta: 'Sign up for the full LEO experience — message history, personalized recommendations, and more.' } : {}),
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
