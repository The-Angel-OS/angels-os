import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Backfill users.tenants[] from active tenant memberships.
 *
 * `syncUserTenants` keeps the multi-tenant plugin's User.tenants array in step
 * with the membership graph, but rows written before it existed (or while it
 * failed non-fatally) drifted. The array is what hydrates a tenant over REST,
 * so the drift was VISIBLE: a user with an active membership on the platform
 * tenant had it in the dashboard chooser (server-side, overrideAccess) and NOT
 * in the brochure-site chooser (REST, access-checked) — six rows across three
 * users, including Ty on tenant 1.
 *
 * The membership table stays the source of truth; this only re-derives the
 * cache from it.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    INSERT INTO "users_tenants" ("_order", "_parent_id", "id", "tenant_id")
    SELECT
      COALESCE((SELECT MAX(ut."_order") FROM "users_tenants" ut WHERE ut."_parent_id" = tm."user_id"), 0)
        + ROW_NUMBER() OVER (PARTITION BY tm."user_id" ORDER BY tm."tenant_id"),
      tm."user_id",
      md5(random()::text || tm."user_id"::text || tm."tenant_id"::text),
      tm."tenant_id"
    FROM (SELECT DISTINCT "user_id", "tenant_id" FROM "tenant_memberships" WHERE "status" = 'active') tm
    WHERE tm."user_id" IS NOT NULL
      AND tm."tenant_id" IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "users_tenants" ut
        WHERE ut."_parent_id" = tm."user_id" AND ut."tenant_id" = tm."tenant_id"
      );
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Nothing to undo: these rows only restate memberships that already exist.
}
