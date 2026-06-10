/**
 * DM Roster — GET /api/messages-ops/dm-roster?tenantId=<id>
 *
 * Returns every active member of the tenant (plus LEO) as a virtual DM entry, so
 * the Direct Messages list can show everyone you COULD message — the channel is
 * created lazily on first use (POST /api/dm/find-or-create). Each entry carries
 * the deterministic dm slug + a hasChannel marker. Presence is overlaid
 * client-side by userId (usePresence). Auth required.
 */
import type { PayloadHandler } from 'payload'
import { buildDmRoster, type RawMember } from '@/utilities/dmRoster'

export const dmRosterHandler: PayloadHandler = async (req) => {
  const { payload, headers } = req
  const { user } = await payload.auth({ headers })
  if (!user) return Response.json({ message: 'Not authenticated' }, { status: 401 })

  const url = new URL(req.url || '', 'http://localhost')
  const tenantId = url.searchParams.get('tenantId')
  if (!tenantId) return Response.json({ message: 'tenantId is required' }, { status: 400 })

  try {
    // Active members of this tenant (depth 1 → resolve the user doc for name/email).
    const memberships = await payload.find({
      collection: 'tenant-memberships',
      where: { and: [{ tenant: { equals: tenantId } }, { status: { equals: 'active' } }] },
      limit: 500,
      depth: 1,
      overrideAccess: true,
    })

    const members: RawMember[] = []
    for (const m of memberships.docs as unknown as Array<Record<string, unknown>>) {
      const u = m.user
      if (u && typeof u === 'object') {
        const ud = u as { id: number | string; name?: string | null; email?: string | null; isSystemUser?: boolean }
        if (ud.isSystemUser) continue // LEO/system avatars are added explicitly, not as peers
        members.push({ userId: ud.id, name: ud.name ?? null, email: ud.email ?? null })
      } else if (u != null) {
        members.push({ userId: u as number | string })
      }
    }

    // Which DM channels already exist? One query over the candidate slugs.
    const { dmSlugFor } = await import('@/utilities/dmRoster')
    const candidateSlugs = [
      dmSlugFor(user.id, 'leo'),
      ...members.filter((m) => String(m.userId) !== String(user.id)).map((m) => dmSlugFor(user.id, m.userId)),
    ]
    const existingSlugs = new Set<string>()
    if (candidateSlugs.length > 0) {
      const channels = await payload.find({
        collection: 'channels',
        where: { and: [{ slug: { in: candidateSlugs } }, { type: { equals: 'dm' } }] },
        limit: 1000,
        depth: 0,
        overrideAccess: true,
      })
      for (const c of channels.docs as unknown as Array<Record<string, unknown>>) {
        if (typeof c.slug === 'string') existingSlugs.add(c.slug)
      }
    }

    const roster = buildDmRoster(user.id, members, existingSlugs)
    return Response.json({ roster, scope: 'tenant', tenantId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    payload.logger?.error?.(`[dm-roster] ${msg}`)
    return Response.json({ message: msg }, { status: 500 })
  }
}
