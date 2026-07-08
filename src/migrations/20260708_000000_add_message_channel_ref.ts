import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Phase 1 of re-keying messages to a stable channel id (moves/renames free forever).
 *
 * Messages are currently keyed by the denormalized pair (space_id, channel-slug),
 * which makes every structural edit — rename, move, delete-reassign — a bulk rewrite
 * and a slug-collision hazard. This adds a nullable `channel_ref_id` FK to the
 * canonical channel row and BACKFILLS it from the existing (space_id, slug) pair.
 *
 * NON-BREAKING: no code reads or writes this column yet (no Payload field added in
 * this phase), so nothing changes behaviourally. It just lands the column + data so
 * Phase 2 can flip reads to the id and make `move_channel` a one-field update.
 * Additive + idempotent (IF NOT EXISTS / NULL-guarded backfill).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "channel_ref_id" integer;
    CREATE INDEX IF NOT EXISTS "messages_channel_ref_idx" ON "messages" ("channel_ref_id");
  `)

  // Backfill: match each message to its channel row by (slug, space). Where a
  // space has duplicate channels for a slug, the oldest (lowest id) wins — stable
  // and deterministic. Only fills nulls, so it's safe to re-run.
  await db.execute(sql`
    UPDATE "messages" m
    SET "channel_ref_id" = c.id
    FROM (
      SELECT DISTINCT ON (space_id, slug) id, space_id, slug
      FROM "channels"
      ORDER BY space_id, slug, id ASC
    ) c
    WHERE m."channel_ref_id" IS NULL
      AND c.slug = m."channel"
      AND c.space_id = m."space_id";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "messages_channel_ref_idx";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "channel_ref_id";
  `)
}
