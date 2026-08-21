import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * hero.scrim on the VERSIONS tables.
 *
 * 20260821_120000 added `hero_scrim` to `pages` and `posts` on the reasoning
 * that hero_media_fit "does not carry" to the versions tables. That was wrong:
 * `_pages_v.version_hero_media_fit` and `_posts_v.version_hero_media_fit` both
 * exist, so the config selects and INSERTS `version_hero_scrim` too.
 *
 * The cost of the miss: the admin create view autosaves a draft the moment it
 * opens, that insert died on the missing column, and the page rendered blank —
 * no form, no nav, no error. Every page and post draft save on the node was
 * failing the same way from 13:32 until this landed.
 *
 * A NEW file rather than an edit to 20260821_120000, which has already applied:
 * an applied migration is frozen history. See project_frozen_migration_rule.
 */
const TABLES = ['pages', 'posts'] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const t of TABLES) {
    await db.execute(sql.raw(`
      DO $$ BEGIN
        CREATE TYPE "enum__${t}_v_version_hero_scrim" AS ENUM ('strong', 'medium', 'light', 'none');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `))
    await db.execute(sql.raw(`
      ALTER TABLE "_${t}_v" ADD COLUMN IF NOT EXISTS "version_hero_scrim" "enum__${t}_v_version_hero_scrim" DEFAULT 'strong';
    `))
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const t of TABLES) {
    await db.execute(sql.raw(`ALTER TABLE "_${t}_v" DROP COLUMN IF EXISTS "version_hero_scrim";`))
    await db.execute(sql.raw(`DROP TYPE IF EXISTS "enum__${t}_v_version_hero_scrim";`))
  }
}
