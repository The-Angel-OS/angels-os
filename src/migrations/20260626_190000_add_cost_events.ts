import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add the `cost_events` table — the unified Operating-Costs ledger.
 *
 * @see src/collections/CostEvents — the collection this materializes
 * @see src/utilities/recordCostEvent — the fail-soft writer
 *
 * Append-only, tenant-scoped (nullable tenant). Purely ADDITIVE: a brand-new
 * table + two enums + the standard locked-documents rel column. No existing
 * table is altered except `payload_locked_documents_rels` (one new nullable
 * column), so there is no risk to existing data.
 *
 * Hand-written + idempotent (live DBs are dev-pushed; this is the safety net,
 * matching the team convention — every statement uses IF NOT EXISTS / duplicate
 * exception guards so it is safe to re-run).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_cost_events_category" AS ENUM('intelligence', 'telephony', 'storage', 'infra', 'other');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_cost_events_unit" AS ENUM('tokens', 'seconds', 'minutes', 'bytes', 'gb', 'requests', 'count');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "cost_events" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenant_id" integer,
      "category" "enum_cost_events_category" DEFAULT 'intelligence' NOT NULL,
      "source" varchar NOT NULL,
      "provider" varchar,
      "cost_cents" numeric,
      "cost_estimated" boolean DEFAULT true,
      "currency" varchar DEFAULT 'usd',
      "billed_to_tenant_key" boolean DEFAULT false,
      "quantity" numeric,
      "unit" "enum_cost_events_unit",
      "model" varchar,
      "tier" varchar,
      "input_tokens" numeric,
      "output_tokens" numeric,
      "total_tokens" numeric,
      "latency_ms" numeric,
      "ttft_ms" numeric,
      "finish_reason" varchar,
      "tool_call_count" numeric,
      "failed_over" boolean,
      "message_ref_id" integer,
      "conversation_id" varchar,
      "user_id" varchar,
      "occurred_at" timestamp(3) with time zone,
      "metadata" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "cost_events" ADD CONSTRAINT "cost_events_message_ref_id_messages_id_fk" FOREIGN KEY ("message_ref_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "cost_events_tenant_idx" ON "cost_events" USING btree ("tenant_id");
    CREATE INDEX IF NOT EXISTS "cost_events_category_idx" ON "cost_events" USING btree ("category");
    CREATE INDEX IF NOT EXISTS "cost_events_source_idx" ON "cost_events" USING btree ("source");
    CREATE INDEX IF NOT EXISTS "cost_events_provider_idx" ON "cost_events" USING btree ("provider");
    CREATE INDEX IF NOT EXISTS "cost_events_cost_cents_idx" ON "cost_events" USING btree ("cost_cents");
    CREATE INDEX IF NOT EXISTS "cost_events_billed_to_tenant_key_idx" ON "cost_events" USING btree ("billed_to_tenant_key");
    CREATE INDEX IF NOT EXISTS "cost_events_model_idx" ON "cost_events" USING btree ("model");
    CREATE INDEX IF NOT EXISTS "cost_events_conversation_id_idx" ON "cost_events" USING btree ("conversation_id");
    CREATE INDEX IF NOT EXISTS "cost_events_user_id_idx" ON "cost_events" USING btree ("user_id");
    CREATE INDEX IF NOT EXISTS "cost_events_occurred_at_idx" ON "cost_events" USING btree ("occurred_at");
    CREATE INDEX IF NOT EXISTS "cost_events_message_ref_idx" ON "cost_events" USING btree ("message_ref_id");
    CREATE INDEX IF NOT EXISTS "cost_events_updated_at_idx" ON "cost_events" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "cost_events_created_at_idx" ON "cost_events" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "cost_events_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cost_events_fk" FOREIGN KEY ("cost_events_id") REFERENCES "public"."cost_events"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_cost_events_id_idx" ON "payload_locked_documents_rels" USING btree ("cost_events_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "cost_events_id";
    DROP TABLE IF EXISTS "cost_events" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_cost_events_category";
    DROP TYPE IF EXISTS "public"."enum_cost_events_unit";
  `)
}
