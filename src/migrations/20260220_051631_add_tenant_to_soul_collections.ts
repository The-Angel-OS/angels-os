import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Idempotent migration for Sprint 2-5 schema changes.
 *
 * Since dev and prod share a single database, `db push` in dev mode
 * may have already applied some or all of these changes. Every statement
 * uses IF NOT EXISTS / exception handling so it's safe to re-run.
 *
 * Also includes a DATA migration to back-fill tenant_id on channels,
 * messages, and space_memberships from their parent space's tenant.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  // ── Idempotent ENUM creation ──────────────────────────────────────
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_holon_capabilities_node_type" AS ENUM('assembly', 'print', 'service', 'product', 'digital', 'fulfillment');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_products_fulfillment_mode" AS ENUM('self', 'network');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum__products_v_version_fulfillment_mode" AS ENUM('self', 'network');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_orders_fulfillment_fulfillment_status" AS ENUM('pending_match', 'matched', 'accepted', 'in_production', 'shipped', 'delivered', 'rejected');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  // ── Idempotent TABLE creation ─────────────────────────────────────
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "holon_capabilities" (
      "id" serial PRIMARY KEY NOT NULL,
      "tenant_id" integer,
      "node_type" "enum_holon_capabilities_node_type" NOT NULL,
      "service_radius" numeric,
      "location_lat" numeric,
      "location_lng" numeric,
      "location_city" varchar,
      "location_region" varchar,
      "business_name" varchar,
      "contact_name" varchar,
      "rating" numeric DEFAULT 0,
      "active_order_count" numeric DEFAULT 0,
      "accepting_orders" boolean DEFAULT true,
      "constitutional_compliance" boolean DEFAULT true NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "holon_capabilities_capabilities" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "skill" varchar NOT NULL,
      "equipment" varchar,
      "materials" jsonb,
      "max_volume" varchar,
      "turnaround_hours" numeric
    );

    CREATE TABLE IF NOT EXISTS "products_required_capabilities" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "skill" varchar,
      "materials" jsonb
    );

    CREATE TABLE IF NOT EXISTS "_products_v_version_required_capabilities" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" serial PRIMARY KEY NOT NULL,
      "skill" varchar,
      "materials" jsonb,
      "_uuid" varchar
    );

    CREATE TABLE IF NOT EXISTS "orders_fulfillment" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "order_item_index" numeric NOT NULL,
      "assigned_holon_id" integer,
      "source_tenant_id" integer,
      "fulfillment_status" "enum_orders_fulfillment_fulfillment_status" DEFAULT 'pending_match' NOT NULL,
      "match_score" numeric,
      "matched_at" timestamp(3) with time zone,
      "accepted_at" timestamp(3) with time zone,
      "shipped_at" timestamp(3) with time zone,
      "tracking_number" varchar,
      "tracking_url" varchar,
      "estimated_completion" timestamp(3) with time zone,
      "rejection_reason" varchar,
      "vendor_share" numeric
    );

    CREATE TABLE IF NOT EXISTS "orders_fulfillment_design_assets" (
      "_order" integer NOT NULL,
      "_parent_id" varchar NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "media_id" integer NOT NULL,
      "instructions" varchar
    );
  `)

  // ── Idempotent ALTER TABLE (add columns if not exist) ─────────────
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "spaces" ALTER COLUMN "tenant_id" DROP NOT NULL;
    EXCEPTION WHEN others THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "space_memberships" ADD COLUMN "tenant_id" integer;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "channels" ADD COLUMN "tenant_id" integer;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "products" ADD COLUMN "network_listing" boolean DEFAULT false;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "products" ADD COLUMN "fulfillment_mode" "enum_products_fulfillment_mode" DEFAULT 'self';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_products_v" ADD COLUMN "version_network_listing" boolean DEFAULT false;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_products_v" ADD COLUMN "version_fulfillment_mode" "enum__products_v_version_fulfillment_mode" DEFAULT 'self';
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "holon_capabilities_id" integer;
    EXCEPTION WHEN duplicate_column THEN NULL;
    END $$;
  `)

  // ── Idempotent FOREIGN KEY constraints ────────────────────────────
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "holon_capabilities_capabilities" ADD CONSTRAINT "holon_capabilities_capabilities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."holon_capabilities"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "holon_capabilities" ADD CONSTRAINT "holon_capabilities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "products_required_capabilities" ADD CONSTRAINT "products_required_capabilities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "_products_v_version_required_capabilities" ADD CONSTRAINT "_products_v_version_required_capabilities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "orders_fulfillment_design_assets" ADD CONSTRAINT "orders_fulfillment_design_assets_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "orders_fulfillment_design_assets" ADD CONSTRAINT "orders_fulfillment_design_assets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders_fulfillment"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "orders_fulfillment" ADD CONSTRAINT "orders_fulfillment_assigned_holon_id_holon_capabilities_id_fk" FOREIGN KEY ("assigned_holon_id") REFERENCES "public"."holon_capabilities"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "orders_fulfillment" ADD CONSTRAINT "orders_fulfillment_source_tenant_id_tenants_id_fk" FOREIGN KEY ("source_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "orders_fulfillment" ADD CONSTRAINT "orders_fulfillment_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "space_memberships" ADD CONSTRAINT "space_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "channels" ADD CONSTRAINT "channels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_holon_capabilities_fk" FOREIGN KEY ("holon_capabilities_id") REFERENCES "public"."holon_capabilities"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `)

  // ── Idempotent INDEX creation ─────────────────────────────────────
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "holon_capabilities_capabilities_order_idx" ON "holon_capabilities_capabilities" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "holon_capabilities_capabilities_parent_id_idx" ON "holon_capabilities_capabilities" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "holon_capabilities_tenant_idx" ON "holon_capabilities" USING btree ("tenant_id");
    CREATE INDEX IF NOT EXISTS "holon_capabilities_updated_at_idx" ON "holon_capabilities" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "holon_capabilities_created_at_idx" ON "holon_capabilities" USING btree ("created_at");
    CREATE INDEX IF NOT EXISTS "products_required_capabilities_order_idx" ON "products_required_capabilities" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "products_required_capabilities_parent_id_idx" ON "products_required_capabilities" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "_products_v_version_required_capabilities_order_idx" ON "_products_v_version_required_capabilities" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "_products_v_version_required_capabilities_parent_id_idx" ON "_products_v_version_required_capabilities" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "orders_fulfillment_design_assets_order_idx" ON "orders_fulfillment_design_assets" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "orders_fulfillment_design_assets_parent_id_idx" ON "orders_fulfillment_design_assets" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "orders_fulfillment_design_assets_media_idx" ON "orders_fulfillment_design_assets" USING btree ("media_id");
    CREATE INDEX IF NOT EXISTS "orders_fulfillment_order_idx" ON "orders_fulfillment" USING btree ("_order");
    CREATE INDEX IF NOT EXISTS "orders_fulfillment_parent_id_idx" ON "orders_fulfillment" USING btree ("_parent_id");
    CREATE INDEX IF NOT EXISTS "orders_fulfillment_assigned_holon_idx" ON "orders_fulfillment" USING btree ("assigned_holon_id");
    CREATE INDEX IF NOT EXISTS "orders_fulfillment_source_tenant_idx" ON "orders_fulfillment" USING btree ("source_tenant_id");
    CREATE INDEX IF NOT EXISTS "space_memberships_tenant_idx" ON "space_memberships" USING btree ("tenant_id");
    CREATE INDEX IF NOT EXISTS "channels_tenant_idx" ON "channels" USING btree ("tenant_id");
    CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_holon_capabilities_id_idx" ON "payload_locked_documents_rels" USING btree ("holon_capabilities_id");
  `)

  // ── DATA MIGRATION: back-fill tenant_id on existing rows ──────────
  // Channels and messages inherit tenant from their parent space.
  // Space-memberships inherit from their parent space too.
  // This ensures the multi-tenant plugin's access control can find them.
  await db.execute(sql`
    UPDATE "channels" c
    SET "tenant_id" = s."tenant_id"
    FROM "spaces" s
    WHERE c."space_id" = s."id"
      AND c."tenant_id" IS NULL
      AND s."tenant_id" IS NOT NULL;

    UPDATE "messages" m
    SET "tenant_id" = s."tenant_id"
    FROM "channels" ch
    JOIN "spaces" s ON ch."space_id" = s."id"
    WHERE m."channel_id" = ch."id"
      AND m."tenant_id" IS NULL
      AND s."tenant_id" IS NOT NULL;

    UPDATE "space_memberships" sm
    SET "tenant_id" = s."tenant_id"
    FROM "spaces" s
    WHERE sm."space_id" = s."id"
      AND sm."tenant_id" IS NULL
      AND s."tenant_id" IS NOT NULL;
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "holon_capabilities_capabilities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "holon_capabilities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_required_capabilities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_products_v_version_required_capabilities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "orders_fulfillment_design_assets" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "orders_fulfillment" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "holon_capabilities_capabilities" CASCADE;
  DROP TABLE "holon_capabilities" CASCADE;
  DROP TABLE "products_required_capabilities" CASCADE;
  DROP TABLE "_products_v_version_required_capabilities" CASCADE;
  DROP TABLE "orders_fulfillment_design_assets" CASCADE;
  DROP TABLE "orders_fulfillment" CASCADE;
  ALTER TABLE "space_memberships" DROP CONSTRAINT "space_memberships_tenant_id_tenants_id_fk";

  ALTER TABLE "channels" DROP CONSTRAINT "channels_tenant_id_tenants_id_fk";

  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_holon_capabilities_fk";

  DROP INDEX "space_memberships_tenant_idx";
  DROP INDEX "channels_tenant_idx";
  DROP INDEX "payload_locked_documents_rels_holon_capabilities_id_idx";
  ALTER TABLE "spaces" ALTER COLUMN "tenant_id" SET NOT NULL;
  ALTER TABLE "space_memberships" DROP COLUMN "tenant_id";
  ALTER TABLE "channels" DROP COLUMN "tenant_id";
  ALTER TABLE "products" DROP COLUMN "network_listing";
  ALTER TABLE "products" DROP COLUMN "fulfillment_mode";
  ALTER TABLE "_products_v" DROP COLUMN "version_network_listing";
  ALTER TABLE "_products_v" DROP COLUMN "version_fulfillment_mode";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "holon_capabilities_id";
  DROP TYPE "public"."enum_holon_capabilities_node_type";
  DROP TYPE "public"."enum_products_fulfillment_mode";
  DROP TYPE "public"."enum__products_v_version_fulfillment_mode";
  DROP TYPE "public"."enum_orders_fulfillment_fulfillment_status";`)
}
