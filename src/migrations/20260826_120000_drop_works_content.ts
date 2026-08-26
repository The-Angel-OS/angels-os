import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Drop `works.content`.
 *
 * It held a course as one jsonb blob, and it existed ONLY because chapters had
 * no editable home. Now that they do, a lesson is a chapter with a video and a
 * `module` label — one editor, one progress map, one thing for the sitemap to
 * find.
 *
 * All six Works have `content = null`, so nothing is being thrown away. That is
 * true today and stops being true the day someone builds a course, which is the
 * whole reason to do this now.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "works" DROP COLUMN IF EXISTS "content";`))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "content" jsonb;`))
}
