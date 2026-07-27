import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds `splitPanel` to every hero-type enum.
 *
 * Postgres has no DROP VALUE for an enum, so `down` is deliberately a no-op —
 * an unused label is harmless, and faking a rollback by rebuilding the type
 * would risk the column. @see docs/FOOTGUNS.md §2.4
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const rows = await db.execute(
    // typtype='e' — without it this also matches "_enum_..._hero_type", the
    // ARRAY type Postgres auto-creates alongside every enum, and ALTER TYPE on
    // an array fails with "is not an enum".
    sql.raw(`SELECT t.typname FROM pg_type t WHERE t.typname LIKE '%hero_type%' AND t.typtype = 'e';`),
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (rows as any).rows ?? []) {
    await db.execute(
      sql.raw(`ALTER TYPE "${row.typname}" ADD VALUE IF NOT EXISTS 'splitPanel';`),
    )
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Intentionally empty — see above.
}
