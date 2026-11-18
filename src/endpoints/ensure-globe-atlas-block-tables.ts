/**
 * DB setup: Globe Atlas page-block tables — GET /api/provision-ops/ensure-globe-atlas-block-tables
 *
 * The Globe Atlas BLOCK (src/blocks/GlobeAtlas/config.ts) is a modular page block
 * registered in the Pages collection layout. It allows humans (via Payload Admin UI)
 * and AI agents (Antigravity & LEO) to place, reorder, and configure 3D Globe Atlases
 * (MLB Old World Architecture, UAP Declassified Incidents, Jon Levi Archive, etc.)
 * as native CMS components.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Idempotent.
 */
import type { PayloadHandler } from 'payload'

const STATEMENTS: string[] = [
  // ── enums (guarded with exception handling) ──────────────────────────
  `DO $$ BEGIN CREATE TYPE "enum_pages_blocks_globe_atlas_mode" AS ENUM('old_world', 'uap', 'jon_levi'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "enum__pages_v_blocks_globe_atlas_mode" AS ENUM('old_world', 'uap', 'jon_levi'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "enum_pages_blocks_globe_atlas_default_shader" AS ENUM('optical', 'flir', 'thermal', 'blueprint'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "enum__pages_v_blocks_globe_atlas_default_shader" AS ENUM('optical', 'flir', 'thermal', 'blueprint'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // ── live table: pages_blocks_globe_atlas ─────────────────────────────
  `CREATE TABLE IF NOT EXISTS "pages_blocks_globe_atlas" (
     "_order" integer NOT NULL,
     "_parent_id" integer NOT NULL,
     "_path" text NOT NULL,
     "id" varchar PRIMARY KEY NOT NULL,
     "mode" varchar DEFAULT 'old_world',
     "heading" varchar,
     "subheading" varchar,
     "show_audience_monitor" boolean DEFAULT false,
     "show_excavation_hero" boolean DEFAULT false,
     "show_globe_and_recon" boolean DEFAULT true,
     "default_shader" varchar DEFAULT 'optical',
     "block_name" varchar
   );`,
  `CREATE INDEX IF NOT EXISTS "pages_blocks_globe_atlas_order_idx" ON "pages_blocks_globe_atlas" ("_order");`,
  `CREATE INDEX IF NOT EXISTS "pages_blocks_globe_atlas_parent_id_idx" ON "pages_blocks_globe_atlas" ("_parent_id");`,
  `CREATE INDEX IF NOT EXISTS "pages_blocks_globe_atlas_path_idx" ON "pages_blocks_globe_atlas" ("_path");`,
  `DO $$ BEGIN
     ALTER TABLE "pages_blocks_globe_atlas" ADD CONSTRAINT "pages_blocks_globe_atlas_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // ── versioned table: _pages_v_blocks_globe_atlas ────────────────────
  `CREATE SEQUENCE IF NOT EXISTS "_pages_v_blocks_globe_atlas_id_seq";`,
  `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_globe_atlas" (
     "_order" integer NOT NULL,
     "_parent_id" integer NOT NULL,
     "_path" text NOT NULL,
     "id" integer PRIMARY KEY DEFAULT nextval('_pages_v_blocks_globe_atlas_id_seq') NOT NULL,
     "mode" varchar DEFAULT 'old_world',
     "heading" varchar,
     "subheading" varchar,
     "show_audience_monitor" boolean DEFAULT false,
     "show_excavation_hero" boolean DEFAULT false,
     "show_globe_and_recon" boolean DEFAULT true,
     "default_shader" varchar DEFAULT 'optical',
     "_uuid" varchar,
     "block_name" varchar
   );`,
  `ALTER SEQUENCE "_pages_v_blocks_globe_atlas_id_seq" OWNED BY "_pages_v_blocks_globe_atlas"."id";`,
  `CREATE INDEX IF NOT EXISTS "_pages_v_blocks_globe_atlas_order_idx" ON "_pages_v_blocks_globe_atlas" ("_order");`,
  `CREATE INDEX IF NOT EXISTS "_pages_v_blocks_globe_atlas_parent_id_idx" ON "_pages_v_blocks_globe_atlas" ("_parent_id");`,
  `CREATE INDEX IF NOT EXISTS "_pages_v_blocks_globe_atlas_path_idx" ON "_pages_v_blocks_globe_atlas" ("_path");`,
  `DO $$ BEGIN
     ALTER TABLE "_pages_v_blocks_globe_atlas" ADD CONSTRAINT "_pages_v_blocks_globe_atlas_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
]

export const ensureGlobeAtlasBlockTablesHandler: PayloadHandler = async (req) => {
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

  const db = payload.db
  const executed: string[] = []
  const errors: Array<{ statement: string; error: string }> = []

  for (const sql of STATEMENTS) {
    try {
      if (typeof (db as { execute?: (query: unknown) => Promise<unknown> }).execute === 'function') {
        await (db as { execute: (query: unknown) => Promise<unknown> }).execute({ sql })
      } else if (typeof (db?.drizzle as { execute?: (query: unknown) => Promise<unknown> })?.execute === 'function') {
        const { sql: drizzleSql } = await import('drizzle-orm')
        await (db.drizzle as { execute: (query: unknown) => Promise<unknown> }).execute(drizzleSql.raw(sql))
      }
      executed.push(sql.trim().slice(0, 60) + '...')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push({ statement: sql.trim().slice(0, 60) + '...', error: msg })
    }
  }

  return Response.json({
    success: errors.length === 0,
    tables: ['pages_blocks_globe_atlas', '_pages_v_blocks_globe_atlas'],
    executedCount: executed.length,
    errors,
  })
}
