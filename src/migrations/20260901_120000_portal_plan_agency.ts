import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * portalPlan: 'agency' — Business, with room for a hundred portals.
 *
 * Ken's 260901 ruling, after the portal-ownership audit. The allowance, not the
 * feature set, was what stopped a partner: someone reselling this platform runs
 * fifty client sites, and the person-level ceiling of ten made that conversation
 * impossible to have.
 *
 * An enum value needs its own migration FILE — Payload keys on the name, so
 * appending to an applied one never runs and the config then writes a label the
 * database will not accept. Same shape as `20260821_100000_portal_plan_demo`.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_tenants_portal_plan" ADD VALUE IF NOT EXISTS 'agency';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Postgres cannot drop a value from an enum without rebuilding the type, and
  // rebuilding it would rewrite every tenant row to remove a label that costs
  // nothing to leave in place.
}
