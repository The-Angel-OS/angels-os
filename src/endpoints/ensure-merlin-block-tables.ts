/**
 * DB setup: Merlin Control page-block tables — GET /api/provision-ops/ensure-merlin-block-tables
 *
 * The Merlin Control BLOCK is a NET-NEW page block. Registering it in the Pages config
 * makes Payload's schema expect `pages_blocks_merlin_control` (+ the versioned
 * `_pages_v_blocks_merlin_control`); prod runs no push/migrations, so without these
 * tables EVERY `pages` query that materializes blocks fails → public pages fall back to
 * the default page AND /dashboard/pages errors. This idempotently creates both tables to
 * match what Payload generates for slug `merlinControl` (Payload snake_cases the slug:
 * merlinControl → merlin_control, verified against featuredEndeavors → featured_endeavors).
 *
 * Fields (config.ts): endeavor (text→varchar), showNav (checkbox→boolean show_nav),
 * heading (text→varchar).
 *
 * ⚠️ RULE (learned the hard way 2026-06-14): a net-new page block needs its block tables
 * on prod BEFORE the config referencing it deploys. Run this on EVERY node (both DBs)
 * that will register the Merlin block — then deploy the registration.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Idempotent.
 * @see src/endpoints/ensure-membership-block-tables.ts
 */
import type { PayloadHandler } from 'payload'

const STATEMENTS: string[] = [
  // live table (id = varchar PK, matches sibling blocks like pages_blocks_membership)
  `CREATE TABLE IF NOT EXISTS "pages_blocks_merlin_control" (
     "_order" integer NOT NULL,
     "_parent_id" integer NOT NULL,
     "_path" text NOT NULL,
     "id" varchar PRIMARY KEY NOT NULL,
     "endeavor" varchar,
     "show_nav" boolean DEFAULT true,
     "heading" varchar,
     "block_name" varchar
   );`,
  `CREATE INDEX IF NOT EXISTS "pages_blocks_merlin_control_order_idx" ON "pages_blocks_merlin_control" ("_order");`,
  `CREATE INDEX IF NOT EXISTS "pages_blocks_merlin_control_parent_id_idx" ON "pages_blocks_merlin_control" ("_parent_id");`,
  `CREATE INDEX IF NOT EXISTS "pages_blocks_merlin_control_path_idx" ON "pages_blocks_merlin_control" ("_path");`,
  `DO $$ BEGIN
     ALTER TABLE "pages_blocks_merlin_control" ADD CONSTRAINT "pages_blocks_merlin_control_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  // versioned (_pages_v) table (id = serial PK, + _uuid)
  `CREATE SEQUENCE IF NOT EXISTS "_pages_v_blocks_merlin_control_id_seq";`,
  `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_merlin_control" (
     "_order" integer NOT NULL,
     "_parent_id" integer NOT NULL,
     "_path" text NOT NULL,
     "id" integer PRIMARY KEY DEFAULT nextval('_pages_v_blocks_merlin_control_id_seq') NOT NULL,
     "endeavor" varchar,
     "show_nav" boolean DEFAULT true,
     "heading" varchar,
     "_uuid" varchar,
     "block_name" varchar
   );`,
  `ALTER SEQUENCE "_pages_v_blocks_merlin_control_id_seq" OWNED BY "_pages_v_blocks_merlin_control"."id";`,
  `CREATE INDEX IF NOT EXISTS "_pages_v_blocks_merlin_control_order_idx" ON "_pages_v_blocks_merlin_control" ("_order");`,
  `CREATE INDEX IF NOT EXISTS "_pages_v_blocks_merlin_control_parent_id_idx" ON "_pages_v_blocks_merlin_control" ("_parent_id");`,
  `CREATE INDEX IF NOT EXISTS "_pages_v_blocks_merlin_control_path_idx" ON "_pages_v_blocks_merlin_control" ("_path");`,
  `DO $$ BEGIN
     ALTER TABLE "_pages_v_blocks_merlin_control" ADD CONSTRAINT "_pages_v_blocks_merlin_control_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
]

export const ensureMerlinBlockTablesHandler: PayloadHandler = async (req) => {
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
  let tablesExist = false
  try {
    const res = await pool.query(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name IN ('pages_blocks_merlin_control','_pages_v_blocks_merlin_control')`,
    )
    tablesExist = (res.rows?.[0]?.n ?? 0) === 2
  } catch { /* best-effort */ }

  return Response.json({ ok: errors.length === 0, ran: ran.length, tablesExist, errors })
}
