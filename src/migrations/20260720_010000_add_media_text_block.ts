import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the MediaText block tables for pages/posts/products (all versioned, so each
 * needs a main `<c>_blocks_media_text` + a version `_<c>_v_blocks_media_text`).
 *
 * Hand-written + scoped (dodges unrelated payload_mcp_* auto-gen drift). All fields
 * are scalar so this is a plain column list. Idempotent (IF NOT EXISTS). Structure
 * mirrors the GoogleReviews block migration.
 */
const COLLECTIONS = ['pages', 'posts', 'products'] as const

const FIELDS = `
  "eyebrow" varchar,
  "heading" varchar,
  "body" varchar,
  "video_url" varchar,
  "caption" varchar,
  "video_on_right" boolean DEFAULT true,
  "cta_label" varchar,
  "cta_url" varchar`

function ddl(): string {
  let out = ''
  for (const c of COLLECTIONS) {
    out += `
      CREATE TABLE IF NOT EXISTS "${c}_blocks_media_text" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "_path" text NOT NULL,
        "id" varchar PRIMARY KEY NOT NULL,${FIELDS},
        "block_name" varchar,
        CONSTRAINT "${c}_blocks_media_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "${c}"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "${c}_blocks_media_text_order_idx" ON "${c}_blocks_media_text" ("_order");
      CREATE INDEX IF NOT EXISTS "${c}_blocks_media_text_parent_id_idx" ON "${c}_blocks_media_text" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "${c}_blocks_media_text_path_idx" ON "${c}_blocks_media_text" ("_path");

      CREATE TABLE IF NOT EXISTS "_${c}_v_blocks_media_text" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "_path" text NOT NULL,
        "id" serial PRIMARY KEY,${FIELDS},
        "_uuid" varchar,
        "block_name" varchar,
        CONSTRAINT "_${c}_v_blocks_media_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "_${c}_v"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "_${c}_v_blocks_media_text_order_idx" ON "_${c}_v_blocks_media_text" ("_order");
      CREATE INDEX IF NOT EXISTS "_${c}_v_blocks_media_text_parent_id_idx" ON "_${c}_v_blocks_media_text" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "_${c}_v_blocks_media_text_path_idx" ON "_${c}_v_blocks_media_text" ("_path");
    `
  }
  return out
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(ddl()))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  let out = ''
  for (const c of COLLECTIONS) {
    out += `
      DROP TABLE IF EXISTS "${c}_blocks_media_text" CASCADE;
      DROP TABLE IF EXISTS "_${c}_v_blocks_media_text" CASCADE;
    `
  }
  await db.execute(sql.raw(out))
}
