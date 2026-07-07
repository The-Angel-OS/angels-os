/**
 * DB setup: Gallery block tables — GET /api/provision-ops/ensure-gallery-block-tables
 *
 * The Gallery BLOCK (src/blocks/Gallery/config.ts) is registered in the layout of
 * BOTH Pages and Posts. It's a net-new block with a nested `images` array, so
 * Payload's schema expects FOUR tables + two enums PER collection; prod runs no
 * push/migrations, so without them every query that materializes that collection's
 * blocks fails → public pages fall back to default AND /dashboard/{pages,posts} errors.
 *
 * DDL is derived EXACTLY from the live schema of analogous tables (carousel/content
 * columns/events_gallery) and is identical across collections modulo the table-name
 * prefix + FK target — so we GENERATE it per collection instead of duplicating it.
 *   - live block wrapper : id varchar PK, has _path + block_name, _parent_id → <coll>
 *   - nested images array: id varchar PK, _parent_id VARCHAR → block id, no _path
 *   - versioned variants : _<coll>_v_* with serial PKs + _uuid, _parent_id → _<coll>_v
 *
 * ⚠️ RULE: a net-new block needs its tables on prod BEFORE the config referencing it
 * deploys. Run this on EVERY node (both DBs) that registers the Gallery block.
 *
 * Query: ?collection=pages|posts|all (default all). Auth: super_admin OR ?key=<CRON_SECRET>.
 * Idempotent. @see src/endpoints/ensure-merlin-block-tables.ts
 */
import type { PayloadHandler } from 'payload'

/** Collections that register the Gallery block (each needs its own block tables). */
export const GALLERY_COLLECTIONS = ['pages', 'posts'] as const
export type GalleryCollection = (typeof GALLERY_COLLECTIONS)[number]

/**
 * Generate the full DDL for one collection's Gallery block tables. `base` is the
 * collection slug (pages/posts); the versioned table is `_<base>_v`. Every name and
 * FK target is derived from `base`, so pages/posts differ only by that token.
 */
export function galleryStatements(base: GalleryCollection): string[] {
  const v = `_${base}_v`
  return [
    // ── enums (CREATE TYPE has no IF NOT EXISTS → guard on duplicate_object) ──────
    `DO $$ BEGIN CREATE TYPE "enum_${base}_blocks_gallery_columns" AS ENUM('2', '3', '4'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    `DO $$ BEGIN CREATE TYPE "enum_${v}_blocks_gallery_columns" AS ENUM('2', '3', '4'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    // ── live: block wrapper (id = varchar PK, has _path + block_name) ────────────
    `CREATE TABLE IF NOT EXISTS "${base}_blocks_gallery" (
       "_order" integer NOT NULL,
       "_parent_id" integer NOT NULL,
       "_path" text NOT NULL,
       "id" varchar PRIMARY KEY NOT NULL,
       "heading" varchar,
       "columns" "enum_${base}_blocks_gallery_columns" DEFAULT '3',
       "block_name" varchar
     );`,
    `CREATE INDEX IF NOT EXISTS "${base}_blocks_gallery_order_idx" ON "${base}_blocks_gallery" ("_order");`,
    `CREATE INDEX IF NOT EXISTS "${base}_blocks_gallery_parent_id_idx" ON "${base}_blocks_gallery" ("_parent_id");`,
    `CREATE INDEX IF NOT EXISTS "${base}_blocks_gallery_path_idx" ON "${base}_blocks_gallery" ("_path");`,
    `DO $$ BEGIN
       ALTER TABLE "${base}_blocks_gallery" ADD CONSTRAINT "${base}_blocks_gallery_parent_id_fk"
         FOREIGN KEY ("_parent_id") REFERENCES "${base}"("id") ON DELETE CASCADE;
     EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    // ── live: nested images array (id varchar PK, _parent_id VARCHAR → block id) ──
    `CREATE TABLE IF NOT EXISTS "${base}_blocks_gallery_images" (
       "_order" integer NOT NULL,
       "_parent_id" varchar NOT NULL,
       "id" varchar PRIMARY KEY NOT NULL,
       "image_id" integer NOT NULL
     );`,
    `CREATE INDEX IF NOT EXISTS "${base}_blocks_gallery_images_order_idx" ON "${base}_blocks_gallery_images" ("_order");`,
    `CREATE INDEX IF NOT EXISTS "${base}_blocks_gallery_images_parent_id_idx" ON "${base}_blocks_gallery_images" ("_parent_id");`,
    `CREATE INDEX IF NOT EXISTS "${base}_blocks_gallery_images_image_idx" ON "${base}_blocks_gallery_images" ("image_id");`,
    `DO $$ BEGIN
       ALTER TABLE "${base}_blocks_gallery_images" ADD CONSTRAINT "${base}_blocks_gallery_images_parent_id_fk"
         FOREIGN KEY ("_parent_id") REFERENCES "${base}_blocks_gallery"("id") ON DELETE CASCADE;
     EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    `DO $$ BEGIN
       ALTER TABLE "${base}_blocks_gallery_images" ADD CONSTRAINT "${base}_blocks_gallery_images_image_id_media_id_fk"
         FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL;
     EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    // ── versioned: block wrapper (id = serial PK, + _uuid; _parent_id → _<coll>_v) ──
    `CREATE SEQUENCE IF NOT EXISTS "${v}_blocks_gallery_id_seq";`,
    `CREATE TABLE IF NOT EXISTS "${v}_blocks_gallery" (
       "_order" integer NOT NULL,
       "_parent_id" integer NOT NULL,
       "_path" text NOT NULL,
       "id" integer PRIMARY KEY DEFAULT nextval('${v}_blocks_gallery_id_seq') NOT NULL,
       "heading" varchar,
       "columns" "enum_${v}_blocks_gallery_columns" DEFAULT '3',
       "_uuid" varchar,
       "block_name" varchar
     );`,
    `ALTER SEQUENCE "${v}_blocks_gallery_id_seq" OWNED BY "${v}_blocks_gallery"."id";`,
    `CREATE INDEX IF NOT EXISTS "${v}_blocks_gallery_order_idx" ON "${v}_blocks_gallery" ("_order");`,
    `CREATE INDEX IF NOT EXISTS "${v}_blocks_gallery_parent_id_idx" ON "${v}_blocks_gallery" ("_parent_id");`,
    `CREATE INDEX IF NOT EXISTS "${v}_blocks_gallery_path_idx" ON "${v}_blocks_gallery" ("_path");`,
    `DO $$ BEGIN
       ALTER TABLE "${v}_blocks_gallery" ADD CONSTRAINT "${v}_blocks_gallery_parent_id_fk"
         FOREIGN KEY ("_parent_id") REFERENCES "${v}"("id") ON DELETE CASCADE;
     EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    // ── versioned: nested images array (id serial PK, _parent_id INT → versioned block) ──
    `CREATE SEQUENCE IF NOT EXISTS "${v}_blocks_gallery_images_id_seq";`,
    `CREATE TABLE IF NOT EXISTS "${v}_blocks_gallery_images" (
       "_order" integer NOT NULL,
       "_parent_id" integer NOT NULL,
       "id" integer PRIMARY KEY DEFAULT nextval('${v}_blocks_gallery_images_id_seq') NOT NULL,
       "image_id" integer,
       "_uuid" varchar
     );`,
    `ALTER SEQUENCE "${v}_blocks_gallery_images_id_seq" OWNED BY "${v}_blocks_gallery_images"."id";`,
    `CREATE INDEX IF NOT EXISTS "${v}_blocks_gallery_images_order_idx" ON "${v}_blocks_gallery_images" ("_order");`,
    `CREATE INDEX IF NOT EXISTS "${v}_blocks_gallery_images_parent_id_idx" ON "${v}_blocks_gallery_images" ("_parent_id");`,
    `CREATE INDEX IF NOT EXISTS "${v}_blocks_gallery_images_image_idx" ON "${v}_blocks_gallery_images" ("image_id");`,
    `DO $$ BEGIN
       ALTER TABLE "${v}_blocks_gallery_images" ADD CONSTRAINT "${v}_blocks_gallery_images_parent_id_fk"
         FOREIGN KEY ("_parent_id") REFERENCES "${v}_blocks_gallery"("id") ON DELETE CASCADE;
     EXCEPTION WHEN duplicate_object THEN null; END $$;`,
    `DO $$ BEGIN
       ALTER TABLE "${v}_blocks_gallery_images" ADD CONSTRAINT "${v}_blocks_gallery_images_image_id_media_id_fk"
         FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL;
     EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  ]
}

function requiredTables(base: GalleryCollection): string[] {
  return [
    `${base}_blocks_gallery`,
    `${base}_blocks_gallery_images`,
    `_${base}_v_blocks_gallery`,
    `_${base}_v_blocks_gallery_images`,
  ]
}

/** Back-compat: the original Pages-only export (some callers/tests import it). */
export const STATEMENTS: string[] = galleryStatements('pages')

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

  // Which collections to ensure (default: all that register the block).
  const requested = (url.searchParams.get('collection') || 'all').toLowerCase()
  const collections: GalleryCollection[] =
    requested === 'all'
      ? [...GALLERY_COLLECTIONS]
      : GALLERY_COLLECTIONS.filter((c) => c === requested)
  if (collections.length === 0) {
    return Response.json({ error: `collection must be one of: all, ${GALLERY_COLLECTIONS.join(', ')}` }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = (payload.db as any)?.pool
  if (!pool?.query) return Response.json({ error: 'no pg pool on payload.db' }, { status: 500 })

  const results: Record<string, unknown> = {}
  let allOk = true

  for (const base of collections) {
    const statements = galleryStatements(base)
    const ran: number[] = []
    const errors: Array<{ i: number; error: string }> = []
    for (let i = 0; i < statements.length; i++) {
      try { await pool.query(statements[i]); ran.push(i) } catch (e) {
        errors.push({ i, error: e instanceof Error ? e.message : String(e) })
      }
    }
    let tablesExist = false
    try {
      const req_ = requiredTables(base)
      const res = await pool.query(
        `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = ANY($1)`,
        [req_],
      )
      tablesExist = (res.rows?.[0]?.n ?? 0) === req_.length
    } catch { /* best-effort */ }
    if (errors.length > 0 || !tablesExist) allOk = false
    results[base] = { ran: ran.length, tablesExist, errors }
  }

  return Response.json({ ok: allOk, collections, results })
}
