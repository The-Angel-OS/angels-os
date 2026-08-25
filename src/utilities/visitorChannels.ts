/**
 * Visitor channels — create on the second message, claim on sign-up, expire at 30 days.
 *
 * See `visitorSession.ts` for the identity and policy half. This is the part
 * that touches the database.
 */
import { resolveAiBusSpaceId } from '@/utilities/ensureSystemSpace'
import { wrapTextContent } from '@/utilities/messageContent'
import {
  isVisitorChannelSlug,
  visitorChannelSlug,
  visitorLabel,
  type BackfillTurn,
} from '@/utilities/visitorSession'

/** Unclaimed visitor conversations are swept after this long. Ken's call, 260824. */
export const VISITOR_TTL_DAYS = 30

export interface VisitorChannel {
  channelId: number | string
  channelSlug: string
  spaceId: number | string
  isNew: boolean
}

/**
 * Find or create the channel for one visitor.
 *
 * An ORDINARY channel in the tenant's AI Bus space, not a DM: a DM's access
 * check is `members: { in: [user.id] }` and a visitor has no user row, so a
 * DM-shaped channel would be readable by nobody at all — the exact opposite of
 * "the portal owner should see their leads".
 */
export async function ensureVisitorChannel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  tenantId: number | string,
  visitorId: string,
): Promise<VisitorChannel | null> {
  const slug = visitorChannelSlug(visitorId)

  const existing = await payload.find({
    collection: 'channels',
    where: { slug: { equals: slug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs?.[0]) {
    const doc = existing.docs[0]
    return {
      channelId: doc.id,
      channelSlug: slug,
      spaceId: typeof doc.space === 'object' ? doc.space.id : doc.space,
      isNew: false,
    }
  }

  const spaceId = await resolveAiBusSpaceId(payload, tenantId)
  if (!spaceId) return null

  try {
    const channel = await payload.create({
      collection: 'channels',
      data: {
        name: visitorLabel(visitorId),
        slug,
        description: 'Website visitor conversation with LEO',
        // 'general' on purpose: 'sales' or 'support' would pull this into agent
        // routing rules the portal never configured for anonymous traffic.
        type: 'general',
        space: Number(spaceId),
        source: 'native',
        isDefault: false,
        tenant: Number(tenantId),
      },
      overrideAccess: true,
    })
    return { channelId: channel.id, channelSlug: slug, spaceId, isNew: true }
  } catch {
    // Two messages can land together on a cold start. Re-query rather than fail
    // — losing the conversation is worse than a duplicate attempt.
    const retry = await payload.find({
      collection: 'channels',
      where: { slug: { equals: slug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (!retry.docs?.[0]) return null
    const doc = retry.docs[0]
    return {
      channelId: doc.id,
      channelSlug: slug,
      spaceId: typeof doc.space === 'object' ? doc.space.id : doc.space,
      isNew: false,
    }
  }
}

/**
 * Write one visitor turn. `author` stays null — there is no user row yet — and
 * `metadata.visitorId` is what lets the claim find it later.
 */
export async function persistVisitorMessage(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  args: {
    channel: VisitorChannel
    tenantId: number | string
    visitorId: string
    text: string
    role: 'user' | 'assistant'
    leoUserId?: number | string
  },
): Promise<void> {
  const { channel, tenantId, visitorId, text, role, leoUserId } = args
  await payload.create({
    collection: 'messages',
    data: {
      content: wrapTextContent(text),
      space: Number(channel.spaceId),
      channel: channel.channelSlug,
      channelRef: Number(channel.channelId),
      messageType: role === 'assistant' ? 'ai_agent' : 'user',
      tenant: Number(tenantId),
      ...(role === 'assistant' && leoUserId ? { author: leoUserId } : {}),
      metadata: { visitorId, anonymous: role === 'user' },
    },
    overrideAccess: true,
  })
}

/**
 * Replay the turns that happened before the channel existed.
 *
 * The channel is not created until message two, so turn one lives only in the
 * client's React state — and turn one is precisely the context turn two needs.
 * Only ever called on a brand-new channel, so it cannot duplicate history.
 */
export async function backfillVisitorTurns(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  args: {
    channel: VisitorChannel
    tenantId: number | string
    visitorId: string
    turns: BackfillTurn[]
    leoUserId?: number | string
  },
): Promise<number> {
  let written = 0
  for (const turn of args.turns) {
    try {
      await persistVisitorMessage(payload, { ...args, text: turn.text, role: turn.role })
      written++
    } catch {
      // A backfill row is history, not the live turn. Losing one is a gap in the
      // transcript; failing the request would be a broken chat.
    }
  }
  return written
}

/**
 * Sign-up claims the conversation: the visitor's whole pre-account history moves
 * into their LEO DM, so they never lose the thing that made them sign up.
 *
 * ⚠️ Messages carry BOTH `channel` (slug string) and `channelRef` (relationship).
 * Anything that moves a message must rewrite both, or half the readers see it in
 * the old place. And a bulk `payload.update({ where })` on a RELATIONSHIP matches
 * NOTHING silently — find ids, then update by id. That bit mergeDmChannelGroup in
 * production once already.
 */
export async function claimVisitorChannel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: { visitorId: string; userId: number | string; targetSlug: string; targetChannelId: number | string; req?: any },
): Promise<{ moved: number } | null> {
  // Threaded when this runs inside the sign-up transaction; a write without it
  // goes out on a connection that cannot see the uncommitted user row.
  const tx = args.req ? { req: args.req } : {}
  const sourceSlug = visitorChannelSlug(args.visitorId)

  const source = await payload.find({
    collection: 'channels',
    where: { slug: { equals: sourceSlug } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (!source.docs?.[0]) return null

  const messages = await payload.find({
    collection: 'messages',
    where: { channel: { equals: sourceSlug } },
    limit: 1000,
    depth: 0,
    overrideAccess: true,
    sort: 'createdAt',
  })

  let moved = 0
  for (const msg of messages.docs || []) {
    try {
      const isVisitorTurn = msg.messageType !== 'ai_agent'
      await payload.update({
        collection: 'messages',
        id: msg.id,
        data: {
          channel: args.targetSlug,
          channelRef: Number(args.targetChannelId),
          // The anonymous turns were theirs all along; attribute them now.
          ...(isVisitorTurn ? { author: args.userId } : {}),
        },
        overrideAccess: true,
        ...tx,
      })
      moved++
    } catch {
      // Keep going: a partly-claimed thread beats an abandoned one.
    }
  }

  // The visitor channel has served its purpose. Verify by RE-QUERYING —
  // payload.delete does not throw on a per-doc failure, it resolves with an
  // `errors` array, and a channel reported deleted while still live is how
  // tenant 32 kept serving after its takedown (260820).
  try {
    await payload.delete({ collection: 'channels', id: source.docs[0].id, overrideAccess: true, ...tx })
    // ...on the SAME connection. Without `tx` this re-query reads outside the
    // caller's open transaction, still sees the pre-delete row, and warns about
    // a delete that worked perfectly.
    const check = await payload.find({
      collection: 'channels',
      where: { slug: { equals: sourceSlug } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      ...tx,
    })
    if (check.docs?.[0]) {
      console.warn(`[claimVisitorChannel] ${sourceSlug} survived its delete — left in place`)
    }
  } catch {
    // The messages already moved; an orphaned empty channel is cosmetic and the
    // TTL sweep will take it.
  }

  return { moved }
}

/**
 * Sweep unclaimed visitor conversations older than the TTL.
 *
 * Anonymous chat that persists is anonymous chat that accumulates — every bot,
 * every bored passer-by. Claimed conversations are already gone from here (they
 * moved into a real DM), so anything still carrying a `visitor-` slug after 30
 * days is by definition nobody's.
 */
export async function sweepExpiredVisitorChannels(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  opts: { days?: number; dryRun?: boolean } = {},
): Promise<{ scanned: number; deleted: number; messages: number }> {
  const days = opts.days ?? VISITOR_TTL_DAYS
  const cutoff = new Date(Date.now() - days * 86400_000).toISOString()

  const stale = await payload.find({
    collection: 'channels',
    where: { and: [{ slug: { like: 'visitor-' } }, { updatedAt: { less_than: cutoff } }] },
    limit: 500,
    depth: 0,
    overrideAccess: true,
  })

  let deleted = 0
  let messages = 0
  for (const channel of stale.docs || []) {
    // `like` is a substring match; only act on slugs that really are ours.
    if (!isVisitorChannelSlug(String(channel.slug))) continue
    if (opts.dryRun) {
      deleted++
      continue
    }
    try {
      const msgs = await payload.find({
        collection: 'messages',
        where: { channel: { equals: channel.slug } },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      })
      for (const m of msgs.docs || []) {
        await payload.delete({ collection: 'messages', id: m.id, overrideAccess: true })
        messages++
      }
      await payload.delete({ collection: 'channels', id: channel.id, overrideAccess: true })
      deleted++
    } catch {
      // Next sweep tries again.
    }
  }

  return { scanned: stale.docs?.length || 0, deleted, messages }
}
