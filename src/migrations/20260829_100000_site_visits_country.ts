import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * site_visits.country — where the traffic came from.
 *
 * A two-letter code lifted from Cloudflare's `CF-IPCountry` header, which is
 * already on every proxied request. No geo-IP dependency, no lookup latency, and
 * — the point — no IP stored to get it. Cloudflare resolves the address at the
 * edge and hands us only the answer.
 *
 * A new column needs a new migration FILE. Payload keys on the name, so appending
 * to an applied migration never runs and then the config selects a column prod
 * lacks — which took the whole node down on 260821.
 *
 * @see src/utilities/recordSiteVisit.ts — normalizeCountry
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "site_visits" ADD COLUMN IF NOT EXISTS "country" varchar;
      CREATE INDEX IF NOT EXISTS "site_visits_country_idx" ON "site_visits" ("country");
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DROP INDEX IF EXISTS "site_visits_country_idx";
      ALTER TABLE "site_visits" DROP COLUMN IF EXISTS "country";
    `),
  )
}
