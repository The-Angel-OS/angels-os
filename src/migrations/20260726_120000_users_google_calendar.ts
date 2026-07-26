import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the users.google_calendar_* group — a provider's connected Google
 * Calendar, so /book reads their REAL availability instead of only the bookings
 * we happen to know about — plus bookings.google_event_id, the mirrored event
 * so a reschedule MOVES it and a cancel REMOVES it. Idempotent.
 *
 * Schema before deploy: a group field flattens to one column per subfield, and
 * a missing column here is a 42703 on every user read. @see docs/FOOTGUNS.md §2.4
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_calendar_connected" boolean DEFAULT false;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_calendar_refresh_token" varchar;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_calendar_calendar_id" varchar DEFAULT 'primary';
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_calendar_connected_at" timestamp(3) with time zone;
      ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "google_event_id" varchar;
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "google_calendar_connected";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "google_calendar_refresh_token";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "google_calendar_calendar_id";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "google_calendar_connected_at";
      ALTER TABLE "bookings" DROP COLUMN IF EXISTS "google_event_id";
    `),
  )
}
