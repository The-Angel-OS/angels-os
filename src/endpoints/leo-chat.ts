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
import { logError } from '@/utilities/logError'
import {
  newVisitorId,
  readVisitorId,
  sanitizeBackfill,
  visitorChannelSlug,
  visitorCookieHeader,
} from '@/utilities/visitorSession'
import {
  backfillVisitorTurns,
  ensureVisitorChannel,
  persistVisitorMessage,
} from '@/utilities/visitorChannels'

/**
 * The tenant's LEO system user — the author on every LEO reply. Falls back to
 * the legacy email pattern, which some older tenants still carry. Two callers
 * now (visitor replies and signed-in replies), which is why it left the inline
 * branch it used to live in.
 */
async function resolveLeoUserId(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  tenantSlug: string | null | undefined,
): Promise<number | undefined> {
  if (!tenantSlug) return undefined
  for (const email of [leoSystemUserEmail(tenantSlug), leoLegacyEmail(tenantSlug)]) {
    try {
      const found = await payload.find({
        collection: 'users',
        where: { and: [{ email: { equals: email } }, { isSystemUser: { equals: true } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (found.docs?.[0]?.id) return found.docs[0].id as number
    } catch {
      // Try the next pattern.
    }
  }

  // ponytail: any system LEO rather than none. A visitor's widget sends no
  // x-tenant-id, so the slug we resolve is often a portal that never minted its
  // own LEO — and the reply then persisted with author_id NULL, leaving it
  // authorless in the portal owner's view. Every LEO renders as LEO; an author
  // row that exists beats a null. Drop this when every tenant mints one.
  try {
    const any = await payload.find({
      collection: 'users',
      where: { and: [{ isSystemUser: { equals: true } }, { email: { like: 'leo-%' } }] },
      limit: 1,
      sort: 'id',
      depth: 0,
      overrideAccess: true,
    })
    if (any.docs?.[0]?.id) return any.docs[0].id as number
  } catch {
    /* an authorless reply is still a reply */
  }
  return undefined
}

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
  // The client replays its transcript so the turns from before the channel
  // existed are not lost — see visitorSession.sanitizeBackfill.
  const backfill = sanitizeBackfill(body.history)

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

    // ─── Anonymous visitor session ──────────────────────────────────────────
    // LEO's memory comes from READING the Messages table. Guest turns were never
    // persisted, so every message was message one and "how much?" got a
    // non-sequitur. Persisting the conversation and giving LEO its memory back
    // are therefore the same change.
    let visitorId: string | null = null
    let setCookie: string | null = null
    let visitorChannel: Awaited<ReturnType<typeof ensureVisitorChannel>> = null
    let effectiveChannel = resolvedChannel
    let effectiveSpaceId = resolvedSpaceId

    if (isGuest) {
      visitorId = readVisitorId(req.headers) || newVisitorId()
      // Re-sent every turn so an active visitor's cookie slides forward rather
      // than expiring mid-conversation.
      setCookie = visitorCookieHeader(visitorId)

      // The channel is not created until the SECOND message: most first messages
      // are a bounce or a test, and this filters them almost perfectly. A
      // replayed transcript is what tells us this is not the first.
      if (tenantId && backfill.length > 0) {
        visitorChannel = await ensureVisitorChannel(req.payload, tenantId, visitorId)
        if (visitorChannel) {
          effectiveChannel = visitorChannel.channelSlug
          effectiveSpaceId = Number(visitorChannel.spaceId)
          if (visitorChannel.isNew) {
            await backfillVisitorTurns(req.payload, {
              channel: visitorChannel,
              tenantId,
              visitorId,
              turns: backfill,
              leoUserId: await resolveLeoUserId(req.payload, tenantSlug),
            })
          }
          // Persist the incoming turn BEFORE LEO answers, so the reply is
          // generated with it already in context.
          try {
            await persistVisitorMessage(req.payload, {
              channel: visitorChannel,
              tenantId,
              visitorId,
              text: message.trim(),
              role: 'user',
            })
          } catch {
            // A lost turn costs context, not the conversation.
          }
        }
      }
    }

    const result = await leoProcessMessage({
      message: message.trim(),
      conversationId: typeof conversationId === 'string' ? conversationId : undefined,
      tenantId,
      channelSlug: effectiveChannel,
      spaceId: effectiveSpaceId,
      payload: req.payload,
      userContext,
      pageContext: typeof pageContext === 'string' ? pageContext : undefined,
    })

    // A visitor's reply lands in their own channel; everyone else's in theirs.
    let savedMessageId: number | undefined
    if (visitorChannel && result.text && visitorId && tenantId) {
      try {
        await persistVisitorMessage(req.payload, {
          channel: visitorChannel,
          tenantId,
          visitorId,
          text: result.text,
          role: 'assistant',
          leoUserId: await resolveLeoUserId(req.payload, tenantSlug),
        })
      } catch (saveErr) {
        console.warn('[LEO Chat] Failed to persist visitor reply:', saveErr)
      }
    } else if (resolvedSpaceId && result.text && !isGuest) {
      try {
        const leoUserId = await resolveLeoUserId(req.payload, tenantSlug)

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
        // Non-critical — response still returned to client even if DB save fails,
        // but escalate so the self-improvement loop sees vanished LEO replies.
        console.warn('[LEO Chat] Failed to persist response:', saveErr)
        void logError({
          source: 'leo-chat/persistResponse',
          level: 'warning',
          message: `LEO reply not persisted: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`,
          details: saveErr instanceof Error ? saveErr.stack : String(saveErr),
          tenantId,
        })
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
      // So the widget can show the visitor which conversation is theirs, and so
      // sign-up can claim it.
      ...(visitorChannel ? { visitorChannelSlug: visitorChannel.channelSlug } : {}),
    }, setCookie ? { headers: { 'Set-Cookie': setCookie } } : undefined)
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error'
    console.error('[LEO Chat] Error processing message:', errMsg)
    void logError({
      source: 'leo-chat/process',
      message: `LEO failed to process message: ${errMsg}`,
      details: error instanceof Error ? error.stack : String(error),
      statusCode: 500,
      tenantId,
    })
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
