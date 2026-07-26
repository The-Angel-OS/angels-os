import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds contacts.attribution_* — first-touch UTM, landing page and referrer for
 * every captured lead. Without these columns "which channel produced the sale"
 * cannot be answered, and that is the number a campaign is judged on.
 *
 * Group fields flatten to one column per subfield; a missing one is a 42703 on
 * every contacts read. @see docs/FOOTGUNS.md §2.4
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "attribution_source" varchar;
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "attribution_medium" varchar;
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "attribution_campaign" varchar;
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "attribution_landing_page" varchar;
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "attribution_referrer" varchar;
      CREATE INDEX IF NOT EXISTS "contacts_attribution_source_idx" ON "contacts" ("attribution_source");
      CREATE INDEX IF NOT EXISTS "contacts_attribution_campaign_idx" ON "contacts" ("attribution_campaign");
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DROP INDEX IF EXISTS "contacts_attribution_source_idx";
      DROP INDEX IF EXISTS "contacts_attribution_campaign_idx";
      ALTER TABLE "contacts" DROP COLUMN IF EXISTS "attribution_source";
      ALTER TABLE "contacts" DROP COLUMN IF EXISTS "attribution_medium";
      ALTER TABLE "contacts" DROP COLUMN IF EXISTS "attribution_campaign";
      ALTER TABLE "contacts" DROP COLUMN IF EXISTS "attribution_landing_page";
      ALTER TABLE "contacts" DROP COLUMN IF EXISTS "attribution_referrer";
    `),
  )
}
