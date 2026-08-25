import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Works: the fields a person edits become real Payload fields.
 *
 * `tags` and `links` were `jsonb`, so the admin rendered them as raw JSON
 * textareas — which is most of why there is no usable Works editor. They become
 * array sub-tables; `canonical` becomes a group (flattened to columns).
 *
 * Table shape copied from a Payload-GENERATED array table (`products_gallery`)
 * rather than invented: `_order`, `_parent_id` → parent ON DELETE CASCADE, a
 * varchar `id` primary key, and the two `_order` / `_parent_id` indexes. Works
 * has no drafts, so there is no `_works_v` twin to mirror.
 *
 * The old JSON is copied into the new tables BEFORE the columns are dropped, in
 * this one transaction — six rows, and the data is in the migration's hands the
 * whole time.
 *
 * `subscribers` / `optOuts` / `storageRef` / `content` deliberately STAY json:
 * availability already has a real surface at /dashboard/works, and the rest is
 * plumbing nobody hand-edits.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      CREATE TABLE IF NOT EXISTS "works_tags" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "id" varchar NOT NULL,
        "tag" varchar,
        CONSTRAINT "works_tags_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "works_tags_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "works"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "works_tags_order_idx" ON "works_tags" ("_order");
      CREATE INDEX IF NOT EXISTS "works_tags_parent_id_idx" ON "works_tags" ("_parent_id");

      CREATE TABLE IF NOT EXISTS "works_links" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "id" varchar NOT NULL,
        "label" varchar,
        "url" varchar,
        CONSTRAINT "works_links_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "works_links_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "works"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "works_links_order_idx" ON "works_links" ("_order");
      CREATE INDEX IF NOT EXISTS "works_links_parent_id_idx" ON "works_links" ("_parent_id");

      ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "canonical_origin" varchar;
      ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "canonical_endeavor" varchar;
      ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "canonical_credited_to" varchar;
    `),
  )

  // ── Backfill, before anything is dropped ──────────────────────────────────
  await db.execute(
    sql.raw(`
      INSERT INTO "works_tags" ("_order", "_parent_id", "id", "tag")
      SELECT t.ord, w.id, gen_random_uuid()::text, t.value #>> '{}'
      FROM "works" w
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(w.tags) = 'array' THEN w.tags ELSE '[]'::jsonb END
      ) WITH ORDINALITY AS t(value, ord)
      WHERE jsonb_typeof(t.value) = 'string';

      INSERT INTO "works_links" ("_order", "_parent_id", "id", "label", "url")
      SELECT l.ord, w.id, gen_random_uuid()::text, l.value ->> 'label', l.value ->> 'url'
      FROM "works" w
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE WHEN jsonb_typeof(w.links) = 'array' THEN w.links ELSE '[]'::jsonb END
      ) WITH ORDINALITY AS l(value, ord)
      WHERE l.value ->> 'url' IS NOT NULL;

      UPDATE "works" SET
        "canonical_origin"      = "canonical" ->> 'origin',
        "canonical_endeavor"    = "canonical" ->> 'endeavor',
        "canonical_credited_to" = "canonical" ->> 'creditedTo'
      WHERE jsonb_typeof("canonical") = 'object';
    `),
  )

  await db.execute(
    sql.raw(`
      ALTER TABLE "works" DROP COLUMN IF EXISTS "tags";
      ALTER TABLE "works" DROP COLUMN IF EXISTS "links";
      ALTER TABLE "works" DROP COLUMN IF EXISTS "canonical";

      -- Two Works sharing a slug would resolve to whichever the registry saw
      -- first, silently. There is no legitimate reason for a duplicate.
      DROP INDEX IF EXISTS "works_slug_idx";
      CREATE UNIQUE INDEX IF NOT EXISTS "works_slug_idx" ON "works" ("slug");
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "tags" jsonb;
      ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "links" jsonb;
      ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "canonical" jsonb;

      UPDATE "works" w SET "tags" = COALESCE(
        (SELECT jsonb_agg(t.tag ORDER BY t._order) FROM "works_tags" t WHERE t._parent_id = w.id),
        '[]'::jsonb);

      UPDATE "works" w SET "links" = COALESCE(
        (SELECT jsonb_agg(jsonb_build_object('label', l.label, 'url', l.url) ORDER BY l._order)
         FROM "works_links" l WHERE l._parent_id = w.id),
        '[]'::jsonb);

      UPDATE "works" SET "canonical" = jsonb_strip_nulls(jsonb_build_object(
        'origin', "canonical_origin",
        'endeavor', "canonical_endeavor",
        'creditedTo', "canonical_credited_to"))
      WHERE "canonical_origin" IS NOT NULL
         OR "canonical_endeavor" IS NOT NULL
         OR "canonical_credited_to" IS NOT NULL;

      DROP TABLE IF EXISTS "works_tags";
      DROP TABLE IF EXISTS "works_links";
      ALTER TABLE "works" DROP COLUMN IF EXISTS "canonical_origin";
      ALTER TABLE "works" DROP COLUMN IF EXISTS "canonical_endeavor";
      ALTER TABLE "works" DROP COLUMN IF EXISTS "canonical_credited_to";

      DROP INDEX IF EXISTS "works_slug_idx";
      CREATE INDEX IF NOT EXISTS "works_slug_idx" ON "works" ("slug");
    `),
  )
}
