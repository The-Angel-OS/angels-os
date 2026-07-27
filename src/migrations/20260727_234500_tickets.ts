import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Tickets — warranty claims, support requests and returns in one queue.
 *
 * `attachments` is an array field, so Payload stores it as its own table with
 * `_order` / `_parent_id`. No `tenant_id` is declared here by hand: the
 * multi-tenant plugin adds that column itself (declaring a second is a
 * DuplicateFieldName at config build — learned the hard way on
 * sequence-enrollments).
 *
 * Schema before deploy. @see docs/FOOTGUNS.md §2.4
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        CREATE TYPE "enum_tickets_type" AS ENUM ('warranty', 'support', 'return', 'question');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "enum_tickets_status" AS ENUM ('submitted', 'reviewing', 'approved', 'denied', 'resolved');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "enum_tickets_priority" AS ENUM ('low', 'normal', 'high', 'urgent');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      CREATE TABLE IF NOT EXISTS "tickets" (
        "id" serial PRIMARY KEY,
        "type" "enum_tickets_type" DEFAULT 'support' NOT NULL,
        "subject" varchar NOT NULL,
        "description" varchar,
        "status" "enum_tickets_status" DEFAULT 'submitted' NOT NULL,
        "priority" "enum_tickets_priority" DEFAULT 'normal',
        "requester_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
        "assignee_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
        "product_id" integer REFERENCES "products"("id") ON DELETE SET NULL,
        "purchase_date" timestamp(3) with time zone,
        "order_number" varchar,
        "seller_name" varchar,
        "resolution" varchar,
        "internal_notes" varchar,
        "channel_ref" varchar,
        "tenant_id" integer REFERENCES "tenants"("id") ON DELETE SET NULL,
        "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "tickets_type_idx" ON "tickets" ("type");
      CREATE INDEX IF NOT EXISTS "tickets_status_idx" ON "tickets" ("status");
      CREATE INDEX IF NOT EXISTS "tickets_priority_idx" ON "tickets" ("priority");
      CREATE INDEX IF NOT EXISTS "tickets_requester_idx" ON "tickets" ("requester_id");
      CREATE INDEX IF NOT EXISTS "tickets_assignee_idx" ON "tickets" ("assignee_id");
      CREATE INDEX IF NOT EXISTS "tickets_product_idx" ON "tickets" ("product_id");
      CREATE INDEX IF NOT EXISTS "tickets_order_number_idx" ON "tickets" ("order_number");
      CREATE INDEX IF NOT EXISTS "tickets_channel_ref_idx" ON "tickets" ("channel_ref");
      CREATE INDEX IF NOT EXISTS "tickets_tenant_idx" ON "tickets" ("tenant_id");
      CREATE INDEX IF NOT EXISTS "tickets_updated_at_idx" ON "tickets" ("updated_at");
      CREATE INDEX IF NOT EXISTS "tickets_created_at_idx" ON "tickets" ("created_at");

      -- The queue's hot read is "open tickets for this tenant, newest first".
      CREATE INDEX IF NOT EXISTS "tickets_queue_idx" ON "tickets" ("tenant_id", "status", "created_at");

      CREATE TABLE IF NOT EXISTS "tickets_attachments" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL REFERENCES "tickets"("id") ON DELETE CASCADE,
        "id" varchar PRIMARY KEY,
        "file_id" integer REFERENCES "media"("id") ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS "tickets_attachments_order_idx" ON "tickets_attachments" ("_order");
      CREATE INDEX IF NOT EXISTS "tickets_attachments_parent_id_idx" ON "tickets_attachments" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "tickets_attachments_file_idx" ON "tickets_attachments" ("file_id");
    `),
  )

  // Payload expects a rels column per collection on the shared locks table
  // (the db-repair-locks drift rule).
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payload_locked_documents_rels') THEN
          ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "tickets_id" integer
            REFERENCES "tickets"("id") ON DELETE CASCADE;
          CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_tickets_id_idx"
            ON "payload_locked_documents_rels" ("tickets_id");
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
          ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "tickets_id";
        END IF;
      END $$;
      DROP TABLE IF EXISTS "tickets_attachments";
      DROP TABLE IF EXISTS "tickets";
      DROP TYPE IF EXISTS "enum_tickets_priority";
      DROP TYPE IF EXISTS "enum_tickets_status";
      DROP TYPE IF EXISTS "enum_tickets_type";
    `),
  )
}
