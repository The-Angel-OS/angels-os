import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * works.published / available_globally / default_doc / links — the last four
 * manifest-only fields, moved into the row.
 *
 * Availability ("which portals carry this Work") lived in the soul manifests,
 * so choosing it meant editing TypeScript and deploying — a portal owner could
 * never pick their own. owner + subscribers were already columns; these four are
 * what was still missing before the manifests stop being load-bearing.
 *
 * @see project_frozen_migration_rule — new file, never an edit to an applied one
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "works"
      ADD COLUMN IF NOT EXISTS "published" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "available_globally" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "default_doc" varchar,
      ADD COLUMN IF NOT EXISTS "links" jsonb,
      ADD COLUMN IF NOT EXISTS "opt_outs" jsonb;
  `))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(`
    ALTER TABLE "works"
      DROP COLUMN IF EXISTS "published",
      DROP COLUMN IF EXISTS "available_globally",
      DROP COLUMN IF EXISTS "default_doc",
      DROP COLUMN IF EXISTS "links",
      DROP COLUMN IF EXISTS "opt_outs";
  `))
}
