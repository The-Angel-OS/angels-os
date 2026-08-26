import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Works: who may read this, and what unlocks it.
 *
 * `access` reuses the PAGE_ACCESS_OPTIONS vocabulary plus one value, `purchase`,
 * so nobody has to learn two gating systems. `product` is what a person buys to
 * get in — the first thing on this platform to read Orders for access.
 *
 * Entitlement itself is DERIVED, never stored: there is no enrollments table,
 * because an enrolment row is a cache of a question a paid order already answers.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        CREATE TYPE "enum_works_access" AS ENUM ('public', 'authenticated', 'members', 'good_standing', 'purchase');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "access" "enum_works_access" DEFAULT 'public';
      ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "product_id" integer
        REFERENCES "products"("id") ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS "works_product_idx" ON "works" ("product_id");

      UPDATE "works" SET "access" = 'public' WHERE "access" IS NULL;
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "works" DROP COLUMN IF EXISTS "product_id";
      ALTER TABLE "works" DROP COLUMN IF EXISTS "access";
      DROP TYPE IF EXISTS "enum_works_access";
    `),
  )
}
