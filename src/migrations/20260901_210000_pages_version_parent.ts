import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `_pages_v.version_parent_id` — the half of the `parent` field nobody added.
 *
 * Exposing `parent` on Pages needed two columns, not one. `pages.parent_id` was
 * already there, left behind when the nested-docs plugin was removed, and
 * checking it was enough to conclude "no migration needed". It was not: Pages
 * is a versioned collection, so every create and update also writes `_pages_v`,
 * and that table had `version_nav_label`, `version_nav_order` and
 * `version_show_in_nav` but no `version_parent_id`.
 *
 * The failure mode is nasty because it is silent where you look: the PUBLIC
 * site reads `pages` and stayed perfectly healthy, the deploy passed its
 * healthcheck, and what broke was every page save on every tenant —
 * `saveVersion` inserting a column that does not exist. `ensure-pages-nav-
 * columns.ts` carries a comment describing this exact incident for the three
 * sibling columns, and then did not add this one.
 *
 * Bare integer plus an index, deliberately matching `pages.parent_id`, which
 * has no foreign key either. A real FK here would be the more correct schema
 * and a worse migration: it would have to be validated against existing version
 * rows, and the point of this file is to stop the bleeding.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "_pages_v" ADD COLUMN IF NOT EXISTS "version_parent_id" integer;
    CREATE INDEX IF NOT EXISTS "_pages_v_version_version_parent_idx"
      ON "_pages_v" ("version_parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "_pages_v_version_version_parent_idx";
    ALTER TABLE "_pages_v" DROP COLUMN IF EXISTS "version_parent_id";
  `)
}
