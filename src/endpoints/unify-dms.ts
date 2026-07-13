/**
 * Unify DM threads — POST /api/provision-ops/unify-dms
 *
 * The channel-model fold, phase 3: a DM is the USER's, not a tenant's. The
 * pre-260713 findOrCreateDM was tenant-scoped, so every portal minted its own
 * dm-{u}-leo (etc.) — nine per user in the wild, each with a disjoint history.
 * This op groups ALL type:'dm' channels by their deterministic slug (which
 * encodes the participant pair) and merges each group into ONE canonical
 * thread via mergeDmChannelGroup: canonical = most messages (tie → oldest),
 * every other row's messages repointed (channelRef + space) before the row is
 * deleted, members unioned. History is never orphaned.
 *
 * Safety (destructive-op rules): super_admin-gated; DRY-RUN by default — pass
 * { execute: true } to write; optional { slug } scopes to one conversation;
 * idempotent (a second execute finds no duplicate groups).
 */
import type { PayloadHandler } from 'payload'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { mergeDmChannelGroup, type DmMergeReport } from '@/utilities/dmChannels'

export const unifyDmsHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'sign-in required' }, { status: 401 })
  if (!checkRole(ADMIN_ROLES, user)) {
    return Response.json({ error: 'super_admin required' }, { status: 403 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* body optional */
  }
  const execute = body.execute === true
  const slugScope = typeof body.slug === 'string' ? body.slug : undefined

  // Every DM channel, grouped by deterministic slug. limit:2000 is far above
  // the real population (~40 today); if we ever near it, page instead.
  const channels = await payload.find({
    collection: 'channels',
    where: {
      and: [
        { type: { equals: 'dm' } },
        ...(slugScope ? [{ slug: { equals: slugScope } }] : []),
      ],
    },
    limit: 2000,
    depth: 0,
    overrideAccess: true,
    sort: 'createdAt',
  })

  const groups = new Map<string, typeof channels.docs>()
  for (const ch of channels.docs) {
    const slug = String((ch as { slug?: string }).slug ?? '')
    if (!slug) continue
    const g = groups.get(slug) ?? []
    g.push(ch)
    groups.set(slug, g)
  }

  const reports: DmMergeReport[] = []
  for (const [, group] of groups) {
    if (group.length < 2) continue
    const report = await mergeDmChannelGroup(payload, group, execute)
    if (report) reports.push(report)
  }

  return Response.json({
    ok: true,
    mode: execute ? 'EXECUTED' : 'DRY-RUN (pass {"execute":true} to write)',
    dmChannelsFound: channels.docs.length,
    duplicateGroups: reports.length,
    reports,
  })
}
