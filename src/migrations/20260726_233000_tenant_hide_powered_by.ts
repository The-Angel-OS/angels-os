import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds tenants.branding_hide_powered_by — lets a commercial Endeavor drop the
 * "Powered by The Angel OS · Payload · Next.js · LiveKit" line from its footer.
 *
 * Defaults to false, so every existing portal keeps the credit exactly as it is
 * and only an owner who opts out loses it.
 *
 * Schema before deploy: a missing column here is a 42703 on every tenant read,
 * which is every page on every portal. @see docs/FOOTGUNS.md §2.4
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "branding_hide_powered_by" boolean DEFAULT false;
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "tenants" DROP COLUMN IF EXISTS "branding_hide_powered_by";
    `),
  )
}
