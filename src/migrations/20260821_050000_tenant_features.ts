import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * tenant.features — what a portal WANTS switched on.
 *
 * Distinct from portal_plan, which is what it has PAID for. Works was gated by a
 * hardcoded two-slug allow-list in the dashboard nav; this retires it. Default
 * false everywhere, then the two endeavors that actually publish Works get it
 * back — which is exactly the behaviour the allow-list encoded.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "features_works" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "features_page_comments" boolean DEFAULT false;
  `)
  await db.execute(sql`
    UPDATE "tenants" SET "features_works" = true
    WHERE "slug" IN ('clearwater-cruisin', 'wheredideveryonego');
  `)
  // Page comments were mounted unconditionally on every portal. Default off is
  // the point of the toggle, but switching it off under the three portals that
  // actually use it would be a silent removal, so they keep what they had.
  await db.execute(sql`
    UPDATE "tenants" SET "features_page_comments" = true
    WHERE "slug" IN ('clearwater-cruisin', 'wheredideveryonego', 'platform');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "features_works";`)
  await db.execute(sql`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "features_page_comments";`)
}
