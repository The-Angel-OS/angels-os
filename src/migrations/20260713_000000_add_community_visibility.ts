import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add the 'community' value to enum_spaces_visibility — the universal town square.
 *
 * A space marked visibility:'community' is readable AND postable by ANY
 * authenticated user across the whole node, no tenant membership or invite needed
 * (see PermissionService.resolveVisibleSpaceIds step 2b). This is distinct from
 * 'public', which is only visible within its own tenant.
 *
 * Schema-before-deploy: the Payload select field gains the option in the same
 * change, but writes with the new value fail until the Postgres enum carries it —
 * so this lands FIRST. Idempotent (IF NOT EXISTS). No 'down' un-adds an enum value
 * (Postgres can't DROP a single enum value safely), so down is a no-op.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_spaces_visibility" ADD VALUE IF NOT EXISTS 'community';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Postgres has no safe single-value enum removal; leaving 'community' in place is
  // harmless (unused values cost nothing). Intentional no-op.
}
