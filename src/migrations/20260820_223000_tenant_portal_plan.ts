import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Which Angel OS plan a portal is on — the field the Upgrade Plan surface reads.
 *
 * Three billing concepts already existed and none of them was this one:
 *   • membership plans        — what a TENANT sells to ITS OWN customers
 *   • bootstrapFees.tier      — transaction-fee banding during bootstrap
 *   • stripeConnect.*         — the tenant's own payout account
 * None answers "is this portal paying us $0, $49 or $149?", so the dashboard had
 * nothing to show and no upgrade path to offer. Collapsing it into any of the
 * above is how a gym's $30 membership ends up billing the platform.
 *
 * Free is the default and every existing portal is on it, which is accurate:
 * nobody has ever been charged for a site.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_tenants_portal_plan" AS ENUM ('free', 'site', 'business');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "portal_plan" "enum_tenants_portal_plan" DEFAULT 'free';
  `)
  await db.execute(sql`UPDATE "tenants" SET "portal_plan" = 'free' WHERE "portal_plan" IS NULL;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "portal_plan";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_tenants_portal_plan";`)
}
