import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds users.phone — the identity anchor for SMS sign-in (Twilio Verify texts a
 * code; verifyOtpSms matches the approved phone to this column). Idempotent.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" varchar;
      CREATE INDEX IF NOT EXISTS "users_phone_idx" ON "users" ("phone");
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "phone";
    `),
  )
}
