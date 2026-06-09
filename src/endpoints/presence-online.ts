/**
 * Presence Online — GET /api/presence-ops/online?space=<id>&windowSec=60
 *
 * Returns the users seen within the freshness window (default 60s), optionally
 * filtered to a space. Drives "N online" indicators + online avatar stacks.
 *
 * @see src/collections/Presence/index.ts
 */
import type { PayloadHandler } from 'payload'

export const presenceOnlineHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Not authenticated', count: 0, online: [] }, { status: 401 })

  const url = new URL(req.url || 'http://localhost', 'http://localhost')
  const spaceId = url.searchParams.get('space')
  const windowSec = Math.min(Math.max(parseInt(url.searchParams.get('windowSec') || '60', 10), 15), 600)
  const cutoff = new Date(Date.now() - windowSec * 1000).toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    and: [{ lastSeenAt: { greater_than: cutoff } }, { status: { not_equals: 'offline' } }],
  }
  if (spaceId) where.and.push({ space: { equals: spaceId } })

  // Presence types aren't generated yet — cast payload to any rather than the
  // collection to never (which poisons the call generic; see presence-ping.ts).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = payload as any

  try {
    const result = await db.find({
      collection: 'presence',
      where,
      limit: 200,
      depth: 1, // resolve user name/email
      overrideAccess: true,
      sort: '-lastSeenAt',
    })

    const online = (result.docs as any[]).map((d) => { // eslint-disable-line @typescript-eslint/no-explicit-any
      const u = typeof d.user === 'object' && d.user ? d.user : null
      return {
        userId: u?.id ?? d.user,
        name: u?.name || null,
        email: u?.email || null,
        status: d.status || 'online',
        lastSeenAt: d.lastSeenAt,
        spaceId: typeof d.space === 'object' && d.space ? d.space.id : d.space ?? null,
      }
    })

    return Response.json({ count: online.length, windowSec, online })
  } catch (err) {
    // Presence is cosmetic ("N online"). Degrade gracefully — NEVER surface a raw
    // SQL string to the client — and log server-side. This is a high-frequency
    // poll, so console (not the AI Bus errors channel) to avoid spamming it while
    // presence is degraded; the platform log captures it for triage.
    console.error('[presence-online] query failed:', err instanceof Error ? err.message : err)
    return Response.json({ count: 0, online: [], degraded: true }, { status: 200 })
  }
}
