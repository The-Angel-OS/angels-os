import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Rows, not columns: `payload_mcp_api_keys.payload_mcp_tool_*` → one list table.
 *
 * The migration two before this one added 169 boolean columns so the config and
 * the database would finally agree. This removes the reason those columns exist
 * at all — see the comment block in src/plugins/mcp.ts. Adding a LEO tool is a
 * code change again, not an ALTER TABLE.
 *
 * The drop is safe on this node because the table is EMPTY (0 keys, checked
 * 260813) and because tool access is computed from the caller's roles in
 * `overrideAuth` at request time — the columns were never read as the source of
 * truth. A node with keys already in use would need those checkboxes read into
 * `allowed_tools` first; there is no such node.
 *
 * `down` recreates the columns as booleans. It cannot recreate the values, and
 * there are none to recreate.
 */
const TOOL_COLUMNS_SQL = `
  SELECT column_name FROM information_schema.columns
  WHERE table_name = 'payload_mcp_api_keys' AND column_name LIKE 'payload\_mcp\_tool\_%'
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    -- Postgres puts EVERY hasMany-text field of a collection in one shared
    -- <table>_texts table, keyed by a path column — not a table per field. Getting
    -- this wrong is silent until the first query: the collection then 500s with
    -- relation "payload_mcp_api_keys_texts" does not exist.
    CREATE TABLE IF NOT EXISTS "payload_mcp_api_keys_texts" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "text" varchar
    );

    DO $$ BEGIN
      ALTER TABLE "payload_mcp_api_keys_texts"
        ADD CONSTRAINT "payload_mcp_api_keys_texts_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."payload_mcp_api_keys"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "payload_mcp_api_keys_texts_order_parent"
      ON "payload_mcp_api_keys_texts" USING btree ("order", "parent_id");

    -- Drop whatever per-tool columns this database happens to have, by pattern,
    -- so the migration is correct on a node that never received all 169.
    DO $$
    DECLARE col record;
    BEGIN
      FOR col IN ${sql.raw(`(${TOOL_COLUMNS_SQL})`)}
      LOOP
        EXECUTE format('ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS %I', col.column_name);
      END LOOP;
    END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "payload_mcp_api_keys_texts" CASCADE;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_leo_respond" boolean;
  `)
}
