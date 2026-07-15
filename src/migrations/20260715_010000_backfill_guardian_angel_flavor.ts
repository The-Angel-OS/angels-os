import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Backfill the 'guardian_angel' flavor onto existing personal-angel tenants.
 *
 * New guardian angels get type='guardian_angel' at provisioning (provisionPortal),
 * but pre-existing ones were created as 'tenant' with the is_guardian_angel=true
 * boolean. This aligns their flavor to the canonical model. Only the UNAMBIGUOUS
 * case is backfilled — we KNOW these are guardian angels from the boolean. Legacy
 * 'tenant'/'ministry' rows that aren't guardian angels are left untouched (their
 * flavor can't be inferred; the legacy values keep working). 'platform' is never
 * touched.
 *
 * Safe: targeted UPDATE on a plain boolean column, no data loss, idempotent.
 * Depends on 20260715_000000 having added the 'guardian_angel' enum value first.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "tenants"
    SET "type" = 'guardian_angel'
    WHERE "is_guardian_angel" = true
      AND "type" = 'tenant';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Reverse: personal-angel tenants that we flipped go back to the legacy 'tenant'.
  await db.execute(sql`
    UPDATE "tenants"
    SET "type" = 'tenant'
    WHERE "is_guardian_angel" = true
      AND "type" = 'guardian_angel';
  `)
}
