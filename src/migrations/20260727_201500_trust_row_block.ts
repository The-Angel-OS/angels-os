import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * The `trustRow` block on Pages.
 *
 * A new block is a schema change, and a block with an ARRAY field is three
 * tables, not one: the block, its `items` array, and the `_pages_v_` twin of
 * each because Pages has drafts. Miss the twin and reads work until something
 * touches a draft. @see src/blocks/TrustRow/config.ts
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        CREATE TYPE "enum_pages_blocks_trust_row_items_icon" AS ENUM
          ('shield','rosette','return','truck','lock','support','star');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE "enum__pages_v_blocks_trust_row_items_icon" AS ENUM
          ('shield','rosette','return','truck','lock','support','star');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE TABLE IF NOT EXISTS "pages_blocks_trust_row" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "_path" text NOT NULL,
        "id" varchar NOT NULL,
        "heading" varchar,
        "footnote" varchar,
        "block_name" varchar,
        CONSTRAINT "pages_blocks_trust_row_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "pages_blocks_trust_row_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "pages_blocks_trust_row_order_idx" ON "pages_blocks_trust_row" ("_order");
      CREATE INDEX IF NOT EXISTS "pages_blocks_trust_row_parent_id_idx" ON "pages_blocks_trust_row" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "pages_blocks_trust_row_path_idx" ON "pages_blocks_trust_row" ("_path");

      CREATE TABLE IF NOT EXISTS "pages_blocks_trust_row_items" (
        "_order" integer NOT NULL,
        "_parent_id" varchar NOT NULL,
        "id" varchar NOT NULL,
        "icon" "enum_pages_blocks_trust_row_items_icon" DEFAULT 'shield',
        "label" varchar,
        "detail" varchar,
        CONSTRAINT "pages_blocks_trust_row_items_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "pages_blocks_trust_row_items_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "pages_blocks_trust_row"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "pages_blocks_trust_row_items_order_idx" ON "pages_blocks_trust_row_items" ("_order");
      CREATE INDEX IF NOT EXISTS "pages_blocks_trust_row_items_parent_id_idx" ON "pages_blocks_trust_row_items" ("_parent_id");

      CREATE TABLE IF NOT EXISTS "_pages_v_blocks_trust_row" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "_path" text NOT NULL,
        "id" serial PRIMARY KEY,
        "heading" varchar,
        "footnote" varchar,
        "_uuid" varchar,
        "block_name" varchar,
        CONSTRAINT "_pages_v_blocks_trust_row_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_trust_row_order_idx" ON "_pages_v_blocks_trust_row" ("_order");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_trust_row_parent_id_idx" ON "_pages_v_blocks_trust_row" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_trust_row_path_idx" ON "_pages_v_blocks_trust_row" ("_path");

      CREATE TABLE IF NOT EXISTS "_pages_v_blocks_trust_row_items" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "id" serial PRIMARY KEY,
        "icon" "enum__pages_v_blocks_trust_row_items_icon" DEFAULT 'shield',
        "label" varchar,
        "detail" varchar,
        "_uuid" varchar,
        CONSTRAINT "_pages_v_blocks_trust_row_items_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "_pages_v_blocks_trust_row"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_trust_row_items_order_idx" ON "_pages_v_blocks_trust_row_items" ("_order");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_trust_row_items_parent_id_idx" ON "_pages_v_blocks_trust_row_items" ("_parent_id");
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DROP TABLE IF EXISTS "_pages_v_blocks_trust_row_items";
      DROP TABLE IF EXISTS "_pages_v_blocks_trust_row";
      DROP TABLE IF EXISTS "pages_blocks_trust_row_items";
      DROP TABLE IF EXISTS "pages_blocks_trust_row";
      DROP TYPE IF EXISTS "enum__pages_v_blocks_trust_row_items_icon";
      DROP TYPE IF EXISTS "enum_pages_blocks_trust_row_items_icon";
    `),
  )
}
