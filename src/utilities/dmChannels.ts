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

/** One channel's share of a DM-group merge (see mergeDmChannelGroup). */
export interface DmMergeReport {
  slug: string
  canonicalId: number | string
  canonicalSpaceId: number | string | undefined
  merged: Array<{ channelId: number | string; messagesMoved: number }>
  errors: string[]
}

/**
 * Merge duplicate DM channels (same deterministic slug) into ONE canonical
 * thread. DMs are the USER's — the slug encodes the participant pair, so two
 * rows with the same slug are the same conversation, whatever tenant/space
 * minted them (the pre-260713 findOrCreateDM was tenant-scoped, so every
 * portal minted its own dm-{u}-leo — nine per user in the wild).
 *
 * Canonical = the row with the most messages (tie → oldest). Every other
 * row's messages are REPOINTED (channelRef + space) onto the canonical before
 * the row is deleted — history is never orphaned. Members are unioned.
 */
export async function mergeDmChannelGroup(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  docs: any[],
  execute = true,
): Promise<DmMergeReport | null> {
  if (!docs?.length) return null
  const slug = String(docs[0].slug)

  // Message count per candidate — channelRef is the stable key post-fold.
  const counts = new Map<string, number>()
  for (const d of docs) {
    const n = await payload.count({
      collection: 'messages',
      where: { channelRef: { equals: d.id } },
      overrideAccess: true,
    })
    counts.set(String(d.id), n.totalDocs)
  }
  const sorted = [...docs].sort((a, b) => {
    const diff = (counts.get(String(b.id)) ?? 0) - (counts.get(String(a.id)) ?? 0)
    if (diff !== 0) return diff
    return new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime()
  })
  const canonical = sorted[0]
  const canonicalSpace =
    typeof canonical.space === 'object' ? canonical.space?.id : canonical.space

  const report: DmMergeReport = {
    slug,
    canonicalId: canonical.id,
    canonicalSpaceId: canonicalSpace,
    merged: [],
    errors: [],
  }

  const memberIds = new Set<number>(
    (canonical.members ?? []).map((m: unknown) =>
      Number(typeof m === 'object' && m !== null ? (m as { id: number }).id : m),
    ),
  )
  let membersGrew = false

  for (const dupe of sorted.slice(1)) {
    const dupeSpace = typeof dupe.space === 'object' ? dupe.space?.id : dupe.space
    try {
      let moved = counts.get(String(dupe.id)) ?? 0
      if (execute) {
        // Re-home the dupe's messages onto the canonical thread: stable ref +
        // space (clients still page history by (space, slug)).
        // ⚠️ Find ids first, then update by id: Payload's BULK update silently
        // matches NOTHING when the `where` keys on a relationship field
        // (channelRef) — find/count resolve it, update does not. Learned in
        // prod 260713: the first unify run deleted the channels but moved zero
        // messages (83 dangling refs, repaired by hand).
        const strayWhere = {
          and: [
            { space: { equals: dupeSpace } },
            { channel: { equals: slug } },
            { channelRef: { exists: false } },
          ],
        }
        const targets = await payload.find({
          collection: 'messages',
          where:
            dupeSpace != null && String(dupeSpace) !== String(canonicalSpace)
              ? { or: [{ channelRef: { equals: dupe.id } }, strayWhere] }
              : { channelRef: { equals: dupe.id } },
          limit: 0, // unlimited — every row must move before the channel dies
          depth: 0,
          select: { id: true } as never,
          overrideAccess: true,
        })
        const ids = (targets.docs as Array<{ id: number | string }>).map((m) => m.id)
        moved = 0
        for (const id of ids) {
          await payload.update({
            collection: 'messages',
            id,
            data: { channelRef: canonical.id, space: Number(canonicalSpace) } as never,
            depth: 0,
            overrideAccess: true,
          })
          moved++
        }
        for (const m of (dupe.members ?? []) as unknown[]) {
          const id = Number(typeof m === 'object' && m !== null ? (m as { id: number }).id : m)
          if (!memberIds.has(id)) {
            memberIds.add(id)
            membersGrew = true
          }
        }
        await payload.delete({ collection: 'channels', id: dupe.id, overrideAccess: true })
      }
      report.merged.push({ channelId: dupe.id, messagesMoved: moved })
    } catch (e) {
      report.errors.push(`channel ${dupe.id}: ${(e as Error).message}`)
    }
  }

  if (execute && membersGrew) {
    try {
      await payload.update({
        collection: 'channels',
        id: canonical.id,
        data: { members: [...memberIds] } as never,
        overrideAccess: true,
      })
    } catch (e) {
      report.errors.push(`member union: ${(e as Error).message}`)
    }
  }

  return report
}

export async function findOrCreateDM(
  tenantId: number | string,
  dmSpaceId: number | string,
  userA: number | string,
  userB: number | string,
  /**
   * Pass the caller's `req` when this runs inside someone else's transaction —
   * a hook, most of all. Without it the create goes out on a second connection
   * that cannot see the uncommitted row, and the members FK fails: signing up
   * threw `insert into channels_rels ... users_id` because user 166 did not
   * exist yet as far as that connection was concerned.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  req?: any,
): Promise<{ channelId: string; channelSlug: string; isNew: boolean }> {
  const payload = req?.payload ?? (await getLocalPayload())
  const tx = req ? { req } : {}

  const agent = typeof userB === 'string' && AGENTS.has(userB) ? userB : null

  // Generate deterministic slug
  const parts = agent
    ? [String(userA), agent]
    : [String(userA), String(userB)].sort()
  const slug = `dm-${parts.join('-')}`

  // Look for the existing channel GLOBALLY — a DM is the user's, not a
  // tenant's. The slug encodes the participant pair, so the same conversation
  // must resolve from every portal (tenant-scoped lookup was why each portal
  // minted its own dm-{u}-leo with a disjoint history).
  const existing = await payload.find({
    collection: 'channels',
    where: {
      and: [
        { slug: { equals: slug } },
        { type: { equals: 'dm' } },
      ],
    },
    limit: 25,
    depth: 0,
    overrideAccess: true,
  })

  if (existing.docs?.length > 0) {
    let canonical = existing.docs[0]
    if (existing.docs.length > 1) {
      // Legacy per-tenant duplicates — merge them (messages repointed, never
      // dropped) and carry on with the survivor.
      console.warn(
        `[findOrCreateDM] Found ${existing.docs.length} channels for slug "${slug}" — merging into one thread`,
      )
      const merged = await mergeDmChannelGroup(payload, existing.docs, true)
      if (merged) {
        canonical =
          existing.docs.find((d: { id: number | string }) => String(d.id) === String(merged.canonicalId)) ??
          canonical
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
      ...tx,
    })
  } catch (createErr) {
    // If creation failed (likely due to race condition), re-query for the
    // channel that the other concurrent request created — globally, same as
    // the primary lookup.
    const retry = await payload.find({
      collection: 'channels',
      where: {
        and: [
          { slug: { equals: slug } },
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
