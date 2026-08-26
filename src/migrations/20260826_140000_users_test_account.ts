import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * `users.isTestAccount` — a real person on OUR side of the table.
 *
 * `isPortalClaimed` decides whether a portal may be indexed by Google under a
 * real business's name. It answers "has somebody outside the platform taken
 * ownership", and it already discounts platform admins, because the person who
 * BUILDS a portal is not its owner.
 *
 * That left one hole: an account we sign in as to check a portal, which carries
 * no platform role at all. Holding a membership as a tester is not a business
 * owner arriving. Without this the portal looks claimed and goes into the index
 * — the 260818 consent problem, one degree removed.
 *
 * A checkbox rather than a role: it grants nothing and revokes nothing, it only
 * answers "does this person count as the customer". Ken's call, 260826.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_test_account" boolean DEFAULT false;
      CREATE INDEX IF NOT EXISTS "users_is_test_account_idx" ON "users" ("is_test_account");
      UPDATE "users" SET "is_test_account" = false WHERE "is_test_account" IS NULL;
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DROP INDEX IF EXISTS "users_is_test_account_idx";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "is_test_account";
    `),
  )
}
