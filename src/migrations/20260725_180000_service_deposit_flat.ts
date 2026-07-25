import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds services.deposit_flat_usd — a fixed booking deposit, credited against the
 * final invoice.
 *
 * depositPercent alone cannot serve a trade: the deposit is computed as
 * priceUsd × depositPercent, so a service that is quoted on site (a panel
 * upgrade, a rewire) has no price and therefore always computes a zero deposit.
 * A flat amount lets the work still hold a slot with money down. Idempotent.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "deposit_flat_usd" numeric;
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "services" DROP COLUMN IF EXISTS "deposit_flat_usd";
    `),
  )
}
