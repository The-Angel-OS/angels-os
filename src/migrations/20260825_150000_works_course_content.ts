import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * A course is a Work: one enum value and one JSON column, not four tables.
 * `works.content` holds { modules: [{ title, lessons: [...] }] } — kilobytes for
 * a course of tens of lessons. @see src/utilities/courseContent.ts
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ADD VALUE cannot run in the same statement batch that then USES the value;
  // nothing here does, and IF NOT EXISTS makes a re-run harmless.
  await db.execute(sql.raw(`ALTER TYPE "enum_works_type" ADD VALUE IF NOT EXISTS 'course';`))
  await db.execute(sql.raw(`ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "content" jsonb;`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // The enum value stays — Postgres cannot drop one, and a course row would be
  // unreadable without it.
  await db.execute(sql.raw(`ALTER TABLE "works" DROP COLUMN IF EXISTS "content";`))
}
