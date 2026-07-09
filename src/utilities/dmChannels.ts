import { ensureDMSpaceMembership } from './ensureSystemSpace'

// Lazy payload accessor — keeps @payload-config out of this module's top level to
// avoid the leo-data-tools ↔ payload.config import cycle (see fetchDefaultSpaceId).
async function getLocalPayload() {
  const { getPayload } = await import('payload')
  const { default: configPromise } = await import('@payload-config')
  return getPayload({ config: configPromise })
}

/**
 * Find or create a DM channel between two users in a tenant.
 *
 * Deterministic slug prevents duplicates:
 *   - Between two users: dm-{sortedId1}-{sortedId2}
 *   - For LEO DMs: dm-{userId}-leo
 *
 * The channel is created in the DMs system space with type: 'dm'.
 */
// AI agents you can DM. Each gets a deterministic dm-{userId}-{agent} channel with
// only the human as a member (the agent isn't a user row). 'leo' = the Guardian
// Angel brain; 'nimue' = the device client agent (the GuardianDelta surface).
const AGENTS = new Set(['leo', 'nimue'])

export async function findOrCreateDM(
  tenantId: number | string,
  dmSpaceId: number | string,
  userA: number | string,
  userB: number | string,
): Promise<{ channelId: string; channelSlug: string; isNew: boolean }> {
  const payload = await getLocalPayload()

  const agent = typeof userB === 'string' && AGENTS.has(userB) ? userB : null

  // Generate deterministic slug
  const parts = agent
    ? [String(userA), agent]
    : [String(userA), String(userB)].sort()
  const slug = `dm-${parts.join('-')}`

  // Look for existing channel(s) — fetch up to 5 to detect & clean duplicates
  const existing = await payload.find({
    collection: 'channels',
    where: {
      and: [
        { slug: { equals: slug } },
        { tenant: { equals: tenantId } },
        { type: { equals: 'dm' } },
      ],
    },
    limit: 5,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs?.length > 0) {
    // Keep the first (oldest/canonical) and delete any duplicates
    const canonical = existing.docs[0]
    if (existing.docs.length > 1) {
      console.warn(
        `[findOrCreateDM] Found ${existing.docs.length} duplicate channels for slug "${slug}" — cleaning up`,
      )
      for (let i = 1; i < existing.docs.length; i++) {
        try {
          await payload.delete({
            collection: 'channels',
            id: existing.docs[i].id,
            overrideAccess: true,
          })
        } catch {
          // Non-critical — dedup cleanup is best-effort
        }
      }
    }

    return {
      channelId: String(canonical.id),
      channelSlug: slug,
      isNew: false,
    }
  }

  // Determine display name
  const agentLabel = agent ? (agent === 'nimue' ? 'Nimue' : 'LEO') : null
  let displayName = 'Direct Message'
  if (agent) {
    // Fetch user name for the agent DM display
    try {
      const user = await payload.findByID({
        collection: 'users',
        id: userA,
        depth: 0,
        overrideAccess: true,
      })
      displayName = `${agentLabel} \u2194 ${(user as any).name || (user as any).email || 'User'}`
    } catch {
      displayName = `${agentLabel} DM`
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

  // Build members array (an agent isn't a user row — only the human is a member)
  const members = agent
    ? [Number(userA)]
    : [Number(userA), Number(userB)]

  // Create the DM channel — race-condition safe: if a concurrent request
  // already created a channel with this slug, re-query instead of failing.
  let channel: Awaited<ReturnType<typeof payload.create>>
  try {
    channel = await payload.create({
      collection: 'channels',
      data: {
        name: displayName,
        slug,
        description: agent ? `Conversation with ${agentLabel}` : 'Direct message',
        type: 'dm',
        space: Number(dmSpaceId),
        members,
        source: 'native',
        isDefault: false,
        tenant: Number(tenantId),
      } as any,
      overrideAccess: true,
    })
  } catch (createErr) {
    // If creation failed (likely due to race condition), re-query for the
    // channel that the other concurrent request created.
    const retry = await payload.find({
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

    if (retry.docs?.[0]) {
      return {
        channelId: String(retry.docs[0].id),
        channelSlug: slug,
        isNew: false,
      }
    }

    // If still nothing found, throw the original error
    throw createErr
  }

  // Ensure SpaceMembership for human users (an agent has no user row to add)
  await ensureDMSpaceMembership(userA, dmSpaceId, tenantId)
  if (!agent) {
    await ensureDMSpaceMembership(userB as number | string, dmSpaceId, tenantId)
  }

  return {
    channelId: String(channel.id),
    channelSlug: slug,
    isNew: true,
  }
}
