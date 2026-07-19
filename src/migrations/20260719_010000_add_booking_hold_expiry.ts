import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds bookings.hold_expires_at — a soft-hold expiry so an abandoned deposit
 * checkout stops blocking the slot forever. Availability ignores pending bookings
 * whose hold has expired. Null = no expiry (no-deposit request holds until the
 * owner acts). Additive + idempotent. Bookings are not versioned (single table).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "hold_expires_at" timestamp(3) with time zone;
    CREATE INDEX IF NOT EXISTS "bookings_hold_expires_at_idx" ON "bookings" ("hold_expires_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "bookings_hold_expires_at_idx";
    ALTER TABLE "bookings" DROP COLUMN IF EXISTS "hold_expires_at";
  `)
}
