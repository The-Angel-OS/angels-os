import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * hero.scrim — how hard a hero darkens its image.
 *
 * Same shape as hero_media_fit, which lives on `pages` and `posts` only (the
 * versions tables do not carry it). Enum + column, defaulting to 'strong',
 * which is exactly what every hero rendered before the dial existed.
 *
 * This column MUST land with the deploy that adds the field: the config
 * selects it on every page and post read, and a missing column there is a
 * total outage, not a missing feature. That lesson is from earlier today —
 * see 20260821_080000.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_pages_hero_scrim" AS ENUM ('strong', 'medium', 'light', 'none');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_posts_hero_scrim" AS ENUM ('strong', 'medium', 'light', 'none');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`
    ALTER TABLE "pages" ADD COLUMN IF NOT EXISTS "hero_scrim" "enum_pages_hero_scrim" DEFAULT 'strong';
  `)
  await db.execute(sql`
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "hero_scrim" "enum_posts_hero_scrim" DEFAULT 'strong';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "pages" DROP COLUMN IF EXISTS "hero_scrim";`)
  await db.execute(sql`ALTER TABLE "posts" DROP COLUMN IF EXISTS "hero_scrim";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_pages_hero_scrim";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_posts_hero_scrim";`)
}
