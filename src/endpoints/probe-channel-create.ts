/**
 * TEMP DIAGNOSTIC — GET /api/provision-ops/probe-channel-create?space=&tenant=
 *
 * The server-side channel create fails "invalid: Space" on prod but not locally
 * (see [[project_community_space_provisioning]]). This probe tries EVERY create
 * strategy against a real space+tenant and reports which succeed, so we stop
 * guessing at Payload internals. Each created channel is deleted immediately.
 *
 * super_admin OR archangel (checkRole ADMIN_ROLES) OR ?key=CRON_SECRET.
 * REMOVE once the fix is confirmed.
 */
import type { PayloadHandler } from 'payload'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

export const probeChannelCreateHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')
  const key = url.searchParams.get('key')
  const secret = process.env.CRON_SECRET
  const keyOk = Boolean(secret && key === secret)
  if (!keyOk && !(user && checkRole(ADMIN_ROLES, user))) {
    return Response.json({ error: 'admin or key required' }, { status: 403 })
  }

  const space = Number(url.searchParams.get('space') || 0)
  const tenant = Number(url.searchParams.get('tenant') || 0)
  if (!space || !tenant) return Response.json({ error: 'pass ?space= &tenant=' }, { status: 400 })

  // A real super_admin (whoever it is on this node) + the first user (archangel).
  let realSuper: unknown = null
  let firstUser: unknown = null
  try {
    const su = await payload.find({ collection: 'users', where: { roles: { in: ['super_admin'] } } as never, limit: 1, depth: 0, overrideAccess: true })
    realSuper = su.docs[0] ?? null
  } catch { /* ignore */ }
  try {
    const fu = await payload.find({ collection: 'users', sort: 'id', limit: 1, depth: 0, overrideAccess: true })
    firstUser = fu.docs[0] ?? null
  } catch { /* ignore */ }

  const SYNTH = { id: 0, collection: 'users', roles: ['super_admin'], isSystemUser: true }

  const baseData = { name: 'probe', description: 'probe', type: 'general', space, isDefault: false, tenant }

  const strategies: Array<{ name: string; run: () => Promise<unknown> }> = [
    { name: 'A: overrideAccess only (no user, no req)', run: () => payload.create({ collection: 'channels', data: { ...baseData, slug: '_pA' } as never, overrideAccess: true }) },
    { name: 'B: user=SYNTH super_admin (no req)', run: () => payload.create({ collection: 'channels', data: { ...baseData, slug: '_pB' } as never, overrideAccess: true, user: SYNTH as never }) },
    { name: 'C: user=REAL super_admin (no req)', run: () => payload.create({ collection: 'channels', data: { ...baseData, slug: '_pC' } as never, overrideAccess: true, user: realSuper as never }) },
    { name: 'D: user=firstUser/archangel (no req)', run: () => payload.create({ collection: 'channels', data: { ...baseData, slug: '_pD' } as never, overrideAccess: true, user: firstUser as never }) },
    { name: 'E: pass endeavor req as-is', run: () => payload.create({ collection: 'channels', data: { ...baseData, slug: '_pE' } as never, overrideAccess: true, req }) },
    { name: 'F: SYNTH user + cloned req (my failed approach)', run: () => payload.create({ collection: 'channels', data: { ...baseData, slug: '_pF' } as never, overrideAccess: true, user: SYNTH as never, req: { ...req } as never }) },
    { name: 'G: no tenant in data + SYNTH user', run: () => payload.create({ collection: 'channels', data: { name: 'probe', description: 'probe', type: 'general', space, isDefault: false, slug: '_pG' } as never, overrideAccess: true, user: SYNTH as never }) },
    { name: 'H: disableTransaction + SYNTH user', run: () => payload.create({ collection: 'channels', data: { ...baseData, slug: '_pH' } as never, overrideAccess: true, user: SYNTH as never, disableTransaction: true } as never) },
  ]

  const results: Array<{ strategy: string; ok: boolean; id?: unknown; error?: string }> = []
  for (const s of strategies) {
    try {
      const doc = (await s.run()) as { id: unknown }
      results.push({ strategy: s.name, ok: true, id: doc.id })
      try {
        await payload.delete({ collection: 'channels', id: doc.id as string, overrideAccess: true })
      } catch { /* leave it; harmless probe channel */ }
    } catch (e) {
      results.push({ strategy: s.name, ok: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return Response.json({
    ok: true,
    space,
    tenant,
    realSuperId: (realSuper as { id?: unknown })?.id ?? null,
    firstUserId: (firstUser as { id?: unknown })?.id ?? null,
    results,
  })
}
