import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * `system_events` — the arrival ledger.
 *
 * Ten webhook endpoints did their work inline and left no trace; only Stripe
 * kept a row, and only for idempotency. An inbound SMS that threw halfway
 * simply never happened. @see src/collections/SystemEvents.ts
 *
 * The `payload_locked_documents_rels` column is NOT optional — without it every
 * admin save on this node fails. @see project_locked_documents_rels_rule
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        CREATE TYPE "enum_system_events_status" AS ENUM ('received', 'done', 'failed');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE TABLE IF NOT EXISTS "system_events" (
        "id" serial PRIMARY KEY NOT NULL,
        "source" varchar NOT NULL,
        "event_type" varchar,
        "external_id" varchar,
        "status" "enum_system_events_status" DEFAULT 'received' NOT NULL,
        "path" varchar,
        "duration_ms" numeric,
        "status_code" numeric,
        "error" varchar,
        "body" varchar,
        "tenant_id" integer,
        "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
      );

      DO $$ BEGIN
        ALTER TABLE "system_events" ADD CONSTRAINT "system_events_tenant_id_tenants_id_fk"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE set null ON UPDATE no action;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE INDEX IF NOT EXISTS "system_events_source_idx" ON "system_events" ("source");
      CREATE INDEX IF NOT EXISTS "system_events_external_id_idx" ON "system_events" ("external_id");
      CREATE INDEX IF NOT EXISTS "system_events_status_idx" ON "system_events" ("status");
      CREATE INDEX IF NOT EXISTS "system_events_tenant_idx" ON "system_events" ("tenant_id");
      CREATE INDEX IF NOT EXISTS "system_events_created_at_idx" ON "system_events" ("created_at");

      ALTER TABLE "payload_locked_documents_rels"
        ADD COLUMN IF NOT EXISTS "system_events_id" integer;

      DO $$ BEGIN
        ALTER TABLE "payload_locked_documents_rels"
          ADD CONSTRAINT "payload_locked_documents_rels_system_events_fk"
          FOREIGN KEY ("system_events_id") REFERENCES "system_events"("id") ON DELETE cascade ON UPDATE no action;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "system_events_id";
      DROP TABLE IF EXISTS "system_events";
      DROP TYPE IF EXISTS "enum_system_events_status";
    `),
  )
}
