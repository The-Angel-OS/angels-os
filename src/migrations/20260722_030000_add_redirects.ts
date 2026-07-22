import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Redirects collection — tenant-scoped old-URL → new-destination map for site
 * migrations (first consumer: NeuroCare Pro's ~112-page WordPress site).
 * Matches Payload's table shape for the collection defined in
 * src/collections/Redirects (text fields + tenant rel via the multi-tenant
 * plugin). Idempotent.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      CREATE TABLE IF NOT EXISTS "redirects" (
        "id" serial PRIMARY KEY,
        "from" varchar NOT NULL,
        "to" varchar NOT NULL,
        "enabled" boolean DEFAULT true,
        "note" varchar,
        "tenant_id" integer REFERENCES "tenants"("id") ON DELETE SET NULL,
        "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "redirects_from_idx" ON "redirects" ("from");
      CREATE INDEX IF NOT EXISTS "redirects_enabled_idx" ON "redirects" ("enabled");
      CREATE INDEX IF NOT EXISTS "redirects_tenant_idx" ON "redirects" ("tenant_id");
      CREATE INDEX IF NOT EXISTS "redirects_updated_at_idx" ON "redirects" ("updated_at");
      CREATE INDEX IF NOT EXISTS "redirects_created_at_idx" ON "redirects" ("created_at");
    `),
  )
  // Locked-documents / preferences rels columns — Payload expects a rels column
  // per collection on the shared locks table (the db-repair-locks drift rule).
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payload_locked_documents_rels') THEN
          ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "redirects_id" integer
            REFERENCES "redirects"("id") ON DELETE CASCADE;
          CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_redirects_id_idx"
            ON "payload_locked_documents_rels" ("redirects_id");
        END IF;
      END $$;
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payload_locked_documents_rels') THEN
          ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "redirects_id";
        END IF;
      END $$;
      DROP TABLE IF EXISTS "redirects";
    `),
  )
}
