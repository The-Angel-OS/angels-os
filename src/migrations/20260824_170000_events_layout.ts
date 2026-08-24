import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Events get a `layout` blocks field — Content, Media and Gallery.
 *
 * Pages and Products both carry one; Events was the odd collection out, so an
 * event page could only ever be the shape the template gave it. A workshop that
 * wants an agenda, a screening that wants a synopsis and a poster: none of that
 * had anywhere to go.
 *
 * THREE blocks, not the twenty-five Pages offers. Each block on a collection is
 * its own table (plus its nested arrays and enums) written by hand, and this
 * repo already grows them one at a time — `20260823_120000_pages_comments_block`
 * is exactly that. Content covers rich text with inline uploads and links, which
 * is most of what an event page needs; Media and Gallery cover the rest. The
 * next one that earns its place gets the same treatment.
 *
 * The Comments block is deliberately NOT here: every event renders the thread
 * natively now, and offering the block as well would let someone put two
 * separate threads on one page.
 *
 * `events_rels` has to exist for the first time. Content's link_type defaults to
 * 'reference', and a reference link is stored as a row on the owning
 * collection's rels table — without it, saving a Content column with an internal
 * link fails.
 *
 * Column shapes are copied from the live `pages_blocks_*` tables rather than
 * written from the config, because the failure mode for guessing is an admin
 * screen that renders BLANK with no error.
 *
 * Events do NOT use Payload drafts (they carry their own `status`), so there is
 * no `_events_v` twin for any of this.
 *
 * @see project_frozen_migration_rule — new file, never an edit to an applied one
 * @see project_schema_field_deploy_rule — the tables land before the config ships
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // ── enums ────────────────────────────────────────────────────────────────
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_events_blocks_content_columns_size" AS ENUM('oneThird','half','twoThirds','full');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_events_blocks_content_columns_link_type" AS ENUM('reference','custom');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_events_blocks_content_columns_link_appearance" AS ENUM('default','outline');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "enum_events_blocks_gallery_columns" AS ENUM('2','3','4');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  // ── rels ─────────────────────────────────────────────────────────────────
  // First rels table this collection has ever had: every relationship on Events
  // so far was hasMany:false and therefore a plain column.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "events_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "pages_id" integer,
      "posts_id" integer,
      "products_id" integer
    );
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "events_rels" ADD CONSTRAINT "events_rels_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  for (const [col, target] of [
    ['pages_id', 'pages'],
    ['posts_id', 'posts'],
    ['products_id', 'products'],
  ] as const) {
    await db.execute(
      sql.raw(`
      DO $$ BEGIN
        ALTER TABLE "events_rels" ADD CONSTRAINT "events_rels_${col}_fk"
          FOREIGN KEY ("${col}") REFERENCES "${target}"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `),
    )
    await db.execute(
      sql.raw(`CREATE INDEX IF NOT EXISTS "events_rels_${col}_idx" ON "events_rels" ("${col}");`),
    )
  }
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "events_rels_parent_idx" ON "events_rels" ("parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "events_rels_path_idx" ON "events_rels" ("path");`)

  // ── content ──────────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "events_blocks_content" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "block_name" varchar
    );
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "events_blocks_content_columns" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "size" "enum_events_blocks_content_columns_size" DEFAULT 'oneThird',
      "rich_text" jsonb,
      "enable_link" boolean,
      "link_type" "enum_events_blocks_content_columns_link_type" DEFAULT 'reference',
      "link_new_tab" boolean,
      "link_url" varchar,
      "link_label" varchar,
      "link_appearance" "enum_events_blocks_content_columns_link_appearance" DEFAULT 'default'
    );
  `)

  // ── media ────────────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "events_blocks_media_block" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "media_id" integer,
      "block_name" varchar
    );
  `)

  // ── gallery ──────────────────────────────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "events_blocks_gallery" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "heading" varchar,
      "columns" "enum_events_blocks_gallery_columns" DEFAULT '3',
      "block_name" varchar
    );
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "events_blocks_gallery_images" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "image_id" integer NOT NULL
    );
  `)

  // ── keys ─────────────────────────────────────────────────────────────────
  // Blocks CASCADE from the event; nested arrays CASCADE from their block. An FK
  // that SET NULLs a column its consumer assumes is present is a live outage,
  // and every one of these columns is NOT NULL.
  const parents: Array<[string, string, string]> = [
    ['events_blocks_content', 'events', '_parent_id'],
    ['events_blocks_content_columns', 'events_blocks_content', '_parent_id'],
    ['events_blocks_media_block', 'events', '_parent_id'],
    ['events_blocks_gallery', 'events', '_parent_id'],
    ['events_blocks_gallery_images', 'events_blocks_gallery', '_parent_id'],
  ]
  for (const [table, target, col] of parents) {
    await db.execute(
      sql.raw(`
      DO $$ BEGIN
        ALTER TABLE "${table}" ADD CONSTRAINT "${table}_parent_id_fk"
          FOREIGN KEY ("${col}") REFERENCES "${target}"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `),
    )
    await db.execute(
      sql.raw(`CREATE INDEX IF NOT EXISTS "${table}_parent_id_idx" ON "${table}" ("${col}");`),
    )
    await db.execute(
      sql.raw(`CREATE INDEX IF NOT EXISTS "${table}_order_idx" ON "${table}" ("_order");`),
    )
  }

  // Media uploads SET NULL — a deleted image must not take the block with it.
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "events_blocks_media_block" ADD CONSTRAINT "events_blocks_media_block_media_id_fk"
        FOREIGN KEY ("media_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  // gallery_images.image_id is NOT NULL, so SET NULL would contradict itself the
  // way membership_fk_cascade documents. CASCADE: delete the image, lose the row.
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "events_blocks_gallery_images" ADD CONSTRAINT "events_blocks_gallery_images_image_id_fk"
        FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "events_blocks_media_block_media_idx" ON "events_blocks_media_block" ("media_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "events_blocks_gallery_images_image_idx" ON "events_blocks_gallery_images" ("image_id");`)

  // `_path` carries the field path Payload reads blocks back by; every existing
  // row for a single top-level blocks field has the same value.
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "events_blocks_content_path_idx" ON "events_blocks_content" ("_path");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "events_blocks_media_block_path_idx" ON "events_blocks_media_block" ("_path");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "events_blocks_gallery_path_idx" ON "events_blocks_gallery" ("_path");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "events_blocks_gallery_images";`)
  await db.execute(sql`DROP TABLE IF EXISTS "events_blocks_gallery";`)
  await db.execute(sql`DROP TABLE IF EXISTS "events_blocks_media_block";`)
  await db.execute(sql`DROP TABLE IF EXISTS "events_blocks_content_columns";`)
  await db.execute(sql`DROP TABLE IF EXISTS "events_blocks_content";`)
  await db.execute(sql`DROP TABLE IF EXISTS "events_rels";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_events_blocks_gallery_columns";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_events_blocks_content_columns_link_appearance";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_events_blocks_content_columns_link_type";`)
  await db.execute(sql`DROP TYPE IF EXISTS "enum_events_blocks_content_columns_size";`)
}
