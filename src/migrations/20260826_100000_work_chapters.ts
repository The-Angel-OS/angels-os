import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * work-chapters — Works chapters become rows, and get an editor.
 *
 * They were `messages` rows with `metadata.kind = 'work_chapter'` filed under a
 * channel string that does not exist in `channels`. 1,245 of them, 27% of the
 * Messages table, with `order` as a JSON key rather than a column — which is
 * why serving one Bible page read all 1,189 chapters.
 *
 * ⚠️ The backfill joins on `works.storage_ref` (space AND channel), not on the
 * channel name alone. The Handbook exists twice — 7 chapters in space 6 and an
 * identical 7 in space 30 — and only space 6 is its storage-of-record. The join
 * drops the orphan copy for free: 1,238 rows, not 1,245.
 *
 * ⚠️ The message rows are NOT deleted. `storage_ref.kind` becomes 'rows' and the
 * old value is the rollback; a later migration can drop them once this has run
 * in production for a week.
 *
 * Table shape copied from Payload-GENERATED tables (`tickets`, `products_gallery`)
 * rather than invented. No drafts, so there is no `_work_chapters_v` twin.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      CREATE TABLE IF NOT EXISTS "work_chapters" (
        "id" serial PRIMARY KEY,
        "work_id" integer NOT NULL REFERENCES "works"("id") ON DELETE CASCADE,
        "order" numeric NOT NULL,
        "slug" varchar,
        "title" varchar,
        "body" varchar,
        "image" varchar,
        "module" varchar,
        "video" varchar,
        "tier" varchar,
        "badge" varchar,
        "badge_color" varchar,
        "date" varchar,
        "description" varchar,
        "book" varchar,
        "book_name" varchar,
        "chapter" numeric,
        "ref" varchar,
        "translations" jsonb,
        "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "work_chapters_work_idx" ON "work_chapters" ("work_id");
      CREATE INDEX IF NOT EXISTS "work_chapters_order_idx" ON "work_chapters" ("order");
      CREATE INDEX IF NOT EXISTS "work_chapters_slug_idx" ON "work_chapters" ("slug");
      CREATE INDEX IF NOT EXISTS "work_chapters_updated_at_idx" ON "work_chapters" ("updated_at");
      CREATE INDEX IF NOT EXISTS "work_chapters_created_at_idx" ON "work_chapters" ("created_at");

      -- The hot read: one Work's chapters in order (and, with a range, a window
      -- of them). This index is the whole point of the move.
      CREATE INDEX IF NOT EXISTS "work_chapters_reader_idx" ON "work_chapters" ("work_id", "order");
    `),
  )

  // Payload expects a rels column per collection on the shared locks table.
  // Without it EVERY admin save fails, site-wide — media uploads included.
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payload_locked_documents_rels') THEN
          ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "work_chapters_id" integer
            REFERENCES "work_chapters"("id") ON DELETE CASCADE;
          CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_work_chapters_id_idx"
            ON "payload_locked_documents_rels" ("work_chapters_id");
        END IF;
      END $$;
    `),
  )

  // ── Backfill from the message rows ────────────────────────────────────────
  await db.execute(
    sql.raw(`
      INSERT INTO "work_chapters" (
        "work_id", "order", "slug", "title", "body", "image", "tier", "badge",
        "badge_color", "date", "description", "book", "book_name", "chapter",
        "ref", "translations", "created_at", "updated_at"
      )
      SELECT
        w.id,
        COALESCE((m.metadata ->> 'order')::numeric, 0),
        COALESCE(m.metadata ->> 'chapterSlug', m.metadata ->> 'slug'),
        NULLIF(m.metadata ->> 'title', ''),
        COALESCE(m.content ->> 'text', ''),
        NULLIF(m.metadata ->> 'image', ''),
        NULLIF(m.metadata ->> 'tier', ''),
        NULLIF(m.metadata ->> 'badge', ''),
        NULLIF(m.metadata ->> 'badgeColor', ''),
        NULLIF(m.metadata ->> 'date', ''),
        NULLIF(m.metadata ->> 'description', ''),
        NULLIF(m.metadata ->> 'book', ''),
        NULLIF(m.metadata ->> 'bookName', ''),
        (m.metadata ->> 'chapter')::numeric,
        NULLIF(m.metadata ->> 'ref', ''),
        CASE WHEN jsonb_typeof(m.metadata -> 'translations') = 'object'
             THEN m.metadata -> 'translations' END,
        m.created_at,
        m.updated_at
      FROM "messages" m
      JOIN "works" w
        ON  w.storage_ref ->> 'channel' = m.channel
        AND (w.storage_ref ->> 'space')::int = m.space_id
      WHERE m.metadata ->> 'kind' = 'work_chapter'
        AND NOT EXISTS (SELECT 1 FROM "work_chapters" c WHERE c.work_id = w.id);

      -- Storage-of-record is now rows. The old pointer is preserved as
      -- messagesRef so this is reversible without guessing.
      UPDATE "works"
      SET "storage_ref" = jsonb_set(
            jsonb_set("storage_ref", '{kind}', '"rows"'),
            '{messagesRef}', "storage_ref")
      WHERE jsonb_typeof("storage_ref") = 'object'
        AND "storage_ref" ->> 'kind' = 'messages'
        AND EXISTS (SELECT 1 FROM "work_chapters" c WHERE c.work_id = "works".id);
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      UPDATE "works"
      SET "storage_ref" = "storage_ref" -> 'messagesRef'
      WHERE jsonb_typeof("storage_ref" -> 'messagesRef') = 'object';

      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payload_locked_documents_rels') THEN
          ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "work_chapters_id";
        END IF;
      END $$;
      DROP TABLE IF EXISTS "work_chapters";
    `),
  )
}
