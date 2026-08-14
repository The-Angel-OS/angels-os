import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * `partners` + `orders.referral` — affiliate attribution.
 *
 * Hand-written rather than generated: `migrate:create` against the live DB stops
 * on unrelated pre-existing drift in `payload_mcp_api_keys` and asks a
 * create-or-rename question no script can answer. Everything here is
 * IF NOT EXISTS, and it only ADDS — no column is dropped, retyped or renamed, so
 * it is safe to run against a database that is already partly there.
 *
 * Per the deploy rule, this lands and runs BEFORE the config that references
 * these fields ships, or every Orders query errors on the missing columns.
 *
 * @see src/collections/Partners/index.ts
 * @see src/collections/Orders/index.ts — the `referral` group
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_partners_partner_status" AS ENUM('active', 'paused', 'ended');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_partners_payout_method" AS ENUM('manual', 'stripe', 'credit');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_orders_referral_payout_status" AS ENUM('pending', 'approved', 'paid', 'void');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "partners" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenant_id" integer,
      "name" varchar NOT NULL,
      "code" varchar NOT NULL,
      "email" varchar,
      "rate" numeric DEFAULT 10 NOT NULL,
      "partner_status" "enum_partners_partner_status" DEFAULT 'active' NOT NULL,
      "landing_page_id" integer,
      "payout_method" "enum_partners_payout_method" DEFAULT 'manual',
      "payout_stripe_account_id" varchar,
      "payout_notes" varchar,
      "notes" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "partners" ADD CONSTRAINT "partners_tenant_id_tenants_id_fk"
        FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "partners" ADD CONSTRAINT "partners_landing_page_id_pages_id_fk"
        FOREIGN KEY ("landing_page_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "partners_tenant_idx" ON "partners" USING btree ("tenant_id");
    CREATE INDEX IF NOT EXISTS "partners_code_idx" ON "partners" USING btree ("code");
    CREATE INDEX IF NOT EXISTS "partners_email_idx" ON "partners" USING btree ("email");
    CREATE INDEX IF NOT EXISTS "partners_partner_status_idx" ON "partners" USING btree ("partner_status");
    CREATE INDEX IF NOT EXISTS "partners_updated_at_idx" ON "partners" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "partners_created_at_idx" ON "partners" USING btree ("created_at");

    -- A code is only useful if it is unique WITHIN the tenant that issued it;
    -- two tenants may both have a partner called "jane" and neither is wrong.
    CREATE UNIQUE INDEX IF NOT EXISTS "partners_tenant_code_key" ON "partners" USING btree ("tenant_id", "code");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "partners_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_partners_fk"
        FOREIGN KEY ("partners_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_partners_id_idx"
      ON "payload_locked_documents_rels" USING btree ("partners_id");

    -- Attribution snapshot on the order. code and rate are copied, not joined:
    -- renaming a code or renegotiating a rate must never rewrite what a partner
    -- already earned.
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "referral_partner_id" integer;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "referral_code" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "referral_rate" numeric;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "referral_commission" numeric;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "referral_landed_at" timestamp(3) with time zone;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "referral_landing_path" varchar;
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "referral_payout_status"
      "enum_orders_referral_payout_status" DEFAULT 'pending';

    DO $$ BEGIN
      ALTER TABLE "orders" ADD CONSTRAINT "orders_referral_partner_id_partners_id_fk"
        FOREIGN KEY ("referral_partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "orders_referral_partner_idx" ON "orders" USING btree ("referral_partner_id");
    CREATE INDEX IF NOT EXISTS "orders_referral_code_idx" ON "orders" USING btree ("referral_code");
    CREATE INDEX IF NOT EXISTS "orders_referral_payout_status_idx" ON "orders" USING btree ("referral_payout_status");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "orders_referral_partner_idx";
    DROP INDEX IF EXISTS "orders_referral_code_idx";
    DROP INDEX IF EXISTS "orders_referral_payout_status_idx";
    ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_referral_partner_id_partners_id_fk";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "referral_partner_id";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "referral_code";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "referral_rate";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "referral_commission";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "referral_landed_at";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "referral_landing_path";
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "referral_payout_status";

    ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_partners_fk";
    DROP INDEX IF EXISTS "payload_locked_documents_rels_partners_id_idx";
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "partners_id";

    DROP TABLE IF EXISTS "partners" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_partners_partner_status";
    DROP TYPE IF EXISTS "public"."enum_partners_payout_method";
    DROP TYPE IF EXISTS "public"."enum_orders_referral_payout_status";
  `)
}
