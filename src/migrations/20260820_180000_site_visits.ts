import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * site_visits — the Site Log table.
 *
 * The schema-before-deploy rule: a new collection needs its column in prod BEFORE
 * the code that reads it ships, or the first request 500s. Hand-written and
 * idempotent so it is safe to run on a node that already has the table.
 *
 * `visitor_hash` stores a salted, daily-rotating digest of IP + user agent — never
 * an IP. Indexed because "unique visitors" is a COUNT DISTINCT over it, and
 * because the returning-visitor report groups on it.
 *
 * @see src/collections/SiteVisits/index.ts
 * @see src/utilities/recordSiteVisit.ts
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      CREATE TABLE IF NOT EXISTS "site_visits" (
        "id" serial PRIMARY KEY NOT NULL,
        "path" varchar NOT NULL,
        "referrer" varchar,
        "referrer_host" varchar,
        "user_agent" varchar,
        "browser" varchar,
        "os" varchar,
        "device" varchar DEFAULT 'desktop',
        "is_bot" boolean DEFAULT false,
        "visitor_hash" varchar,
        "user_id" integer,
        "tenant_id" integer,
        "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
      );

      DO $$ BEGIN
        ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_user_id_users_id_fk"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      DO $$ BEGIN
        ALTER TABLE "site_visits" ADD CONSTRAINT "site_visits_tenant_id_tenants_id_fk"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      -- Every report filters by tenant + date first; the rest are the GROUP BY keys.
      CREATE INDEX IF NOT EXISTS "site_visits_tenant_created_idx"
        ON "site_visits" ("tenant_id", "created_at");
      CREATE INDEX IF NOT EXISTS "site_visits_path_idx" ON "site_visits" ("path");
      CREATE INDEX IF NOT EXISTS "site_visits_referrer_host_idx" ON "site_visits" ("referrer_host");
      CREATE INDEX IF NOT EXISTS "site_visits_browser_idx" ON "site_visits" ("browser");
      CREATE INDEX IF NOT EXISTS "site_visits_os_idx" ON "site_visits" ("os");
      CREATE INDEX IF NOT EXISTS "site_visits_device_idx" ON "site_visits" ("device");
      CREATE INDEX IF NOT EXISTS "site_visits_is_bot_idx" ON "site_visits" ("is_bot");
      CREATE INDEX IF NOT EXISTS "site_visits_visitor_hash_idx" ON "site_visits" ("visitor_hash");
      CREATE INDEX IF NOT EXISTS "site_visits_user_idx" ON "site_visits" ("user_id");
      CREATE INDEX IF NOT EXISTS "site_visits_created_at_idx" ON "site_visits" ("created_at");

      -- ⚠️ A NEW COLLECTION ALSO NEEDS ITS COLUMN ON THE LOCKED-DOCS RELS TABLE.
      -- Payload generates the admin's document-lock query from the live config, so
      -- the moment site-visits was registered that query selected a column that
      -- did not exist — and EVERY admin save failed, media uploads included, with
      -- "Failed query: select distinct payload_locked_documents...". Missing this
      -- took the admin panel down on 260820. /api/provision-ops/db-repair-locks
      -- is the live fix; this line is why a fresh node never needs it.
      ALTER TABLE "payload_locked_documents_rels"
        ADD COLUMN IF NOT EXISTS "site_visits_id" integer;

      DO $$ BEGIN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_site_visits_fk"
          FOREIGN KEY ("site_visits_id") REFERENCES "site_visits"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_site_visits_id_idx"
        ON "payload_locked_documents_rels" ("site_visits_id");
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "site_visits_id";
      DROP TABLE IF EXISTS "site_visits";
    `),
  )
}
