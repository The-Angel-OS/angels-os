import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Two columns the platform could not sell without.
 *
 * 1. `site_visits.variant` — the A/B bucket. The middleware assigns every
 *    visitor to `a` or `b` in a first-party cookie; this is where that lands, and
 *    it is the whole storage cost of A/B testing on this platform. The report
 *    (`/api/site-log/report?type=variants`) groups on it and compares each
 *    bucket's rate of reaching a goal page.
 *
 * 2. `tenants.storefront_address_*` — the physical address, for search engines.
 *    Without a PostalAddress in a page's structured data Google will not render
 *    a local-business or church result at all: no map pack, no opening hours, no
 *    directions button. Every church and local-business portal on the node was
 *    competing as though it had no location.
 *
 * A new column needs a new migration FILE — Payload keys on the name, so
 * appending to an applied migration never runs and the config then selects a
 * column production lacks, which took the whole node down on 260821.
 *
 * Hand-written against the live schema rather than generated: `migrate:create`
 * diffs the config against the LOCAL dev database, whose rows are a month stale,
 * and would have swept unrelated drift in alongside these two changes.
 *
 * @see src/utilities/abVariant.ts
 * @see src/utilities/structuredData.ts
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "variant" varchar;
      CREATE INDEX IF NOT EXISTS "site_visits_variant_idx" ON "site_visits" ("variant");

      ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "storefront_address_street" varchar;
      ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "storefront_address_city" varchar;
      ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "storefront_address_region" varchar;
      ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "storefront_address_postal_code" varchar;
      ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "storefront_address_country" varchar DEFAULT 'US';
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DROP INDEX IF EXISTS "site_visits_variant_idx";
      ALTER TABLE "site_visits" DROP COLUMN IF EXISTS "variant";

      ALTER TABLE "tenants" DROP COLUMN IF EXISTS "storefront_address_street";
      ALTER TABLE "tenants" DROP COLUMN IF EXISTS "storefront_address_city";
      ALTER TABLE "tenants" DROP COLUMN IF EXISTS "storefront_address_region";
      ALTER TABLE "tenants" DROP COLUMN IF EXISTS "storefront_address_postal_code";
      ALTER TABLE "tenants" DROP COLUMN IF EXISTS "storefront_address_country";
    `),
  )
}
