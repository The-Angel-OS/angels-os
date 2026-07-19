import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the GoogleReviews block tables for pages/posts/products (all versioned, so
 * each needs a main `<c>_blocks_google_reviews` + a version `_<c>_v_blocks_...`).
 *
 * Hand-written (not auto-generated) to stay SCOPED to this block — the auto
 * generator entangles with unrelated pre-existing payload_mcp_* drift. Idempotent
 * (IF NOT EXISTS) so it's safe whether applied by boot-migrate or already present.
 * Structure copied from the existing donation block tables (main = varchar id;
 * version = serial id + _uuid).
 */
const COLLECTIONS = ['pages', 'posts', 'products'] as const

const FIELDS = `
  "place_id" varchar,
  "heading" varchar,
  "max_reviews" numeric DEFAULT 5,
  "min_rating" numeric DEFAULT 4,
  "show_aggregate" boolean DEFAULT true`

function ddl(): string {
  let out = ''
  for (const c of COLLECTIONS) {
    // Main (published) table: varchar id, FK to <c>(id).
    out += `
      CREATE TABLE IF NOT EXISTS "${c}_blocks_google_reviews" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "_path" text NOT NULL,
        "id" varchar PRIMARY KEY NOT NULL,${FIELDS},
        "block_name" varchar,
        CONSTRAINT "${c}_blocks_google_reviews_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "${c}"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "${c}_blocks_google_reviews_order_idx" ON "${c}_blocks_google_reviews" ("_order");
      CREATE INDEX IF NOT EXISTS "${c}_blocks_google_reviews_parent_id_idx" ON "${c}_blocks_google_reviews" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "${c}_blocks_google_reviews_path_idx" ON "${c}_blocks_google_reviews" ("_path");

      CREATE TABLE IF NOT EXISTS "_${c}_v_blocks_google_reviews" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "_path" text NOT NULL,
        "id" serial PRIMARY KEY,${FIELDS},
        "_uuid" varchar,
        "block_name" varchar,
        CONSTRAINT "_${c}_v_blocks_google_reviews_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "_${c}_v"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "_${c}_v_blocks_google_reviews_order_idx" ON "_${c}_v_blocks_google_reviews" ("_order");
      CREATE INDEX IF NOT EXISTS "_${c}_v_blocks_google_reviews_parent_id_idx" ON "_${c}_v_blocks_google_reviews" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "_${c}_v_blocks_google_reviews_path_idx" ON "_${c}_v_blocks_google_reviews" ("_path");
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
      DROP TABLE IF EXISTS "${c}_blocks_google_reviews" CASCADE;
      DROP TABLE IF EXISTS "_${c}_v_blocks_google_reviews" CASCADE;
    `
  }
  await db.execute(sql.raw(out))
}
