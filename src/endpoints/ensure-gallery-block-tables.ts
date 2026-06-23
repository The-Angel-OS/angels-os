/**
 * DB setup: Gallery page-block tables — GET /api/provision-ops/ensure-gallery-block-tables
 *
 * The Gallery BLOCK (src/blocks/Gallery/config.ts) is registered in Pages' layout. It's a
 * net-new block with a nested `images` array, so Payload's schema expects FOUR tables +
 * two enums; prod runs no push/migrations, so without them EVERY `pages` query that
 * materializes blocks fails → public pages fall back to default AND /dashboard/pages errors.
 *
 * DDL below is derived EXACTLY from the live schema of analogous tables:
 *   - block wrapper        ← pages_blocks_carousel / pages_blocks_membership
 *   - nested array in block ← pages_blocks_content_columns (note: _parent_id is VARCHAR
 *     live → the block's varchar id; INT in the versioned _pages_v_* variant; nested
 *     tables have NO _path / block_name)
 *   - upload + array image  ← events_gallery (image_id int FK media, image_idx index)
 *
 * ⚠️ RULE: a net-new page block needs its tables on prod BEFORE the config referencing it
 * deploys. Run this on EVERY node (both DBs) that registers the Gallery block, THEN deploy.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Idempotent.
 * @see src/endpoints/ensure-merlin-block-tables.ts
 */
import type { PayloadHandler } from 'payload'

export const STATEMENTS: string[] = [
  // ── enums (CREATE TYPE has no IF NOT EXISTS → guard on duplicate_object) ──────
  `DO $$ BEGIN CREATE TYPE "enum_pages_blocks_gallery_columns" AS ENUM('2', '3', '4'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE "enum__pages_v_blocks_gallery_columns" AS ENUM('2', '3', '4'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // ── live: block wrapper (id = varchar PK, has _path + block_name) ────────────
  `CREATE TABLE IF NOT EXISTS "pages_blocks_gallery" (
     "_order" integer NOT NULL,
     "_parent_id" integer NOT NULL,
     "_path" text NOT NULL,
     "id" varchar PRIMARY KEY NOT NULL,
     "heading" varchar,
     "columns" "enum_pages_blocks_gallery_columns" DEFAULT '3',
     "block_name" varchar
   );`,
  `CREATE INDEX IF NOT EXISTS "pages_blocks_gallery_order_idx" ON "pages_blocks_gallery" ("_order");`,
  `CREATE INDEX IF NOT EXISTS "pages_blocks_gallery_parent_id_idx" ON "pages_blocks_gallery" ("_parent_id");`,
  `CREATE INDEX IF NOT EXISTS "pages_blocks_gallery_path_idx" ON "pages_blocks_gallery" ("_path");`,
  `DO $$ BEGIN
     ALTER TABLE "pages_blocks_gallery" ADD CONSTRAINT "pages_blocks_gallery_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // ── live: nested images array (id varchar PK, _parent_id VARCHAR → block id, no _path) ──
  `CREATE TABLE IF NOT EXISTS "pages_blocks_gallery_images" (
     "_order" integer NOT NULL,
     "_parent_id" varchar NOT NULL,
     "id" varchar PRIMARY KEY NOT NULL,
     "image_id" integer NOT NULL
   );`,
  `CREATE INDEX IF NOT EXISTS "pages_blocks_gallery_images_order_idx" ON "pages_blocks_gallery_images" ("_order");`,
  `CREATE INDEX IF NOT EXISTS "pages_blocks_gallery_images_parent_id_idx" ON "pages_blocks_gallery_images" ("_parent_id");`,
  `CREATE INDEX IF NOT EXISTS "pages_blocks_gallery_images_image_idx" ON "pages_blocks_gallery_images" ("image_id");`,
  `DO $$ BEGIN
     ALTER TABLE "pages_blocks_gallery_images" ADD CONSTRAINT "pages_blocks_gallery_images_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "pages_blocks_gallery"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "pages_blocks_gallery_images" ADD CONSTRAINT "pages_blocks_gallery_images_image_id_media_id_fk"
       FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // ── versioned: block wrapper (id = serial PK, + _uuid; _parent_id → _pages_v) ──
  `CREATE SEQUENCE IF NOT EXISTS "_pages_v_blocks_gallery_id_seq";`,
  `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_gallery" (
     "_order" integer NOT NULL,
     "_parent_id" integer NOT NULL,
     "_path" text NOT NULL,
     "id" integer PRIMARY KEY DEFAULT nextval('_pages_v_blocks_gallery_id_seq') NOT NULL,
     "heading" varchar,
     "columns" "enum__pages_v_blocks_gallery_columns" DEFAULT '3',
     "_uuid" varchar,
     "block_name" varchar
   );`,
  `ALTER SEQUENCE "_pages_v_blocks_gallery_id_seq" OWNED BY "_pages_v_blocks_gallery"."id";`,
  `CREATE INDEX IF NOT EXISTS "_pages_v_blocks_gallery_order_idx" ON "_pages_v_blocks_gallery" ("_order");`,
  `CREATE INDEX IF NOT EXISTS "_pages_v_blocks_gallery_parent_id_idx" ON "_pages_v_blocks_gallery" ("_parent_id");`,
  `CREATE INDEX IF NOT EXISTS "_pages_v_blocks_gallery_path_idx" ON "_pages_v_blocks_gallery" ("_path");`,
  `DO $$ BEGIN
     ALTER TABLE "_pages_v_blocks_gallery" ADD CONSTRAINT "_pages_v_blocks_gallery_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,

  // ── versioned: nested images array (id serial PK, _parent_id INT → versioned block) ──
  `CREATE SEQUENCE IF NOT EXISTS "_pages_v_blocks_gallery_images_id_seq";`,
  `CREATE TABLE IF NOT EXISTS "_pages_v_blocks_gallery_images" (
     "_order" integer NOT NULL,
     "_parent_id" integer NOT NULL,
     "id" integer PRIMARY KEY DEFAULT nextval('_pages_v_blocks_gallery_images_id_seq') NOT NULL,
     "image_id" integer,
     "_uuid" varchar
   );`,
  `ALTER SEQUENCE "_pages_v_blocks_gallery_images_id_seq" OWNED BY "_pages_v_blocks_gallery_images"."id";`,
  `CREATE INDEX IF NOT EXISTS "_pages_v_blocks_gallery_images_order_idx" ON "_pages_v_blocks_gallery_images" ("_order");`,
  `CREATE INDEX IF NOT EXISTS "_pages_v_blocks_gallery_images_parent_id_idx" ON "_pages_v_blocks_gallery_images" ("_parent_id");`,
  `CREATE INDEX IF NOT EXISTS "_pages_v_blocks_gallery_images_image_idx" ON "_pages_v_blocks_gallery_images" ("image_id");`,
  `DO $$ BEGIN
     ALTER TABLE "_pages_v_blocks_gallery_images" ADD CONSTRAINT "_pages_v_blocks_gallery_images_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "_pages_v_blocks_gallery"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN
     ALTER TABLE "_pages_v_blocks_gallery_images" ADD CONSTRAINT "_pages_v_blocks_gallery_images_image_id_media_id_fk"
       FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
]

const REQUIRED_TABLES = [
  'pages_blocks_gallery',
  'pages_blocks_gallery_images',
  '_pages_v_blocks_gallery',
  '_pages_v_blocks_gallery_images',
]

export const ensureGalleryBlockTablesHandler: PayloadHandler = async (req) => {
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
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = ANY($1)`,
      [REQUIRED_TABLES],
    )
    tablesExist = (res.rows?.[0]?.n ?? 0) === REQUIRED_TABLES.length
  } catch { /* best-effort */ }

  return Response.json({ ok: errors.length === 0, ran: ran.length, tablesExist, errors })
}
