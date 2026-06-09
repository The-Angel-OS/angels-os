/**
 * Presence Ping — POST /api/presence-ops/ping
 *
 * The client calls this every ~30s (and on focus) to mark the user online.
 * Upserts a single presence row per user. Body: { status?, spaceId?, path? }.
 *
 * @see src/collections/Presence/index.ts
 */
import type { PayloadHandler } from 'payload'

const VALID_STATUS = ['online', 'away', 'offline'] as const

export const presencePingHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try {
    body = (await (req as unknown as Request).json()) as Record<string, unknown>
  } catch {
    /* empty body is fine — defaults to online */
  }

  const status = VALID_STATUS.includes(body.status as (typeof VALID_STATUS)[number])
    ? (body.status as string)
    : 'online'
  const spaceId = body.spaceId != null && body.spaceId !== '' ? body.spaceId : null
  const path = typeof body.path === 'string' ? body.path.slice(0, 300) : undefined
  const now = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = { status, lastSeenAt: now, space: spaceId }
  if (path) data.path = path

  // The Presence collection types aren't generated yet (generate:types is broken
  // locally), so the 'presence' slug isn't in the typed CollectionSlug union.
  // Cast payload to any for these calls — casting the *collection* to never
  // poisons the call's generic and every argument with it (broke 8 deploys).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = payload as any

  try {
    const existing = await db.find({
      collection: 'presence',
      where: { user: { equals: user.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    const existingDoc = existing.docs[0] as { id: string | number } | undefined

    if (existingDoc) {
      await db.update({
        collection: 'presence',
        id: existingDoc.id,
        data,
        overrideAccess: true,
      })
    } else {
      await db.create({
        collection: 'presence',
        data: { user: user.id, ...data },
        overrideAccess: true,
      })
    }
    return Response.json({ ok: true, status, at: now })
  } catch (err) {
    // Degrade gracefully — a failed heartbeat must never surface raw SQL or break
    // the page. High-frequency poll → console (not the errors channel) for triage.
    console.error('[presence-ping] upsert failed:', err instanceof Error ? err.message : err)
    return Response.json({ ok: false, degraded: true }, { status: 200 })
  }
}
