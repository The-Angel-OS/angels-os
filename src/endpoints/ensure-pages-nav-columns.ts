/**
 * DB setup: pages nav + nested-docs columns — GET /api/provision-ops/ensure-pages-nav-columns
 *
 * Prod runs neither Payload push nor deploy-time migrations, so new Pages fields
 * must be provisioned explicitly BEFORE the config that references them deploys —
 * otherwise every Pages query (home + all pages) errors on the missing columns,
 * which on a tenant domain reads as a site outage. This adds:
 *   - pages.show_in_nav / nav_order / nav_label  (Slice-1 nav control)
 *   - pages.parent_id                            (nested-docs `parent`)
 *   - pages_breadcrumbs table                    (nested-docs `breadcrumbs` array)
 * Idempotent. Run on EVERY prod DB (angels + kendev) before deploying the
 * nested-docs config. Pair with db-repair-locks (adds pages-related rels cols).
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>.
 * @see src/endpoints/ensure-services-table.ts  @see src/plugins/index.ts (nestedDocsPlugin)
 */
import type { PayloadHandler } from 'payload'

const STATEMENTS: string[] = [
  // ── Slice 1: nav-control scalar columns ──
  `ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "show_in_nav" boolean DEFAULT true;`,
  `ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "nav_order" numeric;`,
  `ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "nav_label" varchar;`,
  // ── nested-docs: parent relationship ──
  `ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "parent_id" integer;`,
  `CREATE INDEX IF NOT EXISTS "pages_parent_idx" ON "pages" ("parent_id");`,
  // ── nested-docs: breadcrumbs array table (Payload array convention:
  //    _order/_parent_id/id + the array's own fields doc_id/url/label) ──
  `CREATE TABLE IF NOT EXISTS "pages_breadcrumbs" (
     "_order" integer NOT NULL,
     "_parent_id" integer NOT NULL,
     "id" varchar PRIMARY KEY NOT NULL,
     "doc_id" integer,
     "url" varchar,
     "label" varchar
   );`,
  `CREATE INDEX IF NOT EXISTS "pages_breadcrumbs_order_idx" ON "pages_breadcrumbs" ("_order");`,
  `CREATE INDEX IF NOT EXISTS "pages_breadcrumbs_parent_id_idx" ON "pages_breadcrumbs" ("_parent_id");`,
  `CREATE INDEX IF NOT EXISTS "pages_breadcrumbs_doc_idx" ON "pages_breadcrumbs" ("doc_id");`,
]

export const ensurePagesNavColumnsHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(user && ((user as { roles?: string[] }).roles || []).includes('super_admin'))
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = (payload.db as any)?.pool
  if (!pool?.query) return Response.json({ error: 'no pg pool on payload.db' }, { status: 500 })

  const ran: number[] = []
  const errors: Array<{ i: number; error: string }> = []
  for (let i = 0; i < STATEMENTS.length; i++) {
    try { await pool.query(STATEMENTS[i]); ran.push(i) } catch (e) {
      errors.push({ i, error: e instanceof Error ? e.message : String(e) })
    }
  }

  // Report what now exists so the caller can confirm before deploying the config.
  const have: Record<string, boolean> = {}
  try {
    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name='pages' AND column_name IN ('show_in_nav','nav_order','nav_label','parent_id')`,
    )
    for (const r of cols.rows) have[r.column_name] = true
    const tbl = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name='pages_breadcrumbs'`)
    have['pages_breadcrumbs'] = tbl.rows.length > 0
  } catch { /* best-effort */ }

  return Response.json({ ok: errors.length === 0, ran: ran.length, have, errors })
}
