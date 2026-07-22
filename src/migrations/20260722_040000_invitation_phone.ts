import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds tenant_memberships.invitation_details_invitation_phone — phone-based
 * invites: admin creates the invite with a mobile number, copies the link and
 * texts it themselves (no outbound SMS yet); the invitee returns and signs in
 * with a texted code, which creates their account and activates the invite
 * (see verifyOtpSms). Idempotent.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "tenant_memberships" ADD COLUMN IF NOT EXISTS "invitation_details_invitation_phone" varchar;
      CREATE INDEX IF NOT EXISTS "tenant_memberships_invitation_phone_idx" ON "tenant_memberships" ("invitation_details_invitation_phone");
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "tenant_memberships" DROP COLUMN IF EXISTS "invitation_details_invitation_phone";
    `),
  )
}
