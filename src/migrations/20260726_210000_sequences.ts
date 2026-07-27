import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Sequences + sequence-enrollments — the drip engine.
 *
 * Hand-written rather than generated: `payload migrate:create` goes interactive
 * over unrelated pre-existing drift in payload_mcp_api_keys, and answering
 * column-rename prompts blind is how you lose data. This covers exactly the two
 * new collections and nothing else.
 *
 * `sequences.steps` is an array field, which Payload stores as its own table
 * with `_order` / `_parent_id`, so it gets created here too.
 *
 * Schema before deploy. @see docs/FOOTGUNS.md §2.4
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        CREATE TYPE "enum_sequences_trigger" AS ENUM ('captured', 'manual');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "enum_sequence_enrollments_status" AS ENUM ('active', 'completed', 'stopped');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      DO $$ BEGIN
        CREATE TYPE "enum_sequence_enrollments_stopped_reason" AS ENUM ('purchased', 'unsubscribed', 'manual', 'failed');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      CREATE TABLE IF NOT EXISTS "sequences" (
        "id" serial PRIMARY KEY,
        "name" varchar NOT NULL,
        "trigger" "enum_sequences_trigger" DEFAULT 'captured' NOT NULL,
        "is_active" boolean DEFAULT false,
        "stop_on_purchase" boolean DEFAULT true,
        "tenant_id" integer REFERENCES "tenants"("id") ON DELETE SET NULL,
        "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "sequences_trigger_idx" ON "sequences" ("trigger");
      CREATE INDEX IF NOT EXISTS "sequences_is_active_idx" ON "sequences" ("is_active");
      CREATE INDEX IF NOT EXISTS "sequences_tenant_idx" ON "sequences" ("tenant_id");
      CREATE INDEX IF NOT EXISTS "sequences_updated_at_idx" ON "sequences" ("updated_at");
      CREATE INDEX IF NOT EXISTS "sequences_created_at_idx" ON "sequences" ("created_at");

      CREATE TABLE IF NOT EXISTS "sequences_steps" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL REFERENCES "sequences"("id") ON DELETE CASCADE,
        "id" varchar PRIMARY KEY,
        "delay_hours" numeric DEFAULT 24,
        "subject" varchar,
        "body" varchar
      );
      CREATE INDEX IF NOT EXISTS "sequences_steps_order_idx" ON "sequences_steps" ("_order");
      CREATE INDEX IF NOT EXISTS "sequences_steps_parent_id_idx" ON "sequences_steps" ("_parent_id");

      CREATE TABLE IF NOT EXISTS "sequence_enrollments" (
        "id" serial PRIMARY KEY,
        "sequence_id" integer REFERENCES "sequences"("id") ON DELETE SET NULL,
        "contact_id" integer REFERENCES "contacts"("id") ON DELETE SET NULL,
        "status" "enum_sequence_enrollments_status" DEFAULT 'active' NOT NULL,
        "stopped_reason" "enum_sequence_enrollments_stopped_reason",
        "current_step" numeric DEFAULT 0 NOT NULL,
        "next_send_at" timestamp(3) with time zone,
        "enrolled_at" timestamp(3) with time zone,
        "last_sent_at" timestamp(3) with time zone,
        "send_failures" numeric DEFAULT 0,
        "tenant_id" integer REFERENCES "tenants"("id") ON DELETE SET NULL,
        "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "sequence_enrollments_sequence_idx" ON "sequence_enrollments" ("sequence_id");
      CREATE INDEX IF NOT EXISTS "sequence_enrollments_contact_idx" ON "sequence_enrollments" ("contact_id");
      CREATE INDEX IF NOT EXISTS "sequence_enrollments_status_idx" ON "sequence_enrollments" ("status");
      CREATE INDEX IF NOT EXISTS "sequence_enrollments_tenant_idx" ON "sequence_enrollments" ("tenant_id");
      CREATE INDEX IF NOT EXISTS "sequence_enrollments_updated_at_idx" ON "sequence_enrollments" ("updated_at");
      CREATE INDEX IF NOT EXISTS "sequence_enrollments_created_at_idx" ON "sequence_enrollments" ("created_at");

      -- The tick's hot query is (status, next_send_at). Composite, because at
      -- campaign scale it runs every few minutes against every enrolment.
      CREATE INDEX IF NOT EXISTS "sequence_enrollments_due_idx"
        ON "sequence_enrollments" ("status", "next_send_at");
    `),
  )

  // Payload expects a rels column per collection on the shared locks table
  // (the db-repair-locks drift rule).
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payload_locked_documents_rels') THEN
          ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "sequences_id" integer
            REFERENCES "sequences"("id") ON DELETE CASCADE;
          ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "sequence_enrollments_id" integer
            REFERENCES "sequence_enrollments"("id") ON DELETE CASCADE;
          CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_sequences_id_idx"
            ON "payload_locked_documents_rels" ("sequences_id");
          CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_sequence_enrollments_id_idx"
            ON "payload_locked_documents_rels" ("sequence_enrollments_id");
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
          ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "sequences_id";
          ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "sequence_enrollments_id";
        END IF;
      END $$;
      DROP TABLE IF EXISTS "sequence_enrollments";
      DROP TABLE IF EXISTS "sequences_steps";
      DROP TABLE IF EXISTS "sequences";
      DROP TYPE IF EXISTS "enum_sequence_enrollments_stopped_reason";
      DROP TYPE IF EXISTS "enum_sequence_enrollments_status";
      DROP TYPE IF EXISTS "enum_sequences_trigger";
    `),
  )
}
