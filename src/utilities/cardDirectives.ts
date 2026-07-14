/**
 * Card directives — Core → a user's device (Nimue Card Stage).
 *
 * A "directive" is a message posted onto the user's Nimue DM channel carrying
 * `metadata.kind: 'card_directive'` and a `card` payload. Nimue's directive feed
 * (src/lib/cardFeeds.ts → makeDirectiveFeed) reads recent directives and
 * materializes them as cards on the breathing Delta — "continue your checkout,"
 * "your page is live," "your booking needs a time." Tapping the card opens the
 * URL back into the Core site.
 *
 * Why the DM channel (not a bespoke push): it rides the AI-Bus backbone we
 * already built. The directive is also a real message in the guardian thread, so
 * there's a durable record and the user can revisit it in chat. No new polling
 * surface, no device-token registry — the same (space, channel) the client
 * already streams.
 *
 * This is the mechanism half of the proactive guardian: the cortex (event-loop /
 * workflows / LEO) DECIDES what to surface; postCardDirective is how it reaches
 * the home screen. FAIL-SOFT: a directive must never break its trigger.
 */
import type { Payload } from 'payload'
import { findOrCreateDM } from './dmChannels'
import { ensureDMSpace } from './ensureSystemSpace'
import { wrapTextContent } from './messageContent'

/** A card the device should surface. Mirrors Nimue's Card shape (the fields a feed needs). */
export interface CardDirective {
  /** Short label above the title, e.g. "CONTINUE YOUR CHECKOUT". */
  eyebrow?: string
  title: string
  /** Body copy — also the in-thread message text. */
  body?: string
  /** Where the primary action goes (opened in the device browser into Core). */
  url?: string
  /** Primary action label (default "OPEN ▸"). */
  ctaLabel?: string
  /** Card kind hint for accent/priority on the device (default 'directive'). */
  cardKind?: 'directive' | 'link' | 'suggestion' | 'ceremony' | 'update'
  /** A stable key so re-posting the same directive REPLACES rather than stacks
   *  (e.g. `cart-${cartId}`). Absent → each post is its own card. */
  dedupeKey?: string
}

export interface PostCardDirectiveArgs extends CardDirective {
  /** The recipient user (their device shows the card). */
  userId: number | string
  /** Tenant context for the DM space. */
  tenantId: number | string
  /** Which device agent thread to post into (default 'nimue' — the device client). */
  agent?: 'nimue' | 'leo'
}

export interface PostCardDirectiveResult {
  ok: boolean
  messageId?: number | string
  channelId?: number | string
  channelSlug?: string
  error?: string
}

/** Resolve a system author (the tenant's LEO), falling back to user id 1. */
async function resolveDirectiveAuthor(payload: Payload, tenantId: number | string): Promise<number> {
  try {
    const leo = await payload.find({
      collection: 'users',
      where: {
        and: [{ servesTenant: { equals: tenantId } }, { 'agentConfig.agentType': { equals: 'leo' } }],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const id = leo.docs?.[0]?.id
    if (typeof id === 'number') return id
  } catch {
    /* fall through */
  }
  return 1
}

/**
 * Post a card directive to a user's device. Fail-soft — returns `{ ok:false }`
 * rather than throwing, so a caller in a hot path (a workflow, a hook) is never
 * broken by a delivery failure.
 */
export async function postCardDirective(
  payload: Payload,
  args: PostCardDirectiveArgs,
): Promise<PostCardDirectiveResult> {
  try {
    const { userId, tenantId, agent = 'nimue', title } = args
    if (!userId || !tenantId || !title?.trim()) {
      return { ok: false, error: 'userId, tenantId, and title are required' }
    }

    const dmSpaceId = await ensureDMSpace(String(tenantId))
    if (!dmSpaceId) return { ok: false, error: 'no DM space' }

    const dm = await findOrCreateDM(tenantId, dmSpaceId, userId, agent)
    const author = await resolveDirectiveAuthor(payload, tenantId)

    // In-thread text: a readable record of what the card said.
    const text = [`**${title.trim()}**`, args.body?.trim() ? `\n${args.body.trim()}` : '', args.url ? `\n${args.url}` : '']
      .filter(Boolean)
      .join('\n')

    const card: CardDirective = {
      title: title.trim(),
      ...(args.eyebrow ? { eyebrow: args.eyebrow } : {}),
      ...(args.body ? { body: args.body } : {}),
      ...(args.url ? { url: args.url } : {}),
      ...(args.ctaLabel ? { ctaLabel: args.ctaLabel } : {}),
      cardKind: args.cardKind || 'directive',
      ...(args.dedupeKey ? { dedupeKey: args.dedupeKey } : {}),
    }

    const msg = await payload.create({
      collection: 'messages',
      data: {
        content: wrapTextContent(text),
        space: Number(dmSpaceId),
        channel: dm.channelSlug,
        channelRef: Number(dm.channelId),
        messageType: 'system',
        author,
        tenant: Number(tenantId),
        visibility: 'tenant',
        metadata: {
          kind: 'card_directive',
          card,
          ...(args.dedupeKey ? { dedupeKey: args.dedupeKey } : {}),
        },
      } as never,
      overrideAccess: true,
    })

    return { ok: true, messageId: msg.id, channelId: dm.channelId, channelSlug: dm.channelSlug }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    payload.logger?.warn?.(`[cardDirectives] postCardDirective failed: ${error}`)
    return { ok: false, error }
  }
}
