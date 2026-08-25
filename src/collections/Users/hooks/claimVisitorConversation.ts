import type { CollectionAfterChangeHook } from 'payload'
import type { User } from '@/payload-types'

import { claimVisitorChannel } from '@/utilities/visitorChannels'
import { readVisitorId, visitorChannelSlug } from '@/utilities/visitorSession'

/**
 * Sign-up claims the conversation the visitor was already having.
 *
 * Somebody chats with LEO on the brochure site, likes what they hear, and makes
 * an account. Without this, the thread that convinced them to sign up is a
 * `visitor-<uuid>` channel nobody will ever look at, and their brand-new LEO DM
 * opens on an empty screen.
 *
 * A hook rather than a call site, for the same reason baselineMemberships is
 * one: there are six doors into a new user (password, Google, Discord, GitHub,
 * OTP, invite) and a per-endpoint call would silently skip four of them. The
 * cookie is on `req.headers` no matter which door it was.
 */
export const claimVisitorConversation: CollectionAfterChangeHook<User> = async ({
  doc,
  operation,
  req,
}) => {
  if (operation !== 'create' || doc.isSystemUser) return doc

  const visitorId = readVisitorId(req.headers)
  if (!visitorId) return doc

  try {
    const payload = req.payload

    // The visitor channel carries the tenant, which the new user row may not.
    const source = await payload.find({
      collection: 'channels',
      where: { slug: { equals: visitorChannelSlug(visitorId) } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const channel = source.docs?.[0]
    if (!channel) return doc

    const tenantId = typeof channel.tenant === 'object' ? channel.tenant?.id : channel.tenant
    if (!tenantId) return doc

    const { ensureDMSpace } = await import('@/utilities/ensureSystemSpace')
    const dmSpaceId = await ensureDMSpace(String(tenantId))
    if (!dmSpaceId) return doc

    const { findOrCreateDM } = await import('@/utilities/dmChannels')
    // `req` threaded: this runs inside the user-create transaction, and a DM
    // created on another connection cannot see the user row it must reference.
    const dm = await findOrCreateDM(tenantId, dmSpaceId, doc.id, 'leo', req)

    await claimVisitorChannel(payload, {
      visitorId,
      userId: doc.id,
      targetSlug: dm.channelSlug,
      targetChannelId: dm.channelId,
      req,
    })
  } catch (err) {
    // A failed claim costs them their pre-signup transcript. It must never cost
    // them the account they just created.
    console.warn('[claimVisitorConversation] claim failed:', err)
  }

  return doc
}
