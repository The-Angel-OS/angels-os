import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * portalPlan: 'creator' — $10/mo Creator tier (4% platform fee).
 *
 * Unlocks customDomain, memberships, and customerAssistant (LEO AI + YouTube RAG)
 * at $10/mo ($99/yr), replacing the old $79/mo paywall on memberships and AI.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "enum_tenants_portal_plan" ADD VALUE IF NOT EXISTS 'creator';
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Postgres cannot drop a value from an enum without rebuilding the type.
}
