import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Tenant-wide trust badges — configured once, read by every TrustRow block.
 *
 * A group field flattens onto the parent table (`trust_badges_footnote`); the
 * array inside it gets its own table. @see src/collections/Tenants/index.ts
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        CREATE TYPE "enum_tenants_trust_badges_items_icon" AS ENUM
          ('shield','rosette','return','truck','lock','support','star');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "trust_badges_footnote" varchar;

      CREATE TABLE IF NOT EXISTS "tenants_trust_badges_items" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "id" varchar NOT NULL,
        "icon" "enum_tenants_trust_badges_items_icon" DEFAULT 'shield',
        "label" varchar,
        "detail" varchar,
        CONSTRAINT "tenants_trust_badges_items_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "tenants_trust_badges_items_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "tenants"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "tenants_trust_badges_items_order_idx"
        ON "tenants_trust_badges_items" ("_order");
      CREATE INDEX IF NOT EXISTS "tenants_trust_badges_items_parent_id_idx"
        ON "tenants_trust_badges_items" ("_parent_id");
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DROP TABLE IF EXISTS "tenants_trust_badges_items";
      ALTER TABLE "tenants" DROP COLUMN IF EXISTS "trust_badges_footnote";
      DROP TYPE IF EXISTS "enum_tenants_trust_badges_items_icon";
    `),
  )
}
