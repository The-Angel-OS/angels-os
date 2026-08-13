import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * `spaces.is_system` — the flag five call sites were already reading.
 *
 * The dashboard's default-space pick, SpacesChat and the settings guard all
 * test `space.isSystem`, and the field had never been declared, so every read
 * was `undefined`: `find(s => !s.isSystem)` matched the AI Bus as readily as a
 * real room. Some sites had grown a `slug === 'ai-bus'` fallback to compensate.
 *
 * Backfilled from the slugs those fallbacks were checking, so the flag starts
 * out agreeing with the behaviour already in place rather than changing it.
 *
 * @see src/collections/Spaces/index.ts
 * @see src/endpoints/space-delete.ts — refuses to delete a system space
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "spaces"
      ADD COLUMN IF NOT EXISTS "is_system" boolean DEFAULT false;
    CREATE INDEX IF NOT EXISTS "spaces_is_system_idx" ON "spaces" ("is_system");
    UPDATE "spaces" SET "is_system" = true
      WHERE "slug" IN ('ai-bus', 'direct-messages') AND "is_system" IS DISTINCT FROM true;
    UPDATE "spaces" SET "is_system" = false WHERE "is_system" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "spaces_is_system_idx";
    ALTER TABLE "spaces" DROP COLUMN IF EXISTS "is_system";
  `)
}
