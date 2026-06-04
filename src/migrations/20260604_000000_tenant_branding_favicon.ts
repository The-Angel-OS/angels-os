import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add tenants.branding.favicon (upload → media) so each endeavor can set its own
 * favicon. Mirrors branding_logo_id exactly (integer, nullable, FK → media ON
 * DELETE SET NULL, + btree index).
 *
 * Idempotent: prod already has this column (applied directly during the incident
 * where the field shipped before the column existed); this migration brings other
 * environments / fresh databases in line.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "branding_favicon_id" integer;
    DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'tenants_branding_favicon_id_media_id_fk'
      ) THEN
        ALTER TABLE "tenants" ADD CONSTRAINT "tenants_branding_favicon_id_media_id_fk"
          FOREIGN KEY ("branding_favicon_id") REFERENCES "public"."media"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS "tenants_branding_branding_favicon_idx"
      ON "tenants" USING btree ("branding_favicon_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "tenants_branding_branding_favicon_idx";
    ALTER TABLE "tenants" DROP CONSTRAINT IF EXISTS "tenants_branding_favicon_id_media_id_fk";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "branding_favicon_id";
  `)
}
