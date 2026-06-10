/**
 * DB Repair: tenant per-section hero columns —
 * GET /api/provision-ops/ensure-tenant-hero-columns
 *
 * Phase 1 of adding per-section listing hero images (Posts/Events/Shop). Prod
 * uses dev-push (unreliable for new columns) AND this code deploys to MULTIPLE
 * production databases (spacesangels.com / angels, kendev.co / kendev). Per the
 * schema-field-deploy rule, the column MUST exist before the Payload field that
 * references it deploys — otherwise every tenant read references a missing column
 * and the whole site falls back to the platform home (outage).
 *
 * This endpoint adds the columns idempotently using the deployment's OWN db pool,
 * so it works against whichever DB that deployment is wired to — no need to hold
 * every DB's credentials. Run it against each production URL BEFORE shipping the
 * Tenants.storefront.{posts,events,shop}HeroImage fields. Safe to run repeatedly.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>.
 *
 * @see src/endpoints/db-repair-locks.ts — same pattern for the rels table
 */
import type { PayloadHandler } from 'payload'

const TABLE = 'tenants'
// Payload flattens a `storefront` group upload field to `storefront_<field>_id`
// (mirrors the existing `storefront_cover_image_id`). All are integer FKs → media.
const HERO_COLUMNS = [
  'storefront_posts_hero_image_id',
  'storefront_events_hero_image_id',
  'storefront_shop_hero_image_id',
]

export const ensureTenantHeroColumnsHandler: PayloadHandler = async (req) => {
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

  // node-postgres Pool from the postgres adapter.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = (payload.db as any)?.pool
  if (!pool?.query) {
    return Response.json({ error: 'no pg pool on payload.db' }, { status: 500 })
  }

  // Which already exist? One catalog query so we report exactly what was healed.
  const existing = new Set<string>()
  try {
    const res = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [TABLE],
    )
    for (const row of res.rows as Array<{ column_name: string }>) existing.add(row.column_name)
  } catch {
    /* if introspection fails, ADD IF NOT EXISTS is still safe below */
  }

  const ensured: string[] = []
  const created: string[] = []
  const errors: Array<{ column: string; error: string }> = []
  for (const col of HERO_COLUMNS) {
    try {
      // IF NOT EXISTS → idempotent. Column names are a fixed allow-list, never
      // user input, so this interpolation is safe.
      await pool.query(`ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "${col}" integer;`)
      ensured.push(col)
      if (!existing.has(col)) created.push(col)
    } catch (e) {
      errors.push({ column: col, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return Response.json({ ok: errors.length === 0, ensured: ensured.length, created, errors })
}
