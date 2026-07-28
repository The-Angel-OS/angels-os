import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * The `video` block, plus `aspect` on `mediaText`.
 *
 * Both exist for the same reason: a phone-shot testimonial is PORTRAIT, and the
 * only frame available was a hardcoded 16:9 — which either crops the speaker's
 * head off or pillarboxes them into a stripe.
 *
 * A new block is a new table, and Pages has drafts, so each needs its `_pages_v_`
 * twin. Adding a column means BOTH tables too — miss the versions side and reads
 * work until something touches a draft.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      -- ── aspect on mediaText (both tables) ─────────────────────────────────
      DO $$ BEGIN
        CREATE TYPE "enum_pages_blocks_media_text_aspect" AS ENUM ('16/9','9/16','1/1','4/3');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE "enum__pages_v_blocks_media_text_aspect" AS ENUM ('16/9','9/16','1/1','4/3');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      ALTER TABLE "pages_blocks_media_text"
        ADD COLUMN IF NOT EXISTS "aspect" "enum_pages_blocks_media_text_aspect" DEFAULT '16/9';
      ALTER TABLE "_pages_v_blocks_media_text"
        ADD COLUMN IF NOT EXISTS "aspect" "enum__pages_v_blocks_media_text_aspect" DEFAULT '16/9';

      -- ── the video block ───────────────────────────────────────────────────
      DO $$ BEGIN
        CREATE TYPE "enum_pages_blocks_video_aspect" AS ENUM ('16/9','9/16','1/1');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE "enum__pages_v_blocks_video_aspect" AS ENUM ('16/9','9/16','1/1');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE TABLE IF NOT EXISTS "pages_blocks_video" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "_path" text NOT NULL,
        "id" varchar NOT NULL,
        "heading" varchar,
        "media_id" integer,
        "video_url" varchar,
        "poster_id" integer,
        "aspect" "enum_pages_blocks_video_aspect" DEFAULT '16/9',
        "caption" varchar,
        "block_name" varchar,
        CONSTRAINT "pages_blocks_video_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "pages_blocks_video_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE,
        CONSTRAINT "pages_blocks_video_media_id_fkey"
          FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE SET NULL,
        CONSTRAINT "pages_blocks_video_poster_id_fkey"
          FOREIGN KEY ("poster_id") REFERENCES "media"("id") ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS "pages_blocks_video_order_idx" ON "pages_blocks_video" ("_order");
      CREATE INDEX IF NOT EXISTS "pages_blocks_video_parent_id_idx" ON "pages_blocks_video" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "pages_blocks_video_path_idx" ON "pages_blocks_video" ("_path");
      CREATE INDEX IF NOT EXISTS "pages_blocks_video_media_idx" ON "pages_blocks_video" ("media_id");
      CREATE INDEX IF NOT EXISTS "pages_blocks_video_poster_idx" ON "pages_blocks_video" ("poster_id");

      CREATE TABLE IF NOT EXISTS "_pages_v_blocks_video" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "_path" text NOT NULL,
        "id" serial PRIMARY KEY,
        "heading" varchar,
        "media_id" integer,
        "video_url" varchar,
        "poster_id" integer,
        "aspect" "enum__pages_v_blocks_video_aspect" DEFAULT '16/9',
        "caption" varchar,
        "_uuid" varchar,
        "block_name" varchar,
        CONSTRAINT "_pages_v_blocks_video_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE,
        CONSTRAINT "_pages_v_blocks_video_media_id_fkey"
          FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE SET NULL,
        CONSTRAINT "_pages_v_blocks_video_poster_id_fkey"
          FOREIGN KEY ("poster_id") REFERENCES "media"("id") ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_video_order_idx" ON "_pages_v_blocks_video" ("_order");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_video_parent_id_idx" ON "_pages_v_blocks_video" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_video_path_idx" ON "_pages_v_blocks_video" ("_path");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_video_media_idx" ON "_pages_v_blocks_video" ("media_id");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_video_poster_idx" ON "_pages_v_blocks_video" ("poster_id");
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DROP TABLE IF EXISTS "_pages_v_blocks_video";
      DROP TABLE IF EXISTS "pages_blocks_video";
      DROP TYPE IF EXISTS "enum__pages_v_blocks_video_aspect";
      DROP TYPE IF EXISTS "enum_pages_blocks_video_aspect";
      ALTER TABLE "_pages_v_blocks_media_text" DROP COLUMN IF EXISTS "aspect";
      ALTER TABLE "pages_blocks_media_text" DROP COLUMN IF EXISTS "aspect";
      DROP TYPE IF EXISTS "enum__pages_v_blocks_media_text_aspect";
      DROP TYPE IF EXISTS "enum_pages_blocks_media_text_aspect";
    `),
  )
}
