import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Availability may belong to the BUSINESS, not only to a person.
 *
 * `provider_id` was NOT NULL, so every set of bookable hours had to be pinned
 * to a user. Two consequences, both of which cost sales:
 *
 *   • A prospect demo has no human on it — the invite is still unaccepted — so
 *     provisioning bailed with "no provider" and shipped a /book page that
 *     offered nothing, on the very sites built to demonstrate booking.
 *   • A one-person business has no meaningful distinction between "the owner's
 *     calendar" and "the shop's calendar", but was forced to model one.
 *
 * NULL now means house hours. When an owner later sets their own schedule,
 * resolveBookingProvider still prefers the calendar that has rows, so a named
 * provider takes over the moment one exists.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "availability" ALTER COLUMN "provider_id" DROP NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Re-imposing NOT NULL would fail against any house-hours row, so clear those
  // first: they cannot be expressed at all under the old shape.
  await db.execute(sql`DELETE FROM "availability" WHERE "provider_id" IS NULL;`)
  await db.execute(sql`ALTER TABLE "availability" ALTER COLUMN "provider_id" SET NOT NULL;`)
}
