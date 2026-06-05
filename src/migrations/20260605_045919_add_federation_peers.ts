import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add the `federation-peers` collection — remote Enterprises (Dioceses) in the
 * Angel OS mesh. The Enterprise is the unit of federation/trust/probation; its
 * Endeavors inherit (carried inline in `endeavors`).
 *
 * Scoped to ONLY the federation_peers tables and made fully idempotent: the live
 * databases were provisioned via dev-push (not formal migrations), so this must
 * be safe to run against an already-current schema as well as a fresh one. The
 * auto-generated diff bundled unrelated drift (favicon, membership-nullable,
 * connectors enum, donation blocks) — those are handled by their own migrations
 * / already applied, so they are intentionally excluded here.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_federation_peers_ministry_status" AS ENUM('applicant','probation','active','suspended','revoked','dormant');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_federation_peers_trust_level" AS ENUM('none','probationary','vouched','full');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "federation_peers" (
      "id" serial PRIMARY KEY NOT NULL,
      "federation_id" varchar NOT NULL,
      "name" varchar NOT NULL,
      "domain" varchar,
      "public_key" varchar,
      "ministry_status" "enum_federation_peers_ministry_status" DEFAULT 'applicant' NOT NULL,
      "trust_level" "enum_federation_peers_trust_level" DEFAULT 'none',
      "constitution_version" varchar,
      "capabilities" jsonb,
      "region_country" varchar,
      "region_region" varchar,
      "region_city" varchar,
      "region_latitude" numeric,
      "region_longitude" numeric,
      "network_visible" boolean DEFAULT true,
      "first_seen_at" timestamp(3) with time zone,
      "probation_started_at" timestamp(3) with time zone,
      "activated_at" timestamp(3) with time zone,
      "last_heartbeat_at" timestamp(3) with time zone,
      "consecutive_failures" numeric DEFAULT 0,
      "capacity_snapshot" jsonb,
      "endeavors" jsonb,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "federation_peers_vouches_received" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "voucher_id" varchar NOT NULL,
      "voucher_name" varchar,
      "vouched_at" timestamp(3) with time zone,
      "reason" varchar,
      "is_valid" boolean DEFAULT true
    );

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "federation_peers_id" integer;

    DO $$ BEGIN
      ALTER TABLE "federation_peers_vouches_received"
        ADD CONSTRAINT "federation_peers_vouches_received_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "public"."federation_peers"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels"
        ADD CONSTRAINT "payload_locked_documents_rels_federation_peers_fk"
        FOREIGN KEY ("federation_peers_id") REFERENCES "public"."federation_peers"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "federation_peers_federation_id_idx" ON "federation_peers" USING btree ("federation_id");
    CREATE INDEX IF NOT EXISTS "federation_peers_domain_idx" ON "federation_peers" USING btree ("domain");
    CREATE INDEX IF NOT EXISTS "federation_peers_ministry_status_idx" ON "federation_peers" USING btree ("ministry_status");
    CREATE INDEX IF NOT EXISTS "federation_peers_network_visible_idx" ON "federation_peers" USING btree ("network_visible");
    CREATE INDEX IF NOT EXISTS "federation_peers_last_heartbeat_at_idx" ON "federation_peers" USING btree ("last_heartbeat_at");
    CREATE INDEX IF NOT EXISTS "federation_peers_updated_at_idx" ON "federation_peers" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "federation_peers_created_at_idx" ON "federation_peers" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "federation_peers_vouches_received_order_idx" ON "federation_peers_vouches_received" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "federation_peers_vouches_received_parent_id_idx" ON "federation_peers_vouches_received" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_federation_peers_id_idx" ON "payload_locked_documents_rels" USING btree ("federation_peers_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_federation_peers_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_federation_peers_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "federation_peers_id";
    DROP TABLE IF EXISTS "federation_peers_vouches_received" CASCADE;
    DROP TABLE IF EXISTS "federation_peers" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_federation_peers_ministry_status";
    DROP TYPE IF EXISTS "public"."enum_federation_peers_trust_level";
  `)
}
