/**
 * Fold DMs into the AI Bus — POST /api/provision-ops/fold-dms
 *
 * The channel-model fold, phase 2 (see docs/HANDOFF_channel_model_260711.md and
 * migration 20260708_000000): DMs are the USER's, not a space's. This op re-homes
 * every channel living in a tenant's legacy "Direct Messages" space onto the
 * tenant's AI BUS space, re-keys those channels' messages (space + channelRef),
 * and retires the emptied DM space (memberships deleted, then the space).
 *
 * Privacy holds because DM visibility is CHANNEL-membership-grained
 * (PermissionService.buildChannelReadFilter / buildMessageReadFilter) — a DM on
 * the AI Bus is visible only to its members, and DM participants gain NO
 * space-level view of the bus's system channels.
 *
 * Safety (destructive-op rules): super_admin-gated; DRY-RUN by default — pass
 * { execute: true } to write; optional { tenant } scopes to one tenant; idempotent
 * (a second execute finds no DM spaces and does nothing).
 */
import type { PayloadHandler } from 'payload'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { DM_SPACE_SLUG, resolveAiBusSpaceId } from '@/utilities/ensureSystemSpace'

type FoldReport = {
  tenantId: number | string
  dmSpaceId: number | string
  aiBusSpaceId?: string
  channelsMoved: string[]
  messagesMoved: number
  orphanMessagesMoved: number
  membershipsDeleted: number
  spaceDeleted: boolean
  errors: string[]
}

export const foldDmsHandler: PayloadHandler = async (req) => {
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
  const tenantScope = body.tenant != null ? Number(body.tenant) : undefined

  // Every legacy DM space (each carries its tenant) — the work list.
  const dmSpaces = await payload.find({
    collection: 'spaces',
    where: {
      and: [
        { slug: { equals: DM_SPACE_SLUG } },
        ...(tenantScope != null ? [{ tenant: { equals: tenantScope } }] : []),
      ],
    },
    limit: 200,
    depth: 0,
    overrideAccess: true,
  })

  const reports: FoldReport[] = []

  for (const space of dmSpaces.docs) {
    const s = space as unknown as { id: number | string; tenant?: number | { id: number } }
    const tenantId = typeof s.tenant === 'object' ? s.tenant?.id : s.tenant
    const report: FoldReport = {
      tenantId: tenantId ?? '(none)',
      dmSpaceId: s.id,
      channelsMoved: [],
      messagesMoved: 0,
      orphanMessagesMoved: 0,
      membershipsDeleted: 0,
      spaceDeleted: false,
      errors: [],
    }
    reports.push(report)

    if (tenantId == null) {
      report.errors.push('DM space has no tenant — skipped')
      continue
    }

    const aiBusId = await resolveAiBusSpaceId(payload, tenantId)
    if (!aiBusId) {
      report.errors.push('could not resolve/create the AI Bus space — skipped')
      continue
    }
    report.aiBusSpaceId = aiBusId
    if (String(aiBusId) === String(s.id)) {
      report.errors.push('DM space IS the AI Bus space?! — skipped')
      continue
    }

    // Channels living in the DM space (DMs, plus any strays — move them all).
    const channels = await payload.find({
      collection: 'channels',
      where: { space: { equals: s.id } },
      limit: 500,
      depth: 0,
      overrideAccess: true,
    })

    for (const ch of channels.docs) {
      const c = ch as unknown as { id: number | string; slug: string }
      try {
        if (execute) {
          await payload.update({
            collection: 'channels',
            id: c.id,
            data: { space: Number(aiBusId) } as never,
            overrideAccess: true,
            overrideLock: true as never,
          })
          // Re-key this channel's messages in one bulk pass: new home + stable ref.
          const upd = await payload.update({
            collection: 'messages',
            where: { and: [{ space: { equals: s.id } }, { channel: { equals: c.slug } }] },
            data: { space: Number(aiBusId), channelRef: c.id } as never,
            overrideAccess: true,
          })
          report.messagesMoved += Array.isArray((upd as { docs?: unknown[] }).docs)
            ? ((upd as { docs: unknown[] }).docs.length)
            : 0
        } else {
          const count = await payload.count({
            collection: 'messages',
            where: { and: [{ space: { equals: s.id } }, { channel: { equals: c.slug } }] },
            overrideAccess: true,
          })
          report.messagesMoved += count.totalDocs
        }
        report.channelsMoved.push(c.slug)
      } catch (e) {
        report.errors.push(`channel ${c.slug}: ${(e as Error).message}`)
      }
    }

    // Orphan sweep — messages still keyed to the DM space with no channel row.
    try {
      if (execute) {
        const orphans = await payload.update({
          collection: 'messages',
          where: { space: { equals: s.id } },
          data: { space: Number(aiBusId) } as never,
          overrideAccess: true,
        })
        report.orphanMessagesMoved = Array.isArray((orphans as { docs?: unknown[] }).docs)
          ? ((orphans as { docs: unknown[] }).docs.length)
          : 0
      } else {
        const count = await payload.count({
          collection: 'messages',
          where: { space: { equals: s.id } },
          overrideAccess: true,
        })
        // Dry-run: per-channel counts above already cover most; report the total.
        report.orphanMessagesMoved = Math.max(0, count.totalDocs - report.messagesMoved)
      }
    } catch (e) {
      report.errors.push(`orphan sweep: ${(e as Error).message}`)
    }

    // Retire the space: memberships first, then the (now empty) space itself.
    try {
      const memberships = await payload.find({
        collection: 'space-memberships',
        where: { space: { equals: s.id } },
        limit: 500,
        depth: 0,
        overrideAccess: true,
      })
      report.membershipsDeleted = memberships.docs.length
      if (execute) {
        for (const m of memberships.docs) {
          await payload.delete({ collection: 'space-memberships', id: (m as { id: number | string }).id, overrideAccess: true })
        }
        await payload.delete({ collection: 'spaces', id: s.id, overrideAccess: true })
        report.spaceDeleted = true
      }
    } catch (e) {
      report.errors.push(`retire space: ${(e as Error).message}`)
    }
  }

  return Response.json({
    ok: true,
    mode: execute ? 'EXECUTED' : 'DRY-RUN (pass {"execute":true} to write)',
    dmSpacesFound: dmSpaces.docs.length,
    reports,
  })
}
