import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * The `ticketForm` block on Pages — the customer-facing warranty / return form.
 *
 * A NEW BLOCK IS A SCHEMA CHANGE. Payload gives each block its own table, and
 * Pages has drafts, so it needs BOTH the published table and the `_pages_v_`
 * versions twin. Without the twin, reading any page works right up until
 * something touches a draft.
 *
 * Shape derived from the existing `pages_blocks_media_text` pair rather than
 * written from memory — same columns, same five indexes, same parent FK, and the
 * versions table's `id` is a serial with a `_uuid` column where the published
 * table's `id` is the block's own varchar.
 *
 * @see src/blocks/TicketForm/config.ts
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        CREATE TYPE "enum_pages_blocks_ticket_form_type" AS ENUM ('warranty','return','support','question');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        CREATE TYPE "enum__pages_v_blocks_ticket_form_type" AS ENUM ('warranty','return','support','question');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE TABLE IF NOT EXISTS "pages_blocks_ticket_form" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "_path" text NOT NULL,
        "id" varchar NOT NULL,
        "type" "enum_pages_blocks_ticket_form_type" DEFAULT 'warranty',
        "heading" varchar,
        "intro" varchar,
        "show_order_fields" boolean DEFAULT true,
        "confirmation" varchar,
        "block_name" varchar,
        CONSTRAINT "pages_blocks_ticket_form_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "pages_blocks_ticket_form_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "pages_blocks_ticket_form_order_idx" ON "pages_blocks_ticket_form" ("_order");
      CREATE INDEX IF NOT EXISTS "pages_blocks_ticket_form_parent_id_idx" ON "pages_blocks_ticket_form" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "pages_blocks_ticket_form_path_idx" ON "pages_blocks_ticket_form" ("_path");

      CREATE TABLE IF NOT EXISTS "_pages_v_blocks_ticket_form" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "_path" text NOT NULL,
        "id" serial PRIMARY KEY,
        "type" "enum__pages_v_blocks_ticket_form_type" DEFAULT 'warranty',
        "heading" varchar,
        "intro" varchar,
        "show_order_fields" boolean DEFAULT true,
        "confirmation" varchar,
        "_uuid" varchar,
        "block_name" varchar,
        CONSTRAINT "_pages_v_blocks_ticket_form_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_ticket_form_order_idx" ON "_pages_v_blocks_ticket_form" ("_order");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_ticket_form_parent_id_idx" ON "_pages_v_blocks_ticket_form" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_ticket_form_path_idx" ON "_pages_v_blocks_ticket_form" ("_path");
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DROP TABLE IF EXISTS "_pages_v_blocks_ticket_form";
      DROP TABLE IF EXISTS "pages_blocks_ticket_form";
      DROP TYPE IF EXISTS "enum__pages_v_blocks_ticket_form_type";
      DROP TYPE IF EXISTS "enum_pages_blocks_ticket_form_type";
    `),
  )
}
