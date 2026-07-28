import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * The `showcase` block — gradient band with image cards.
 *
 * Block table, its items array, and the `_pages_v_` twin of each because Pages
 * has drafts. @see src/blocks/Showcase/config.ts
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        CREATE TYPE "enum_pages_blocks_showcase_background" AS ENUM ('brand','aurora','dark','none');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE "enum__pages_v_blocks_showcase_background" AS ENUM ('brand','aurora','dark','none');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE TABLE IF NOT EXISTS "pages_blocks_showcase" (
        "_order" integer NOT NULL, "_parent_id" integer NOT NULL, "_path" text NOT NULL,
        "id" varchar NOT NULL, "heading" varchar, "statement" varchar,
        "background" "enum_pages_blocks_showcase_background" DEFAULT 'brand',
        "block_name" varchar,
        CONSTRAINT "pages_blocks_showcase_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "pages_blocks_showcase_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "pages_blocks_showcase_order_idx" ON "pages_blocks_showcase" ("_order");
      CREATE INDEX IF NOT EXISTS "pages_blocks_showcase_parent_id_idx" ON "pages_blocks_showcase" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "pages_blocks_showcase_path_idx" ON "pages_blocks_showcase" ("_path");

      CREATE TABLE IF NOT EXISTS "pages_blocks_showcase_items" (
        "_order" integer NOT NULL, "_parent_id" varchar NOT NULL, "id" varchar NOT NULL,
        "image_id" integer, "caption" varchar, "url" varchar,
        CONSTRAINT "pages_blocks_showcase_items_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "pages_blocks_showcase_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "pages_blocks_showcase"("id") ON DELETE CASCADE,
        CONSTRAINT "pages_blocks_showcase_items_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS "pages_blocks_showcase_items_order_idx" ON "pages_blocks_showcase_items" ("_order");
      CREATE INDEX IF NOT EXISTS "pages_blocks_showcase_items_parent_id_idx" ON "pages_blocks_showcase_items" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "pages_blocks_showcase_items_image_idx" ON "pages_blocks_showcase_items" ("image_id");

      CREATE TABLE IF NOT EXISTS "_pages_v_blocks_showcase" (
        "_order" integer NOT NULL, "_parent_id" integer NOT NULL, "_path" text NOT NULL,
        "id" serial PRIMARY KEY, "heading" varchar, "statement" varchar,
        "background" "enum__pages_v_blocks_showcase_background" DEFAULT 'brand',
        "_uuid" varchar, "block_name" varchar,
        CONSTRAINT "_pages_v_blocks_showcase_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_showcase_order_idx" ON "_pages_v_blocks_showcase" ("_order");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_showcase_parent_id_idx" ON "_pages_v_blocks_showcase" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_showcase_path_idx" ON "_pages_v_blocks_showcase" ("_path");

      CREATE TABLE IF NOT EXISTS "_pages_v_blocks_showcase_items" (
        "_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" serial PRIMARY KEY,
        "image_id" integer, "caption" varchar, "url" varchar, "_uuid" varchar,
        CONSTRAINT "_pages_v_blocks_showcase_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "_pages_v_blocks_showcase"("id") ON DELETE CASCADE,
        CONSTRAINT "_pages_v_blocks_showcase_items_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_showcase_items_order_idx" ON "_pages_v_blocks_showcase_items" ("_order");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_showcase_items_parent_id_idx" ON "_pages_v_blocks_showcase_items" ("_parent_id");
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DROP TABLE IF EXISTS "_pages_v_blocks_showcase_items";
      DROP TABLE IF EXISTS "_pages_v_blocks_showcase";
      DROP TABLE IF EXISTS "pages_blocks_showcase_items";
      DROP TABLE IF EXISTS "pages_blocks_showcase";
      DROP TYPE IF EXISTS "enum__pages_v_blocks_showcase_background";
      DROP TYPE IF EXISTS "enum_pages_blocks_showcase_background";
    `),
  )
}
