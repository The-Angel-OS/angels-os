/**
 * Space Delete Endpoint — POST /api/space-ops/delete
 *
 * Deleting a space used to be `DELETE /api/spaces/:id` straight at Payload, and
 * it did exactly what the dialog warned: `Spaces.beforeDelete` cascades the
 * memberships, messages and channels before the row goes. (The FKs are all
 * ON DELETE SET NULL onto NOT NULL columns, so the cascade is not optional —
 * without it the delete fails outright. It is a real cascade, not an orphaning.)
 *
 * The problem was that destruction was the ONLY option. Three "Community"
 * spaces accumulate across separate provisionings and the way to end up with
 * one is to throw two of them away, messages included.
 *
 * So a delete now says where the contents go. Pick a destination space and the
 * channels move there; same-slug channels MERGE into the destination's
 * (Ken's 260813 call — three accidental "Community" spaces, each with its own
 * `general` and `announcements`, and the point is to end up with one of each).
 * Members come along so nobody silently loses access.
 *
 * GET  /api/space-ops/delete?spaceId=33&reassignTo=47  → the PLAN, changes nothing.
 * POST /api/space-ops/delete                           → executes it.
 *
 * The plan is the same code path as the execution, so the preview in the dialog
 * cannot drift from what actually happens.
 *
 * AUTHORIZATION: every write here runs with overrideAccess, so this endpoint
 * REPLACES Payload's `Spaces.delete` (adminOnly) rather than layering on it —
 * the bar has to be set here deliberately, and it has to be no lower. It is
 * `canManageSpaces` against the tenant that owns the space: super_admin, or
 * tenant_admin / tenant_manager / an explicit manage_spaces grant on that
 * tenant. A space_admin is NOT enough. The destination must belong to the same
 * tenant, and the AI Bus cannot be deleted at all.
 *
 * @see src/components/ChatControl/SpaceSettingsDialog.tsx — the chooser
 * @see src/collections/Spaces/index.ts — delete: adminOnly, and the cascade hook
 */
import type { PayloadHandler, PayloadRequest, Payload } from 'payload'
import { applyRateLimit } from '@/utilities/apiRateLimiter'
import { logError } from '@/utilities/logError'
import { AI_BUS_SPACE_SLUG } from '@/utilities/ensureSystemSpace'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ChannelPlan {
  channelId: number
  slug: string
  name: string
  messageCount: number
  /** 'move' — no such slug in the destination. 'merge' — fold into the one there. */
  action: 'move' | 'merge'
  /** Destination channel id, when merging. */
  mergeIntoChannelId?: number
}

export interface DeletePlan {
  space: { id: number; name: string; tenantId?: number }
  destination: { id: number; name: string } | null
  channels: ChannelPlan[]
  /** Messages that hang off the space but no channel — they follow the space. */
  looseMessages: number
  /** Memberships that will be carried over (people not already in the destination). */
  membersMoved: number
  /** Memberships dropped because that person is already a member there. */
  membersAlreadyThere: number
}

// ── Plan ────────────────────────────────────────────────────────────────────

const num = (v: unknown): number | undefined => {
  const raw = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

/**
 * Work out exactly what a delete would do. Pure reads — safe to call for the
 * dialog's preview, and the executor calls it too so the two cannot disagree.
 */
export async function buildDeletePlan(
  payload: Payload,
  spaceId: number,
  destinationId: number | undefined,
  req?: PayloadRequest,
): Promise<DeletePlan> {
  const space = (await payload.findByID({
    collection: 'spaces',
    id: spaceId,
    depth: 0,
    overrideAccess: true,
    req,
  })) as { id: number; name: string; slug?: string; isSystem?: boolean; tenant?: unknown } | null
  if (!space) throw new Error('Space not found.')

  // Infrastructure is not deletable. `isSystem` is the flag; the slug check
  // stays as a belt for any system space provisioned before the column existed
  // and somehow missed the backfill. The dialog hides the button for these, but
  // the dialog is not the only caller.
  if (space.isSystem || space.slug === AI_BUS_SPACE_SLUG || space.slug === 'direct-messages') {
    throw new Error('That is a system space and cannot be deleted.')
  }

  let destination: { id: number; name: string } | null = null
  if (destinationId) {
    if (destinationId === spaceId) throw new Error('A space cannot be moved into itself.')
    const dest = (await payload.findByID({
      collection: 'spaces',
      id: destinationId,
      depth: 0,
      overrideAccess: true,
      req,
    })) as { id: number; name: string; tenant?: unknown } | null
    if (!dest) throw new Error('Destination space not found.')
    // Same tenant, always. Authorization is granted against the SOURCE space's
    // tenant, so allowing a cross-tenant destination would let an admin of one
    // portal push channels, messages and members into another portal's space.
    if (num(dest.tenant) !== num(space.tenant)) {
      throw new Error('The destination space belongs to a different portal.')
    }
    destination = { id: dest.id, name: dest.name }
  }

  const sourceChannels = await payload.find({
    collection: 'channels',
    where: { space: { equals: spaceId } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req,
  })

  // Destination channels indexed by slug — the merge key.
  const destBySlug = new Map<string, number>()
  if (destination) {
    const destChannels = await payload.find({
      collection: 'channels',
      where: { space: { equals: destination.id } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
      req,
    })
    for (const c of destChannels.docs as Array<{ id: number; slug?: string }>) {
      if (c.slug) destBySlug.set(c.slug, c.id)
    }
  }

  const channels: ChannelPlan[] = []
  for (const doc of sourceChannels.docs as Array<{ id: number; slug?: string; name?: string }>) {
    const count = await payload.count({
      collection: 'messages',
      where: { channelRef: { equals: doc.id } },
      overrideAccess: true,
      req,
    })
    const slug = doc.slug || ''
    const mergeTarget = destBySlug.get(slug)
    channels.push({
      channelId: doc.id,
      slug,
      name: doc.name || slug,
      messageCount: count.totalDocs,
      action: mergeTarget ? 'merge' : 'move',
      ...(mergeTarget ? { mergeIntoChannelId: mergeTarget } : {}),
    })
    // Two source channels sharing a slug (it happens across provisionings) must
    // not both "move" — the first claims the destination, the second merges into
    // it. Registering it here makes the plan self-consistent.
    if (!mergeTarget && destination && slug) destBySlug.set(slug, doc.id)
  }

  // Messages on the space with no channel of their own.
  const loose = await payload.count({
    collection: 'messages',
    where: { and: [{ space: { equals: spaceId } }, { channelRef: { exists: false } }] },
    overrideAccess: true,
    req,
  })

  // Memberships: carry a person over only if they aren't already there.
  let membersMoved = 0
  let membersAlreadyThere = 0
  if (destination) {
    const sourceMemberships = await payload.find({
      collection: 'space-memberships',
      where: { space: { equals: spaceId } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const destMemberships = await payload.find({
      collection: 'space-memberships',
      where: { space: { equals: destination.id } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const already = new Set(
      (destMemberships.docs as Array<{ user?: unknown }>).map((m) => num(m.user)).filter(Boolean),
    )
    for (const m of sourceMemberships.docs as Array<{ user?: unknown }>) {
      const uid = num(m.user)
      if (!uid) continue
      if (already.has(uid)) membersAlreadyThere++
      else membersMoved++
    }
  }

  return {
    space: { id: space.id, name: space.name, tenantId: num(space.tenant) },
    destination,
    channels,
    looseMessages: loose.totalDocs,
    membersMoved,
    membersAlreadyThere,
  }
}

// ── Authorization ───────────────────────────────────────────────────────────

/**
 * Deleting a space is a TENANT-admin act, not a space-admin one.
 *
 * The bar has to be `Spaces.delete` — `adminOnly` — because this endpoint runs
 * every write with overrideAccess and therefore replaces Payload's own checks
 * rather than layering on them. An earlier draft accepted any space_admin of
 * the space, which would have handed a per-space role the power the collection
 * reserves for tenant admins. `canManageSpaces` is the same gate `Spaces.create`
 * uses, and it is scoped to the tenant that owns the space, so a tenant_admin
 * of one portal cannot reach into another.
 */
async function canAdministerSpace(
  payload: Payload,
  user: { id: number | string; email?: string; roles?: unknown[] },
  tenantId: number | string | undefined,
): Promise<boolean> {
  if (!tenantId) return false
  const { canManageSpaces } = await import('@/access/canManageSpaces')
  return canManageSpaces(user as never, tenantId)
}

// ── Handler ─────────────────────────────────────────────────────────────────

export const spaceDeleteHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 })

  const isPreview = req.method === 'GET'

  let spaceId: number | undefined
  let destinationId: number | undefined
  let confirmDeleteContents = false

  if (isPreview) {
    const url = new URL(req.url || '', 'http://localhost')
    spaceId = num(url.searchParams.get('spaceId'))
    destinationId = num(url.searchParams.get('reassignTo'))
  } else {
    let body: Record<string, unknown>
    try {
      body = (await (req as Request).json()) as Record<string, unknown>
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    spaceId = num(body.spaceId)
    destinationId = num(body.reassignTo)
    confirmDeleteContents = body.deleteContents === true
  }

  if (!spaceId) return Response.json({ error: 'spaceId is required.' }, { status: 400 })

  // The plan is read-only, and it is what tells us which tenant owns the space —
  // so build it first, then authorize against that tenant before anything else
  // is returned or written. A 403 leaks nothing: the plan is discarded.
  let plan: DeletePlan
  try {
    plan = await buildDeletePlan(payload, spaceId, destinationId, req)
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Could not read the space.' }, { status: 400 })
  }

  if (!(await canAdministerSpace(payload, user as never, plan.space.tenantId))) {
    return Response.json(
      { error: 'Only an admin of this portal can delete a space.' },
      { status: 403 },
    )
  }

  if (isPreview) return Response.json({ plan })

  // Refuse-on-populated: a space with contents and nowhere to send them is a
  // silent data loss, which is precisely what this endpoint exists to end.
  const hasContents =
    plan.channels.length > 0 || plan.looseMessages > 0 || plan.channels.some((c) => c.messageCount > 0)
  if (!plan.destination && hasContents && !confirmDeleteContents) {
    return Response.json(
      {
        error:
          'This space still holds channels or messages. Choose a space to move them to, or confirm you want them deleted.',
        plan,
      },
      { status: 409 },
    )
  }

  // Rate limit only the destructive path.
  const rateLimited = applyRateLimit(req, 'spaces_create')
  if (rateLimited) return rateLimited

  try {
    await executeDeletePlan(payload, plan, req)
    return Response.json({ success: true, plan })
  } catch (err) {
    await logError({
      source: 'space-delete',
      message: `Failed to delete space ${spaceId}: ${err instanceof Error ? err.message : String(err)}`,
      details: err instanceof Error ? err.stack : String(err),
      statusCode: 500,
      userId: user.id,
    })
    return Response.json(
      { error: err instanceof Error ? err.message : 'Delete failed.' },
      { status: 500 },
    )
  }
}

// ── Execute ─────────────────────────────────────────────────────────────────

async function executeDeletePlan(
  payload: Payload,
  plan: DeletePlan,
  req: PayloadRequest,
): Promise<void> {
  const destination = plan.destination

  for (const ch of plan.channels) {
    if (destination && ch.action === 'merge' && ch.mergeIntoChannelId) {
      // Re-point this channel's messages at the surviving one, then drop the
      // emptied channel. Ids one at a time: a bulk update with a `where` on a
      // RELATIONSHIP silently matches nothing.
      const msgs = await payload.find({
        collection: 'messages',
        where: { channelRef: { equals: ch.channelId } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
        req,
      })
      const target = (await payload.findByID({
        collection: 'channels',
        id: ch.mergeIntoChannelId,
        depth: 0,
        overrideAccess: true,
        req,
      })) as { slug?: string } | null
      for (const m of msgs.docs as Array<{ id: number }>) {
        await payload.update({
          collection: 'messages',
          id: m.id,
          data: {
            space: destination.id,
            channelRef: ch.mergeIntoChannelId,
            // `channel` is the SLUG string the readers actually key on — it has
            // to follow the relationship or the message lands in a channel the
            // UI cannot find.
            ...(target?.slug ? { channel: target.slug } : {}),
          } as never,
          overrideAccess: true,
          req,
        })
      }
      await payload.delete({ collection: 'channels', id: ch.channelId, overrideAccess: true, req })
    } else if (destination) {
      // Straight move: the channel keeps its identity and its messages follow.
      await payload.update({
        collection: 'channels',
        id: ch.channelId,
        data: { space: destination.id } as never,
        overrideAccess: true,
        req,
      })
      const msgs = await payload.find({
        collection: 'messages',
        where: { channelRef: { equals: ch.channelId } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
        req,
      })
      for (const m of msgs.docs as Array<{ id: number }>) {
        await payload.update({
          collection: 'messages',
          id: m.id,
          data: { space: destination.id } as never,
          overrideAccess: true,
          req,
        })
      }
    } else {
      // No destination and the caller confirmed: delete rather than orphan.
      const msgs = await payload.find({
        collection: 'messages',
        where: { channelRef: { equals: ch.channelId } },
        limit: 0,
        depth: 0,
        overrideAccess: true,
        req,
      })
      for (const m of msgs.docs as Array<{ id: number }>) {
        await payload.delete({ collection: 'messages', id: m.id, overrideAccess: true, req })
      }
      await payload.delete({ collection: 'channels', id: ch.channelId, overrideAccess: true, req })
    }
  }

  // Messages that belonged to the space but no channel.
  const loose = await payload.find({
    collection: 'messages',
    where: { and: [{ space: { equals: plan.space.id } }, { channelRef: { exists: false } }] },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req,
  })
  for (const m of loose.docs as Array<{ id: number }>) {
    if (destination) {
      await payload.update({
        collection: 'messages',
        id: m.id,
        data: { space: destination.id } as never,
        overrideAccess: true,
        req,
      })
    } else {
      await payload.delete({ collection: 'messages', id: m.id, overrideAccess: true, req })
    }
  }

  // Memberships: carry people over, then clear the source's rows either way so
  // nothing is left pointing at a space that no longer exists.
  const memberships = await payload.find({
    collection: 'space-memberships',
    where: { space: { equals: plan.space.id } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
    req,
  })
  if (destination) {
    const destMemberships = await payload.find({
      collection: 'space-memberships',
      where: { space: { equals: destination.id } },
      limit: 0,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const already = new Set(
      (destMemberships.docs as Array<{ user?: unknown }>).map((m) => num(m.user)).filter(Boolean),
    )
    for (const m of memberships.docs as Array<{ id: number; user?: unknown }>) {
      const uid = num(m.user)
      if (uid && !already.has(uid)) {
        await payload.update({
          collection: 'space-memberships',
          id: m.id,
          data: { space: destination.id } as never,
          overrideAccess: true,
          req,
        })
        already.add(uid)
        continue
      }
      await payload.delete({ collection: 'space-memberships', id: m.id, overrideAccess: true, req })
    }
  } else {
    for (const m of memberships.docs as Array<{ id: number }>) {
      await payload.delete({ collection: 'space-memberships', id: m.id, overrideAccess: true, req })
    }
  }

  await payload.delete({ collection: 'spaces', id: plan.space.id, overrideAccess: true, req })
}
