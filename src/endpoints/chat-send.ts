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
import { logError } from '@/utilities/logError'
import { buildBusMessageData } from '@/lib/busEnvelope'

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
  // Trusted system/node authors (e.g. a Merlin node posting a directory-listing
  // result whose JSON is embedded behind the bus sentinel) are machine output, not
  // human prose, and legitimately exceed the chat cap. Gate on the AUTHENTICATED
  // author being a system user — never the spoofable messageType field.
  const isSystemAuthor = Boolean((req.user as { isSystemUser?: boolean }).isSystemUser)
  const maxLen = isSystemAuthor ? 500_000 : MAX_MESSAGE_LENGTH
  if (typeof content === 'object' && content !== null) {
    const textContent = (content as Record<string, unknown>).text
    if (typeof textContent === 'string') {
      if (!textContent.trim() && !hasAttachments) {
        return Response.json({ message: 'Message content cannot be empty' }, { status: 400 })
      }
      if (textContent.length > maxLen) {
        return Response.json(
          { message: `Message too long (${textContent.length} chars). Maximum is ${maxLen}.` },
          { status: 400 },
        )
      }
    }
  } else if (typeof content === 'string') {
    if (!content.trim() && !hasAttachments) {
      return Response.json({ message: 'Message content cannot be empty' }, { status: 400 })
    }
    if (content.length > maxLen) {
      return Response.json(
        { message: `Message too long (${content.length} chars). Maximum is ${maxLen}.` },
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
    void logError({
      source: 'chat-send/resolveSpace',
      message: `Failed to resolve space ${spaceId}: ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
      statusCode: 404,
    })
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
    void logError({
      source: 'chat-send/verifyMembership',
      message: `Failed to verify space membership (space ${spaceId}): ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
      statusCode: 500,
      tenantId,
      userId: (req.user as { id: number }).id,
    })
    return Response.json({ message: 'Failed to verify access' }, { status: 500 })
  }

  // Create the message via local API — overrideAccess bypasses
  // the multi-tenant plugin's filterOptions validation on relationships
  try {
    // Build message data via the typed bus envelope — normalizes content to {text}
    // (robust to a bare string, which Payload's JSON field rejects → 500) and coerces
    // the space id. Attachments are linked in a SEPARATE phase (below), so allowEmpty
    // covers the image-only case (already validated above).
    const text =
      typeof content === 'string'
        ? content
        : content && typeof content === 'object'
          ? String((content as Record<string, unknown>).text ?? '')
          : ''
    const messageData = buildBusMessageData({
      space: spaceId as number | string, // validated at runtime by normalizeSpaceId
      channel,
      text,
      author: (req.user as { id: number }).id,
      tenant: tenantId as number | string,
      messageType: typeof messageType === 'string' ? messageType : 'user',
      allowEmpty: true,
    })

    // Validated attachments array (media IDs + optional captions) — NOT included
    // in the initial create. See the two-phase note below.
    const attachmentList =
      Array.isArray(attachments) && attachments.length > 0
        ? attachments.filter(
            (a: unknown) => a && typeof a === 'object' && 'media' in (a as Record<string, unknown>),
          )
        : []

    // ─── Two-phase write ─────────────────────────────────────────────────────
    // Phase 1: create the message WITHOUT attachments. This is identical to a
    // text message, so it ALWAYS persists. Critically, the attachment-gated
    // afterChange hooks (runWorkflows, autoAnalyzeMedia) only fire on a create
    // that already has attachments — by creating attachment-free, that heavier
    // hook chain never runs inside this create, which is what was rolling the
    // whole save back (image messages vanished while text persisted).
    const tCreate = Date.now()
    const saved = await req.payload.create({
      collection: 'messages',
      data: messageData as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      overrideAccess: true,
      req, // shared connection — see PASS_REQ_RULE.md
      depth: 0,
    })

    // Phase 2: link the media in a follow-up update, isolated in its own try/catch
    // so a media-relationship failure can NEVER roll back the (already-committed)
    // message. Worst case: the message persists with its caption, the image isn't
    // linked, and we log it — instead of the whole post vanishing.
    let attachedCount = 0
    if (attachmentList.length > 0) {
      // A media upload and the message-send that references it are SEPARATE
      // requests; a fast client (Nimue) can send the message before the upload's
      // row is committed/queryable. Payload validates the WHOLE attachments array,
      // so one not-yet-committed media makes the entire link fail ("The following
      // field is invalid: Attachments N > Media") — the image vanishes even though
      // the upload eventually lands. Fix: verify which media actually resolve
      // (with brief retries to absorb commit lag), link the ones that do, and drop
      // the rest with a warning instead of failing all of them.
      const attMediaId = (a: unknown): string | null => {
        const m = (a as { media?: unknown })?.media
        if (m == null) return null
        if (typeof m === 'object') {
          const id = (m as { id?: unknown }).id
          return id == null ? null : String(id)
        }
        return String(m)
      }
      const wantedIds = [...new Set(attachmentList.map(attMediaId).filter((v): v is string => v != null))]

      const findExisting = async (): Promise<Set<string>> => {
        if (!wantedIds.length) return new Set()
        try {
          const res = await req.payload.find({
            collection: 'media',
            where: { id: { in: wantedIds } },
            limit: wantedIds.length,
            depth: 0,
            overrideAccess: true,
            req,
          })
          return new Set((res.docs || []).map((d: { id: unknown }) => String(d.id)))
        } catch {
          return new Set()
        }
      }

      // Poll for commit lag: up to 3 rechecks, ~350ms apart (~1s worst case).
      let existing = await findExisting()
      for (let attempt = 0; attempt < 3 && existing.size < wantedIds.length; attempt++) {
        await new Promise((r) => setTimeout(r, 350))
        existing = await findExisting()
      }

      const validAttachments = attachmentList.filter((a) => {
        const id = attMediaId(a)
        return id != null && existing.has(id)
      })
      const droppedCount = attachmentList.length - validAttachments.length

      if (validAttachments.length > 0) {
        try {
          const withAtt = await req.payload.update({
            collection: 'messages',
            id: saved.id,
            data: { attachments: validAttachments } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
            overrideAccess: true,
            req,
            depth: 0,
          })
          attachedCount = Array.isArray((withAtt as { attachments?: unknown[] }).attachments)
            ? (withAtt as { attachments: unknown[] }).attachments.length
            : 0
        } catch (attErr) {
          // Non-fatal — message already persisted. Log so the failure is visible.
          await logError({
            source: 'chat-send/attach',
            message: `Failed to link ${validAttachments.length} attachment(s) to message ${saved.id}`,
            details: attErr instanceof Error ? attErr.stack || attErr.message : String(attErr),
            tenantId: tenantId != null ? String(tenantId) : undefined,
          }).catch(() => {})
        }
      }

      if (droppedCount > 0) {
        // Media never resolved (upload failed or still uncommitted after retries).
        // Warn, don't error — the message + any valid images were saved.
        await logError({
          level: 'warning',
          source: 'chat-send/attach',
          message: `Dropped ${droppedCount} attachment(s) on message ${saved.id} — media did not resolve`,
          details: `wanted media ids: ${wantedIds.join(', ')}; resolved: ${[...existing].join(', ') || 'none'}`,
          tenantId: tenantId != null ? String(tenantId) : undefined,
        }).catch(() => {})
      }
    }
    req.payload.logger?.info?.(
      `[chat-send] created message ${saved.id} in ${Date.now() - tCreate}ms attRecv=${attachmentList.length} attached=${attachedCount}`,
    )

    // Surface page-comment channels in the Spaces viewer (find-or-create,
    // non-blocking — never delays the send or fails it). The channel always
    // homes on the AI Bus, regardless of which space the comment was posted from.
    if (channel.startsWith('page:') && tenantId != null) {
      ensurePageChannel(req.payload, { channel, tenantId }).catch((e) => {
        console.warn('[chat-send] ensurePageChannel failed:', e instanceof Error ? e.message : e)
        void logError({
          source: 'chat-send/ensurePageChannel',
          level: 'warning',
          message: `Page-comment channel not created for ${channel}: ${e instanceof Error ? e.message : String(e)}`,
          details: e instanceof Error ? e.stack : String(e),
          tenantId,
        })
      })
    }

    return Response.json({ doc: saved }, { status: 201 })
  } catch (err) {
    console.error('[chat-send] Failed to create message:', err)
    void logError({
      source: 'chat-send/createMessage',
      message: `Failed to create message in #${channel} (space ${spaceId}): ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
      statusCode: 500,
      tenantId,
      userId: (req.user as { id: number }).id,
    })
    return Response.json(
      { message: 'Failed to create message', errors: [{ message: String(err) }] },
      { status: 500 },
    )
  }
}
