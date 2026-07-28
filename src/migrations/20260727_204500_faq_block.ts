import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * The `faq` block on Pages — block table, its items array, and the `_pages_v_`
 * twin of each because Pages has drafts. @see src/blocks/Faq/config.ts
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      CREATE TABLE IF NOT EXISTS "pages_blocks_faq" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "_path" text NOT NULL,
        "id" varchar NOT NULL,
        "heading" varchar DEFAULT 'Frequently Asked Questions',
        "open_first" boolean DEFAULT true,
        "block_name" varchar,
        CONSTRAINT "pages_blocks_faq_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "pages_blocks_faq_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "pages_blocks_faq_order_idx" ON "pages_blocks_faq" ("_order");
      CREATE INDEX IF NOT EXISTS "pages_blocks_faq_parent_id_idx" ON "pages_blocks_faq" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "pages_blocks_faq_path_idx" ON "pages_blocks_faq" ("_path");

      CREATE TABLE IF NOT EXISTS "pages_blocks_faq_items" (
        "_order" integer NOT NULL,
        "_parent_id" varchar NOT NULL,
        "id" varchar NOT NULL,
        "question" varchar,
        "answer" varchar,
        CONSTRAINT "pages_blocks_faq_items_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "pages_blocks_faq_items_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "pages_blocks_faq"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "pages_blocks_faq_items_order_idx" ON "pages_blocks_faq_items" ("_order");
      CREATE INDEX IF NOT EXISTS "pages_blocks_faq_items_parent_id_idx" ON "pages_blocks_faq_items" ("_parent_id");

      CREATE TABLE IF NOT EXISTS "_pages_v_blocks_faq" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "_path" text NOT NULL,
        "id" serial PRIMARY KEY,
        "heading" varchar DEFAULT 'Frequently Asked Questions',
        "open_first" boolean DEFAULT true,
        "_uuid" varchar,
        "block_name" varchar,
        CONSTRAINT "_pages_v_blocks_faq_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_faq_order_idx" ON "_pages_v_blocks_faq" ("_order");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_faq_parent_id_idx" ON "_pages_v_blocks_faq" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_faq_path_idx" ON "_pages_v_blocks_faq" ("_path");

      CREATE TABLE IF NOT EXISTS "_pages_v_blocks_faq_items" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "id" serial PRIMARY KEY,
        "question" varchar,
        "answer" varchar,
        "_uuid" varchar,
        CONSTRAINT "_pages_v_blocks_faq_items_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "_pages_v_blocks_faq"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_faq_items_order_idx" ON "_pages_v_blocks_faq_items" ("_order");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_faq_items_parent_id_idx" ON "_pages_v_blocks_faq_items" ("_parent_id");
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DROP TABLE IF EXISTS "_pages_v_blocks_faq_items";
      DROP TABLE IF EXISTS "_pages_v_blocks_faq";
      DROP TABLE IF EXISTS "pages_blocks_faq_items";
      DROP TABLE IF EXISTS "pages_blocks_faq";
    `),
  )
}
