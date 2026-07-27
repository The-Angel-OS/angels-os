import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Media.createdBy — the owner of an upload.
 *
 * Needed by the public ticket form: tenant scope stops a cross-tenant read, but
 * two customers of the SAME seller are both "in tenant", so without an owner one
 * could quote the other's media id at the claim form and have it rendered back.
 *
 * Existing rows stay NULL. That is correct, not a gap — nothing files claims
 * against historical uploads, and back-filling a guess would be worse than an
 * honest null. @see src/collections/Media/index.ts
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "created_by_id" integer
        REFERENCES "users"("id") ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS "media_created_by_idx" ON "media" ("created_by_id");
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DROP INDEX IF EXISTS "media_created_by_idx";
      ALTER TABLE "media" DROP COLUMN IF EXISTS "created_by_id";
    `),
  )
}
