import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Tenant flavors (canonical model — see AGENTS.md "The model").
 *
 * A tenant is the universal primitive; every Circle, Business, Guardian Angel,
 * and Personal Portal IS a tenant, differing only by flavor. The `type` enum
 * carried only platform/tenant/ministry — no way to say "this is a family Circle"
 * vs "a Business". Add the flavor values so the model is expressible.
 *
 * ADDITIVE ONLY — existing values (platform=root, tenant=legacy default,
 * ministry=legacy) are untouched, so every current row and every query keeps
 * working. 'platform' stays the load-bearing root marker. New tenants opt into a
 * flavor at provisioning time; nothing is backfilled here.
 *
 * ADD VALUE is not wrapped in a way that uses the new values in this same
 * migration, so it is transaction-safe (matches the earlier 'ministry' add in
 * 20260223_013326).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_tenants_type" ADD VALUE IF NOT EXISTS 'business';
    ALTER TYPE "public"."enum_tenants_type" ADD VALUE IF NOT EXISTS 'circle';
    ALTER TYPE "public"."enum_tenants_type" ADD VALUE IF NOT EXISTS 'guardian_angel';
    ALTER TYPE "public"."enum_tenants_type" ADD VALUE IF NOT EXISTS 'personal_portal';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Postgres cannot DROP a value from an enum. Removing these flavors would
  // require recreating the type and rewriting every tenants.type — not worth the
  // risk for a purely additive change. Down is a deliberate no-op; the added
  // values are harmless if unused.
}
