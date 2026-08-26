import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Badges, and a profile to put them on.
 *
 * No badges collection. A badge DEFINITION is a group on `works` — the Work
 * already IS the thing you earn it for, and "finished this" covers 99% of it.
 * An AWARD is an array on `users`, so it rides along with /api/users/me exactly
 * like `readState` does.
 *
 * Profiles: `handle` is the /u/<handle> address, backfilled from the name with
 * numeric suffixing on collision; `profile_visibility` DEFAULTS TO 'members'.
 * Nobody becomes world-visible because of a deploy — going public is opt-in.
 *
 * Array table shape copied from a Payload-GENERATED one (`products_gallery`):
 * `_order` 1-based, `_parent_id` → parent ON DELETE CASCADE, varchar `id` PK.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      -- ── The badge a Work awards ──────────────────────────────────────────
      ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "badge_name" varchar;
      ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "badge_image_id" integer
        REFERENCES "media"("id") ON DELETE SET NULL;
      ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "badge_criteria" varchar;
      CREATE INDEX IF NOT EXISTS "works_badge_image_idx" ON "works" ("badge_image_id");

      -- ── The badges a person has earned ───────────────────────────────────
      CREATE TABLE IF NOT EXISTS "users_badges" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "id" varchar NOT NULL,
        "work" varchar,
        "name" varchar,
        "image" varchar,
        "awarded_at" timestamp(3) with time zone,
        "score" numeric,
        CONSTRAINT "users_badges_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "users_badges_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "users"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "users_badges_order_idx" ON "users_badges" ("_order");
      CREATE INDEX IF NOT EXISTS "users_badges_parent_id_idx" ON "users_badges" ("_parent_id");

      -- ── The profile ──────────────────────────────────────────────────────
      DO $$ BEGIN
        CREATE TYPE "enum_users_profile_visibility" AS ENUM ('private', 'members', 'public');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "handle" varchar;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" varchar;
      ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "profile_visibility"
        "enum_users_profile_visibility" DEFAULT 'members';
    `),
  )

  // Backfill handles from names, suffixing collisions (-2, -3 …). A name that
  // slugifies to nothing falls back to `member`, which then suffixes like any
  // other collision.
  await db.execute(
    sql.raw(`
      UPDATE "users" u SET "handle" = c.handle
      FROM (
        SELECT id,
               CASE WHEN rn = 1 THEN base ELSE base || '-' || rn END AS handle
        FROM (
          SELECT id, base, row_number() OVER (PARTITION BY base ORDER BY id) AS rn
          FROM (
            SELECT id,
                   COALESCE(
                     NULLIF(trim(BOTH '-' FROM regexp_replace(lower(COALESCE("name", '')), '[^a-z0-9]+', '-', 'g')), ''),
                     'member'
                   ) AS base
            FROM "users"
          ) s
        ) t
      ) c
      WHERE u.id = c.id AND u."handle" IS NULL;

      -- Unique only among the handles that exist; NULLs do not collide in pg.
      CREATE UNIQUE INDEX IF NOT EXISTS "users_handle_idx" ON "users" ("handle");
      UPDATE "users" SET "profile_visibility" = 'members' WHERE "profile_visibility" IS NULL;
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DROP INDEX IF EXISTS "users_handle_idx";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "profile_visibility";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "bio";
      ALTER TABLE "users" DROP COLUMN IF EXISTS "handle";
      DROP TYPE IF EXISTS "enum_users_profile_visibility";
      DROP TABLE IF EXISTS "users_badges";
      ALTER TABLE "works" DROP COLUMN IF EXISTS "badge_criteria";
      ALTER TABLE "works" DROP COLUMN IF EXISTS "badge_image_id";
      ALTER TABLE "works" DROP COLUMN IF EXISTS "badge_name";
    `),
  )
}
