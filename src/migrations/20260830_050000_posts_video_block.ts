import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Let a Post hold a Video block.
 *
 * Pages could embed a YouTube/Vimeo film; Posts could not — the block simply
 * was not in the Posts block list, so `posts_blocks_video` never existed. That
 * is an arbitrary split: a post about a wedding is exactly the place the film
 * belongs, and the block already handles both sources.
 *
 * Written by hand, mirroring the live `pages_blocks_video` / `_pages_v_blocks_video`
 * shape, rather than generated. `migrate:create` diffs the config against the
 * LOCAL dev database, which is a month behind production — a generated file
 * would have swept in a month of unrelated drift alongside this one change.
 *
 * Posts has drafts, so both the live table and its `_posts_v_` twin are needed;
 * without the twin every admin save of a post carrying a video 500s on the
 * version write, which reads as "saving is broken" rather than "one table is
 * missing".
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_posts_blocks_video_aspect" AS ENUM('16/9', '9/16', '1/1');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__posts_v_blocks_video_aspect" AS ENUM('16/9', '9/16', '1/1');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "posts_blocks_video" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "heading" varchar,
      "media_id" integer,
      "video_url" varchar,
      "poster_id" integer,
      "aspect" "public"."enum_posts_blocks_video_aspect" DEFAULT '16/9',
      "caption" varchar,
      "block_name" varchar
    );

    CREATE TABLE IF NOT EXISTS "_posts_v_blocks_video" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "heading" varchar,
      "media_id" integer,
      "video_url" varchar,
      "poster_id" integer,
      "aspect" "public"."enum__posts_v_blocks_video_aspect" DEFAULT '16/9',
      "caption" varchar,
      "_uuid" varchar,
      "block_name" varchar
    );
  `)

  // Media FKs are SET NULL to match every other block: deleting an image must
  // never take the post with it. The parent FKs cascade, because a block row
  // whose post is gone is garbage.
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "posts_blocks_video" ADD CONSTRAINT "posts_blocks_video_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "posts_blocks_video" ADD CONSTRAINT "posts_blocks_video_media_id_fkey"
        FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "posts_blocks_video" ADD CONSTRAINT "posts_blocks_video_poster_id_fkey"
        FOREIGN KEY ("poster_id") REFERENCES "public"."media"("id") ON DELETE set null;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "_posts_v_blocks_video" ADD CONSTRAINT "_posts_v_blocks_video_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "_posts_v_blocks_video" ADD CONSTRAINT "_posts_v_blocks_video_media_id_fkey"
        FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    DO $$ BEGIN
      ALTER TABLE "_posts_v_blocks_video" ADD CONSTRAINT "_posts_v_blocks_video_poster_id_fkey"
        FOREIGN KEY ("poster_id") REFERENCES "public"."media"("id") ON DELETE set null;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "posts_blocks_video_order_idx" ON "posts_blocks_video" ("_order");
    CREATE INDEX IF NOT EXISTS "posts_blocks_video_parent_id_idx" ON "posts_blocks_video" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "posts_blocks_video_path_idx" ON "posts_blocks_video" ("_path");
    CREATE INDEX IF NOT EXISTS "posts_blocks_video_media_idx" ON "posts_blocks_video" ("media_id");
    CREATE INDEX IF NOT EXISTS "posts_blocks_video_poster_idx" ON "posts_blocks_video" ("poster_id");

    CREATE INDEX IF NOT EXISTS "_posts_v_blocks_video_order_idx" ON "_posts_v_blocks_video" ("_order");
    CREATE INDEX IF NOT EXISTS "_posts_v_blocks_video_parent_id_idx" ON "_posts_v_blocks_video" ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_posts_v_blocks_video_path_idx" ON "_posts_v_blocks_video" ("_path");
    CREATE INDEX IF NOT EXISTS "_posts_v_blocks_video_media_idx" ON "_posts_v_blocks_video" ("media_id");
    CREATE INDEX IF NOT EXISTS "_posts_v_blocks_video_poster_idx" ON "_posts_v_blocks_video" ("poster_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "posts_blocks_video" CASCADE;
    DROP TABLE IF EXISTS "_posts_v_blocks_video" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_posts_blocks_video_aspect";
    DROP TYPE IF EXISTS "public"."enum__posts_v_blocks_video_aspect";
  `)
}
