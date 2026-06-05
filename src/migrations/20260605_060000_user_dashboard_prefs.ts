import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add users.dashboard_prefs (jsonb) — per-user dashboard widget preferences
 * (collapsed / dismissed / order), server-synced so they follow the user across
 * devices and the Nimue client. Idempotent (live DBs are dev-pushed).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dashboard_prefs" jsonb;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "dashboard_prefs";`)
}
