import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add the `listings` table — the bookable-inventory primitive.
 *
 * @see src/collections/Listings — the collection this materializes
 * @see docs/strategy/BOOKABLE_INVENTORY_PLAN.md
 *
 * Purely ADDITIVE: a new table + `listings_rels` (media hasMany) + two enums +
 * the standard locked-documents rel column. No existing table is altered except
 * `payload_locked_documents_rels` (one new nullable column). Tenant-scoped via
 * the multi-tenant plugin (`tenant_id`).
 *
 * Hand-written + idempotent (live DBs are dev-pushed; this is the deploy safety
 * net) — every statement uses IF NOT EXISTS / duplicate-object guards, matching
 * the team convention (see 20260626_190000_add_cost_events).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_listings_mode" AS ENUM('facility', 'stay', 'rent');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_listings_rate_unit" AS ENUM('hour', 'day', 'night', 'month');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "listings" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenant_id" integer,
      "title" varchar NOT NULL,
      "mode" "enum_listings_mode" DEFAULT 'facility' NOT NULL,
      "unit_type" varchar,
      "description" varchar,
      "capacity" numeric,
      "rate_cents" numeric,
      "rate_unit" "enum_listings_rate_unit" DEFAULT 'hour',
      "min_units" numeric,
      "cleaning_fee_cents" numeric,
      "deposit_cents" numeric,
      "deposit_percent" numeric,
      "security_deposit_cents" numeric,
      "attributes" jsonb,
      "owner_id" integer,
      "is_active" boolean DEFAULT true,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "listings_rels" (
      "id" serial PRIMARY KEY NOT NULL,
      "order" integer,
      "parent_id" integer NOT NULL,
      "path" varchar NOT NULL,
      "media_id" integer
    );

    DO $$ BEGIN
      ALTER TABLE "listings" ADD CONSTRAINT "listings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "listings" ADD CONSTRAINT "listings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "listings_rels" ADD CONSTRAINT "listings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "listings_rels" ADD CONSTRAINT "listings_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE INDEX IF NOT EXISTS "listings_tenant_idx" ON "listings" USING btree ("tenant_id");
    CREATE INDEX IF NOT EXISTS "listings_mode_idx" ON "listings" USING btree ("mode");
    CREATE INDEX IF NOT EXISTS "listings_owner_idx" ON "listings" USING btree ("owner_id");
    CREATE INDEX IF NOT EXISTS "listings_is_active_idx" ON "listings" USING btree ("is_active");
    CREATE INDEX IF NOT EXISTS "listings_updated_at_idx" ON "listings" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "listings_created_at_idx" ON "listings" USING btree ("created_at");

    CREATE INDEX IF NOT EXISTS "listings_rels_order_idx" ON "listings_rels" USING btree ("order");
    CREATE INDEX IF NOT EXISTS "listings_rels_parent_idx" ON "listings_rels" USING btree ("parent_id");
    CREATE INDEX IF NOT EXISTS "listings_rels_path_idx" ON "listings_rels" USING btree ("path");
    CREATE INDEX IF NOT EXISTS "listings_rels_media_id_idx" ON "listings_rels" USING btree ("media_id");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "listings_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_listings_fk" FOREIGN KEY ("listings_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_listings_id_idx" ON "payload_locked_documents_rels" USING btree ("listings_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "listings_id";
    DROP TABLE IF EXISTS "listings_rels" CASCADE;
    DROP TABLE IF EXISTS "listings" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_listings_mode";
    DROP TYPE IF EXISTS "public"."enum_listings_rate_unit";
  `)
}
