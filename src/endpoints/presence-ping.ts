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

  try {
    const existing = await payload.find({
      collection: 'presence' as never,
      where: { user: { equals: user.id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })

    if (existing.docs[0]) {
      await payload.update({
        collection: 'presence' as never,
        id: existing.docs[0].id,
        data,
        overrideAccess: true,
      })
    } else {
      await payload.create({
        collection: 'presence' as never,
        data: { user: user.id, ...data },
        overrideAccess: true,
      })
    }
    return Response.json({ ok: true, status, at: now })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'ping failed' },
      { status: 500 },
    )
  }
}
