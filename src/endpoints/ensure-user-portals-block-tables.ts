/**
 * DB setup: UserPortals page-block tables — GET/POST /api/provision-ops/ensure-user-portals-block-tables
 *
 * The UserPortals BLOCK (src/blocks/UserPortals/config.ts) is a modular page block
 * registered in the Pages collection layout so authorized users (creators and
 * platform admins) can see interactive portal cards anywhere a Content/Layout
 * page embeds it — replacing the hardcoded AlreadyOnboardedBanner in [slug]/page.tsx.
 *
 * 2-DEPLOY RULE: Deploy and execute this endpoint on prod BEFORE registering
 * `UserPortals` in `src/collections/Pages/index.ts`.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET> OR Authorization: Bearer <CRON_SECRET>.
 * Idempotent.
 */
import type { PayloadHandler } from 'payload'

export const USER_PORTALS_BLOCK_STATEMENTS: string[] = [
  // ── Enums (guarded with duplicate_object exception handling) ───────────
  `DO $$ BEGIN CREATE TYPE "enum_pages_blocks_user_portals_scope" AS ENUM('owned', 'all_for_admin'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "enum__pages_v_blocks_user_portals_scope" AS ENUM('owned', 'all_for_admin'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "enum_pages_blocks_user_portals_columns" AS ENUM('2', '3', '4'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "enum__pages_v_blocks_user_portals_columns" AS ENUM('2', '3', '4'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // ── Live table: pages_blocks_user_portals ──────────────────────────────
  `CREATE TABLE IF NOT EXISTS "pages_blocks_user_portals" (
     "_order" integer NOT NULL,
     "_parent_id" integer NOT NULL,
     "_path" text NOT NULL,
     "id" varchar PRIMARY KEY NOT NULL,
     "heading" varchar DEFAULT 'Your Portals',
     "subheading" varchar,
     "scope" "enum_pages_blocks_user_portals_scope" DEFAULT 'all_for_admin',
     "columns" "enum_pages_blocks_user_portals_columns" DEFAULT '3',
     "show_quota" boolean DEFAULT true,
     "show_filters" boolean DEFAULT true,
     "show_create_card" boolean DEFAULT true,
     "hide_when_anonymous" boolean DEFAULT true,
     "include_platform_tenant" boolean DEFAULT false,
     "block_name" varchar
   );`,
  `CREATE INDEX IF NOT EXISTS "pages_blocks_user_portals_order_idx" ON "pages_blocks_user_portals" ("_order");`,
  `CREATE INDEX IF NOT EXISTS "pages_blocks_user_portals_parent_id_idx" ON "pages_blocks_user_portals" ("_parent_id");`,
  `CREATE INDEX IF NOT EXISTS "pages_blocks_user_portals_path_idx" ON "pages_blocks_user_portals" ("_path");`,
  `DO $$ BEGIN
     ALTER TABLE "pages_blocks_user_portals" ADD CONSTRAINT "pages_blocks_user_portals_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // ── Versioned table: _pages_v_blocks_user_portals ──────────────────────
  `CREATE SEQUENCE IF NOT EXISTS "_pages_v_blocks_user_portals_id_seq";`,
  `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_user_portals" (
     "_order" integer NOT NULL,
     "_parent_id" integer NOT NULL,
     "_path" text NOT NULL,
     "id" integer PRIMARY KEY DEFAULT nextval('_pages_v_blocks_user_portals_id_seq') NOT NULL,
     "heading" varchar DEFAULT 'Your Portals',
     "subheading" varchar,
     "scope" "enum__pages_v_blocks_user_portals_scope" DEFAULT 'all_for_admin',
     "columns" "enum__pages_v_blocks_user_portals_columns" DEFAULT '3',
     "show_quota" boolean DEFAULT true,
     "show_filters" boolean DEFAULT true,
     "show_create_card" boolean DEFAULT true,
     "hide_when_anonymous" boolean DEFAULT true,
     "include_platform_tenant" boolean DEFAULT false,
     "_uuid" varchar,
     "block_name" varchar
   );`,
  `ALTER SEQUENCE "_pages_v_blocks_user_portals_id_seq" OWNED BY "_pages_v_blocks_user_portals"."id";`,
  `CREATE INDEX IF NOT EXISTS "_pages_v_blocks_user_portals_order_idx" ON "_pages_v_blocks_user_portals" ("_order");`,
  `CREATE INDEX IF NOT EXISTS "_pages_v_blocks_user_portals_parent_id_idx" ON "_pages_v_blocks_user_portals" ("_parent_id");`,
  `CREATE INDEX IF NOT EXISTS "_pages_v_blocks_user_portals_path_idx" ON "_pages_v_blocks_user_portals" ("_path");`,
  `DO $$ BEGIN
     ALTER TABLE "_pages_v_blocks_user_portals" ADD CONSTRAINT "_pages_v_blocks_user_portals_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
]

export const ensureUserPortalsBlockTablesHandler: PayloadHandler = async (req) => {
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
  const errors: Array<{ i: number; statement: string; error: string }> = []
  for (let i = 0; i < USER_PORTALS_BLOCK_STATEMENTS.length; i++) {
    const stmt = USER_PORTALS_BLOCK_STATEMENTS[i]!
    try {
      await pool.query(stmt)
      ran.push(i)
    } catch (e) {
      errors.push({
        i,
        statement: stmt.trim().slice(0, 72),
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  let tablesExist = false
  try {
    const res = await pool.query(
      `SELECT count(*)::int AS n FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('pages_blocks_user_portals','_pages_v_blocks_user_portals')`,
    )
    tablesExist = (res.rows?.[0]?.n ?? 0) === 2
  } catch {
    /* best-effort */
  }

  return Response.json({
    ok: errors.length === 0 && tablesExist,
    ran: ran.length,
    tables: ['pages_blocks_user_portals', '_pages_v_blocks_user_portals'],
    tablesExist,
    errors,
  })
}
