import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Space invitations gain a phone and a name, so you can invite someone you only
 * know by number — the tenant-invite path has had both for a while and the space
 * path did not, which made "can this person sign in by text" depend on which
 * screen the admin happened to use.
 *
 * Indexed because `verifyOtpSms` looks invitations up BY phone on every texted
 * sign-in. @see src/utilities/invitationSystem.ts
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "space_memberships"
      ADD COLUMN IF NOT EXISTS "invitation_details_invitation_phone" varchar,
      ADD COLUMN IF NOT EXISTS "invitation_details_invitation_name" varchar;
    CREATE INDEX IF NOT EXISTS "space_memberships_invitation_details_invitation_phone_idx"
      ON "space_memberships" ("invitation_details_invitation_phone");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "space_memberships_invitation_details_invitation_phone_idx";
    ALTER TABLE "space_memberships"
      DROP COLUMN IF EXISTS "invitation_details_invitation_phone",
      DROP COLUMN IF EXISTS "invitation_details_invitation_name";
  `)
}
