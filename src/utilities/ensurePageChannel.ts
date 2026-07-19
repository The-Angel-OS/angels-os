/**
 * ensurePageChannel — surface page-comment channels in the Spaces viewer.
 *
 * Page comments are messages whose `channel` is `page:<path>` (set by
 * PageComments). The Spaces/Discord viewer lists Channel *documents*, and the
 * chat-send path never created one — so page conversations were invisible there.
 *
 * This find-or-creates a Channel whose slug EXACTLY equals the `page:` string
 * (so the viewer's `where[channel][equals]=` query loads the same messages),
 * with a readable name. Idempotent; cheap; bounded by actual commenting activity.
 */
import type { Payload } from 'payload'
import { resolveAiBusSpaceId } from './ensureSystemSpace'

export const PAGE_CHANNEL_PREFIX = 'page:'

/** Human label for a page channel — "Page: Home" / "Page: /learn/wdeg/3-…". */
export function pageChannelName(channel: string): string {
  const path = channel.slice(PAGE_CHANNEL_PREFIX.length) || '/'
  return path === '/' ? 'Page: Home' : `Page: ${path}`
}

/**
 * Find-or-create the Channel doc for a `page:<path>` conversation.
 *
 * Page-comment channels ALWAYS live on the tenant's AI Bus space — they are
 * automated/system surfaces, not human community channels. (Previously they were
 * created in whatever space the commenter posted from, so they leaked into the
 * Community Hub.) The channel home is resolved here, centrally — callers no
 * longer choose the space.
 */
export async function ensurePageChannel(
  payload: Payload,
  opts: { channel: string; tenantId: number | string },
): Promise<void> {
  const { channel, tenantId } = opts
  if (!channel.startsWith(PAGE_CHANNEL_PREFIX)) return

  const aiBusSpaceId = await resolveAiBusSpaceId(payload, tenantId)
  if (!aiBusSpaceId) return

  const existing = await payload.find({
    collection: 'channels',
    where: { and: [{ slug: { equals: channel } }, { space: { equals: aiBusSpaceId } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  if (existing.docs?.length) return

  await payload.create({
    collection: 'channels',
    data: {
      name: pageChannelName(channel),
      slug: channel, // MUST equal message.channel so the viewer loads these messages
      description: 'Comments left on this page (AI bus).',
      // Relationship ids MUST be Number — the multi-tenant filterOptions compares
      // in JS, so a string id fails "invalid: Space" (the `as number` cast above
      // was compile-time only; resolveAiBusSpaceId can return a string).
      space: Number(aiBusSpaceId),
      type: 'social',
      tenant: Number(tenantId),
    } as never,
    overrideAccess: true,
  })
}

/**
 * Re-home any page-comment channels that drifted onto the wrong space (e.g. the
 * Community Hub) back onto the AI Bus. Idempotent self-heal. Returns the count
 * moved. Used by the onboarding verifier + the backfill cron.
 */
export async function reparentPageChannelsToAiBus(
  payload: Payload,
  tenantId: number | string,
  aiBusSpaceId: number | string,
): Promise<number> {
  // Page channels carry slug `page:…`; `like` is a substring match so we filter
  // by the proper prefix below.
  const candidates = await payload.find({
    collection: 'channels',
    where: { and: [{ tenant: { equals: tenantId } }, { slug: { like: 'page:' } }] },
    limit: 2000,
    depth: 0,
    overrideAccess: true,
  })

  let moved = 0
  for (const ch of candidates.docs as Array<{ id: number | string; slug?: string; space?: unknown }>) {
    if (typeof ch.slug !== 'string' || !ch.slug.startsWith(PAGE_CHANNEL_PREFIX)) continue
    const currentSpace =
      ch.space && typeof ch.space === 'object' ? (ch.space as { id: number | string }).id : ch.space
    if (String(currentSpace) === String(aiBusSpaceId)) continue // already home
    try {
      // If an AI-Bus channel with this slug already exists, the drifted one is a
      // duplicate — delete it rather than create a slug collision on the Bus.
      const onBus = await payload.find({
        collection: 'channels',
        where: { and: [{ slug: { equals: ch.slug } }, { space: { equals: aiBusSpaceId } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      if (onBus.docs?.length) {
        await payload.delete({ collection: 'channels', id: ch.id, overrideAccess: true })
      } else {
        await payload.update({
          collection: 'channels',
          id: ch.id,
          data: { space: aiBusSpaceId as unknown as number } as never,
          overrideAccess: true,
        })
      }
      moved++
    } catch (e) {
      console.warn('[reparentPageChannels]', e instanceof Error ? e.message : e)
    }
  }
  return moved
}
