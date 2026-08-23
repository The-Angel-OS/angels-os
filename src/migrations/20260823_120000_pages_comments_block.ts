import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The Comments block becomes available on Pages.
 *
 * It already existed on Posts and Products — and already renders star ratings,
 * so it is the review control as much as the comment one. Pages were the gap:
 * a church's "Facilities" page or a beta programme's "How it's going" page has
 * exactly the same reason to carry a thread as a post does.
 *
 * A block on a collection is TABLES, not just config. Both the live table and
 * the versions table, mirroring posts_blocks_comments exactly: CASCADE from the
 * parent, `id` varchar on the live side and int on the version side (Payload's
 * own convention — the live id is the block's uuid, the version row is serial),
 * and `_uuid` only on the version side.
 *
 * @see project_schema_field_deploy_rule — the column lands before the config ships
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "pages_blocks_comments" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "block_name" varchar,
      "heading" varchar DEFAULT 'Comments'
    );
  `)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "_pages_v_blocks_comments" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "_path" text NOT NULL,
      "id" serial PRIMARY KEY,
      "block_name" varchar,
      "heading" varchar DEFAULT 'Comments',
      "_uuid" varchar
    );
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "pages_blocks_comments"
        ADD CONSTRAINT "pages_blocks_comments_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "_pages_v_blocks_comments"
        ADD CONSTRAINT "_pages_v_blocks_comments_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "pages_blocks_comments_parent_id_idx" ON "pages_blocks_comments" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "_pages_v_blocks_comments_parent_id_idx" ON "_pages_v_blocks_comments" ("_parent_id");`)

  // The Comments collection's `parent` is a POLYMORPHIC relationship, stored as
  // one nullable id column per target on comments_rels. Adding 'pages' to
  // relationTo without this column means every page comment fails to save —
  // the config selects a column that is not there, the same shape as the
  // hero_scrim outage. CASCADE so deleting a page takes its comments with it,
  // matching how posts_id and products_id already behave.
  await db.execute(sql`ALTER TABLE "comments_rels" ADD COLUMN IF NOT EXISTS "pages_id" integer;`)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "comments_rels"
        ADD CONSTRAINT "comments_rels_pages_fk"
        FOREIGN KEY ("pages_id") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "comments_rels_pages_id_idx" ON "comments_rels" ("pages_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "comments_rels" DROP COLUMN IF EXISTS "pages_id";`)
  await db.execute(sql`DROP TABLE IF EXISTS "pages_blocks_comments";`)
  await db.execute(sql`DROP TABLE IF EXISTS "_pages_v_blocks_comments";`)
}
