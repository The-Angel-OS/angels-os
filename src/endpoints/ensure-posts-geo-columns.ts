/**
 * DB setup: Posts Geo-Archive columns — GET /api/provision-ops/ensure-posts-geo-columns
 *
 * Adds the unified `geo` group columns to BOTH `posts` and `_posts_v` so every portal
 * (MLB Old World, UAP Disclosure, NDE & Past-Lives, Jon Levi, etc.) can store its
 * geocoded archive records directly inside the `Posts` collection — making every pin
 * natively searchable via Payload's Posts search engine and renderable on the 3D Globe.
 *
 * Payload Postgres naming convention for group `geo`:
 *   - live table (`posts`):     geo_latitude, geo_longitude, geo_location_name, geo_event_date, geo_category, geo_meta
 *   - version table (`_posts_v`): version_geo_latitude, version_geo_longitude, version_geo_location_name, version_geo_event_date, version_geo_category, version_geo_meta
 *
 * ⚠️ RULE: Run this on prod BEFORE deploying the `geo` group in `src/collections/Posts/index.ts`.
 * Auth: super_admin OR ?key=<CRON_SECRET>. Idempotent.
 */
import type { PayloadHandler } from 'payload'

const STATEMENTS: string[] = [
  // Live table (`posts`)
  `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "geo_latitude" numeric;`,
  `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "geo_longitude" numeric;`,
  `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "geo_location_name" varchar;`,
  `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "geo_event_date" varchar;`,
  `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "geo_category" varchar;`,
  `ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "geo_meta" jsonb;`,
  `CREATE INDEX IF NOT EXISTS "posts_geo_latitude_idx" ON "posts" ("geo_latitude");`,
  `CREATE INDEX IF NOT EXISTS "posts_geo_longitude_idx" ON "posts" ("geo_longitude");`,
  `CREATE INDEX IF NOT EXISTS "posts_geo_category_idx" ON "posts" ("geo_category");`,

  // Versioned table (`_posts_v`) — version_ prefix twins
  `ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_geo_latitude" numeric;`,
  `ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_geo_longitude" numeric;`,
  `ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_geo_location_name" varchar;`,
  `ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_geo_event_date" varchar;`,
  `ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_geo_category" varchar;`,
  `ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_geo_meta" jsonb;`,
  `CREATE INDEX IF NOT EXISTS "_posts_v_version_geo_latitude_idx" ON "_posts_v" ("version_geo_latitude");`,
  `CREATE INDEX IF NOT EXISTS "_posts_v_version_geo_longitude_idx" ON "_posts_v" ("version_geo_longitude");`,
]

export const ensurePostsGeoColumnsHandler: PayloadHandler = async (req) => {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = (payload.db as any)?.pool
  if (!pool?.query) {
    return Response.json({ error: 'no pg pool on payload.db' }, { status: 500 })
  }

  const ran: number[] = []
  const errors: Array<{ i: number; error: string }> = []
  for (let i = 0; i < STATEMENTS.length; i++) {
    try {
      await pool.query(STATEMENTS[i])
      ran.push(i)
    } catch (e) {
      errors.push({ i, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return Response.json({
    ok: errors.length === 0,
    ran: ran.length,
    total: STATEMENTS.length,
    errors,
  })
}
