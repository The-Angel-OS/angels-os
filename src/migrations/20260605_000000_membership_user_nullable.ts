import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Make tenant_memberships.user_id NULLABLE.
 *
 * A PENDING email invitation has no user account yet (the user is linked on
 * accept via tenant-invite-accept). The column was NOT NULL, so every email
 * invite 500'd with a Payload ValidationError ("The following field is invalid:
 * user"). Dropping NOT NULL is non-destructive — it only permits null user_id
 * for pending invitations.
 *
 * Idempotent: prod already had this applied directly during the fix; this brings
 * other environments / fresh databases in line.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenant_memberships" ALTER COLUMN "user_id" DROP NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Re-imposing NOT NULL would fail if any pending invitations exist (null user).
  // Guard it so the down migration is safe to run.
  await db.execute(sql`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM "tenant_memberships" WHERE "user_id" IS NULL) THEN
        ALTER TABLE "tenant_memberships" ALTER COLUMN "user_id" SET NOT NULL;
      END IF;
    END $$;
  `)
}
