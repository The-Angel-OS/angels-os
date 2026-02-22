import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { ensureDMSpaceMembership } from './ensureSystemSpace'

/**
 * Find or create a DM channel between two users in a tenant.
 *
 * Deterministic slug prevents duplicates:
 *   - Between two users: dm-{sortedId1}-{sortedId2}
 *   - For LEO DMs: dm-{userId}-leo
 *
 * The channel is created in the DMs system space with type: 'dm'.
 */
export async function findOrCreateDM(
  tenantId: number | string,
  dmSpaceId: number | string,
  userA: number | string,
  userB: number | string | 'leo',
): Promise<{ channelId: string; channelSlug: string; isNew: boolean }> {
  const payload = await getPayload({ config: configPromise })

  // Generate deterministic slug
  const parts =
    userB === 'leo'
      ? [String(userA), 'leo']
      : [String(userA), String(userB)].sort()
  const slug = `dm-${parts.join('-')}`

  // Look for existing channel
  const existing = await payload.find({
    collection: 'channels',
    where: {
      and: [
        { slug: { equals: slug } },
        { tenant: { equals: tenantId } },
        { type: { equals: 'dm' } },
      ],
    },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs?.[0]) {
    return {
      channelId: String(existing.docs[0].id),
      channelSlug: slug,
      isNew: false,
    }
  }

  // Determine display name
  const isLeo = userB === 'leo'
  let displayName = 'Direct Message'
  if (isLeo) {
    // Fetch user name for LEO DM display
    try {
      const user = await payload.findByID({
        collection: 'users',
        id: userA,
        depth: 0,
        overrideAccess: true,
      })
      displayName = `LEO \u2194 ${(user as any).name || (user as any).email || 'User'}`
    } catch {
      displayName = 'LEO DM'
    }
  } else {
    // Fetch both user names
    try {
      const [uA, uB] = await Promise.all([
        payload.findByID({ collection: 'users', id: userA, depth: 0, overrideAccess: true }),
        payload.findByID({ collection: 'users', id: userB, depth: 0, overrideAccess: true }),
      ])
      const nameA = (uA as any).name || (uA as any).email || 'User'
      const nameB = (uB as any).name || (uB as any).email || 'User'
      displayName = `${nameA} \u2194 ${nameB}`
    } catch {
      displayName = 'Direct Message'
    }
  }

  // Build members array (LEO doesn't need a user record)
  const members = isLeo
    ? [Number(userA)]
    : [Number(userA), Number(userB)]

  // Create the DM channel
  const channel = await payload.create({
    collection: 'channels',
    data: {
      name: displayName,
      slug,
      description: isLeo ? 'Conversation with LEO AI assistant' : 'Direct message',
      type: 'dm',
      space: Number(dmSpaceId),
      members,
      source: 'native',
      isDefault: false,
      tenant: Number(tenantId),
    } as any,
    overrideAccess: true,
  })

  // Ensure SpaceMembership for human users
  await ensureDMSpaceMembership(userA, dmSpaceId, tenantId)
  if (!isLeo) {
    await ensureDMSpaceMembership(userB as number | string, dmSpaceId, tenantId)
  }

  return {
    channelId: String(channel.id),
    channelSlug: slug,
    isNew: true,
  }
}
