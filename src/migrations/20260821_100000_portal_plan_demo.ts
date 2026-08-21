import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * portalPlan: 'demo' — everything switched on, billed to nobody.
 *
 * Gating /book to Business turned booking OFF on the prospect demos and on our
 * own portals, which is exactly backwards: the demo IS the pitch, and we do not
 * invoice ourselves. The fix is a plan tier rather than an `isDemo` flag that
 * bypasses the gate — a bypass would be a second answer to "what may this
 * portal do", and the two would drift until the gate was honest in one place
 * and a lie in the other.
 *
 * Applied to the portals that are demonstrations or ours: the prospect sites we
 * stood up, and Clearwater. A demo that converts becomes a paying plan by
 * changing one field.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_tenants_portal_plan" ADD VALUE IF NOT EXISTS 'demo';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Postgres cannot drop a value from an enum without rebuilding the type, and
  // rebuilding it would rewrite every tenant row to remove a label that costs
  // nothing to leave in place.
}
