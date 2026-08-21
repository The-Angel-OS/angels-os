import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * features.pageComments — its own migration, and the reason is the incident.
 *
 * This column was originally appended to 20260821_050000_tenant_features, which
 * had ALREADY applied on the live node. Payload records a migration by NAME, so
 * the edited file never ran again: the deploy shipped a config that selects
 * `tenants.features_page_comments` against a table that did not have it, and
 * EVERY tenant lookup failed — which is every page on every portal. The whole
 * node was down until the column was added by hand.
 *
 * An applied migration is frozen history. New column, new file.
 *
 * Page comments were mounted unconditionally on every portal before the toggle
 * existed, so the three portals already using them keep them.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants"
      ADD COLUMN IF NOT EXISTS "features_page_comments" boolean DEFAULT false;
  `)
  await db.execute(sql`
    UPDATE "tenants" SET "features_page_comments" = true
    WHERE "slug" IN ('clearwater-cruisin', 'wheredideveryonego', 'platform');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "tenants" DROP COLUMN IF EXISTS "features_page_comments";`)
}
