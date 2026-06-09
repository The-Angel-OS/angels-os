/**
 * Ensure Page Channels — GET /api/provision-ops/ensure-page-channels
 *
 * Backfill Channel documents for any `page:` messages that were written before
 * ensurePageChannel shipped. Scans all messages whose channel starts with
 * "page:", groups by unique (space, channel) pairs, and find-or-creates the
 * Channel doc so those conversations appear in the AI Bus Spaces viewer.
 *
 * Idempotent — safe to run repeatedly. super_admin or ?key=CRON_SECRET.
 *
 * ?tenant=<slug>  heal one tenant
 * ?all=1          heal every tenant
 */
import type { PayloadHandler } from 'payload'
import { ensurePageChannel, reparentPageChannelsToAiBus } from '@/utilities/ensurePageChannel'
import { resolveAiBusSpaceId } from '@/utilities/ensureSystemSpace'
import { fetchTenantBySlug } from '@/utilities/fetchTenantBySlug'

export const ensurePageChannelsHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(
    user && ((user as { roles?: string[] }).roles || []).includes('super_admin'),
  )
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  const slug = url.searchParams.get('tenant')?.trim()
  const all = ['1', 'true'].includes(url.searchParams.get('all') || '')

  // Resolve target tenant IDs
  let tenantIds: Array<number | string> = []
  if (slug) {
    const t = await fetchTenantBySlug(slug)
    if (!t) return Response.json({ error: `tenant '${slug}' not found` }, { status: 404 })
    tenantIds = [t.id]
  } else if (all) {
    const res = await payload.find({ collection: 'tenants', limit: 500, depth: 0, overrideAccess: true })
    tenantIds = (res.docs as { id: number | string }[]).map((t) => t.id)
  } else {
    return Response.json({ error: 'pass ?tenant=<slug> or ?all=1' }, { status: 400 })
  }

  const results: Array<{ tenant: string | number; created: number; deleted: number; reparented: number; errors: number }> = []

  for (const tenantId of tenantIds) {
    let created = 0
    let deleted = 0
    let errors = 0
    let reparented = 0

    // Re-home any page channels that drifted onto a non-AI-Bus space.
    const aiBusSpaceId = await resolveAiBusSpaceId(payload, tenantId)
    if (aiBusSpaceId) {
      try {
        reparented = await reparentPageChannelsToAiBus(payload, tenantId, aiBusSpaceId)
      } catch (e) {
        console.warn('[ensure-page-channels] reparent', e instanceof Error ? e.message : e)
      }
    }

    // Heal legacy mangled docs: before the channelSlugField fix, the auto slug
    // field slugified `page:/about` → `pageabout` on save, so these channels
    // (name "Page: …") carry a slug that never matches message.channel and were
    // re-created as duplicates on every run. Delete any "Page: …" channel whose
    // slug isn't a proper `page:` key; ensurePageChannel re-creates it correctly.
    const legacy = await payload.find({
      collection: 'channels',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { name: { like: 'Page:' } },
        ],
      },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    })
    for (const ch of legacy.docs as Array<{ id: number | string; slug?: string; name?: string }>) {
      // `like` is a substring match, so guard against deleting a real channel that
      // merely CONTAINS "Page:" (e.g. "Front Page: News"): only treat docs whose
      // NAME starts with our generated "Page:" prefix as legacy page channels.
      if (typeof ch.name !== 'string' || !ch.name.startsWith('Page:')) continue
      if (typeof ch.slug === 'string' && ch.slug.startsWith('page:')) continue // already correct
      try {
        await payload.delete({ collection: 'channels', id: ch.id, overrideAccess: true })
        deleted++
      } catch (e) {
        console.warn('[ensure-page-channels] delete legacy', e instanceof Error ? e.message : e)
        errors++
      }
    }

    // Find all page: messages for this tenant (select only needed fields)
    const msgs = await payload.find({
      collection: 'messages',
      where: {
        and: [
          { tenant: { equals: tenantId } },
          { channel: { contains: 'page:' } },
        ],
      },
      limit: 2000,
      depth: 0,
      overrideAccess: true,
    })

    // Collect unique (spaceId, channel) pairs
    const seen = new Set<string>()
    for (const msg of msgs.docs as Array<{ channel?: string; space?: unknown }>) {
      const channel = msg.channel
      const spaceRaw = msg.space
      const spaceId =
        spaceRaw && typeof spaceRaw === 'object'
          ? (spaceRaw as { id: number | string }).id
          : (spaceRaw as number | string)
      if (!channel?.startsWith('page:') || spaceId == null) continue

      const key = `${spaceId}::${channel}`
      if (seen.has(key)) continue
      seen.add(key)

      try {
        await ensurePageChannel(payload, { channel, tenantId })
        created++
      } catch (e) {
        console.warn('[ensure-page-channels]', e instanceof Error ? e.message : e)
        errors++
      }
    }

    results.push({ tenant: tenantId, created, deleted, reparented, errors })
  }

  const totalCreated = results.reduce((s, r) => s + r.created, 0)
  const totalDeleted = results.reduce((s, r) => s + r.deleted, 0)
  const totalReparented = results.reduce((s, r) => s + r.reparented, 0)
  return Response.json({ ok: true, totalCreated, totalDeleted, totalReparented, results })
}
