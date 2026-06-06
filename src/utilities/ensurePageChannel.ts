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

export const PAGE_CHANNEL_PREFIX = 'page:'

/** Human label for a page channel — "Page: Home" / "Page: /learn/wdeg/3-…". */
export function pageChannelName(channel: string): string {
  const path = channel.slice(PAGE_CHANNEL_PREFIX.length) || '/'
  return path === '/' ? 'Page: Home' : `Page: ${path}`
}

export async function ensurePageChannel(
  payload: Payload,
  opts: { channel: string; spaceId: number | string; tenantId: number | string },
): Promise<void> {
  const { channel, spaceId, tenantId } = opts
  if (!channel.startsWith(PAGE_CHANNEL_PREFIX)) return

  const existing = await payload.find({
    collection: 'channels',
    where: { and: [{ slug: { equals: channel } }, { space: { equals: spaceId } }] },
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
      space: spaceId as number,
      type: 'social',
      tenant: tenantId as number,
    } as never,
    overrideAccess: true,
  })
}
