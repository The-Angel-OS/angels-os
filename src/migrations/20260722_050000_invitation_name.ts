import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds tenant_memberships.invitation_details_invitation_name — the display name
 * the inviter typed (e.g. "Vlad"). Shown on rosters while the invite is pending
 * and applied to the user account created on first OTP sign-in. Idempotent.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "tenant_memberships" ADD COLUMN IF NOT EXISTS "invitation_details_invitation_name" varchar;
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "tenant_memberships" DROP COLUMN IF EXISTS "invitation_details_invitation_name";
    `),
  )
}
