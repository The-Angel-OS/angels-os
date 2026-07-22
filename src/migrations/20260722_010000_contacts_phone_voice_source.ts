import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Contacts become harvestable from voice + web-form leads:
 *  - `phone` column (voice leads are phone-first; email is the hard field to
 *    collect on a call)
 *  - `email` DROP NOT NULL (a contact needs email OR phone — app-level hook
 *    enforces at-least-one)
 *  - source enum gains 'voice' and 'web-form'
 * Idempotent. ADD VALUE runs in-transaction fine on PG ≥ 12 as long as the new
 * value isn't used in the same transaction (it isn't).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "phone" varchar;
      CREATE INDEX IF NOT EXISTS "contacts_phone_idx" ON "contacts" ("phone");
      ALTER TABLE "contacts" ALTER COLUMN "email" DROP NOT NULL;
    `),
  )
  await db.execute(sql.raw(`ALTER TYPE "enum_contacts_source" ADD VALUE IF NOT EXISTS 'voice';`))
  await db.execute(sql.raw(`ALTER TYPE "enum_contacts_source" ADD VALUE IF NOT EXISTS 'web-form';`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Enum values can't be dropped; leave them. Column removal is enough.
  await db.execute(
    sql.raw(`
      ALTER TABLE "contacts" DROP COLUMN IF EXISTS "phone";
    `),
  )
}
