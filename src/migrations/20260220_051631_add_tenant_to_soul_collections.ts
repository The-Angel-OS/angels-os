import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_holon_capabilities_node_type" AS ENUM('assembly', 'print', 'service', 'product', 'digital', 'fulfillment');
  CREATE TYPE "public"."enum_products_fulfillment_mode" AS ENUM('self', 'network');
  CREATE TYPE "public"."enum__products_v_version_fulfillment_mode" AS ENUM('self', 'network');
  CREATE TYPE "public"."enum_orders_fulfillment_fulfillment_status" AS ENUM('pending_match', 'matched', 'accepted', 'in_production', 'shipped', 'delivered', 'rejected');
  CREATE TABLE "holon_capabilities_capabilities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"skill" varchar NOT NULL,
  	"equipment" varchar,
  	"materials" jsonb,
  	"max_volume" varchar,
  	"turnaround_hours" numeric
  );
  
  CREATE TABLE "holon_capabilities" (
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
  
  CREATE TABLE "products_required_capabilities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"skill" varchar,
  	"materials" jsonb
  );
  
  CREATE TABLE "_products_v_version_required_capabilities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"skill" varchar,
  	"materials" jsonb,
  	"_uuid" varchar
  );
  
  CREATE TABLE "orders_fulfillment_design_assets" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"media_id" integer NOT NULL,
  	"instructions" varchar
  );
  
  CREATE TABLE "orders_fulfillment" (
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
  
  ALTER TABLE "spaces" ALTER COLUMN "tenant_id" DROP NOT NULL;
  ALTER TABLE "space_memberships" ADD COLUMN "tenant_id" integer;
  ALTER TABLE "channels" ADD COLUMN "tenant_id" integer;
  ALTER TABLE "products" ADD COLUMN "network_listing" boolean DEFAULT false;
  ALTER TABLE "products" ADD COLUMN "fulfillment_mode" "enum_products_fulfillment_mode" DEFAULT 'self';
  ALTER TABLE "_products_v" ADD COLUMN "version_network_listing" boolean DEFAULT false;
  ALTER TABLE "_products_v" ADD COLUMN "version_fulfillment_mode" "enum__products_v_version_fulfillment_mode" DEFAULT 'self';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "holon_capabilities_id" integer;
  ALTER TABLE "holon_capabilities_capabilities" ADD CONSTRAINT "holon_capabilities_capabilities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."holon_capabilities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "holon_capabilities" ADD CONSTRAINT "holon_capabilities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_required_capabilities" ADD CONSTRAINT "products_required_capabilities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_required_capabilities" ADD CONSTRAINT "_products_v_version_required_capabilities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_fulfillment_design_assets" ADD CONSTRAINT "orders_fulfillment_design_assets_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_fulfillment_design_assets" ADD CONSTRAINT "orders_fulfillment_design_assets_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders_fulfillment"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "orders_fulfillment" ADD CONSTRAINT "orders_fulfillment_assigned_holon_id_holon_capabilities_id_fk" FOREIGN KEY ("assigned_holon_id") REFERENCES "public"."holon_capabilities"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_fulfillment" ADD CONSTRAINT "orders_fulfillment_source_tenant_id_tenants_id_fk" FOREIGN KEY ("source_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "orders_fulfillment" ADD CONSTRAINT "orders_fulfillment_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "holon_capabilities_capabilities_order_idx" ON "holon_capabilities_capabilities" USING btree ("_order");
  CREATE INDEX "holon_capabilities_capabilities_parent_id_idx" ON "holon_capabilities_capabilities" USING btree ("_parent_id");
  CREATE INDEX "holon_capabilities_tenant_idx" ON "holon_capabilities" USING btree ("tenant_id");
  CREATE INDEX "holon_capabilities_updated_at_idx" ON "holon_capabilities" USING btree ("updated_at");
  CREATE INDEX "holon_capabilities_created_at_idx" ON "holon_capabilities" USING btree ("created_at");
  CREATE INDEX "products_required_capabilities_order_idx" ON "products_required_capabilities" USING btree ("_order");
  CREATE INDEX "products_required_capabilities_parent_id_idx" ON "products_required_capabilities" USING btree ("_parent_id");
  CREATE INDEX "_products_v_version_required_capabilities_order_idx" ON "_products_v_version_required_capabilities" USING btree ("_order");
  CREATE INDEX "_products_v_version_required_capabilities_parent_id_idx" ON "_products_v_version_required_capabilities" USING btree ("_parent_id");
  CREATE INDEX "orders_fulfillment_design_assets_order_idx" ON "orders_fulfillment_design_assets" USING btree ("_order");
  CREATE INDEX "orders_fulfillment_design_assets_parent_id_idx" ON "orders_fulfillment_design_assets" USING btree ("_parent_id");
  CREATE INDEX "orders_fulfillment_design_assets_media_idx" ON "orders_fulfillment_design_assets" USING btree ("media_id");
  CREATE INDEX "orders_fulfillment_order_idx" ON "orders_fulfillment" USING btree ("_order");
  CREATE INDEX "orders_fulfillment_parent_id_idx" ON "orders_fulfillment" USING btree ("_parent_id");
  CREATE INDEX "orders_fulfillment_assigned_holon_idx" ON "orders_fulfillment" USING btree ("assigned_holon_id");
  CREATE INDEX "orders_fulfillment_source_tenant_idx" ON "orders_fulfillment" USING btree ("source_tenant_id");
  ALTER TABLE "space_memberships" ADD CONSTRAINT "space_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "channels" ADD CONSTRAINT "channels_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_holon_capabilities_fk" FOREIGN KEY ("holon_capabilities_id") REFERENCES "public"."holon_capabilities"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "space_memberships_tenant_idx" ON "space_memberships" USING btree ("tenant_id");
  CREATE INDEX "channels_tenant_idx" ON "channels" USING btree ("tenant_id");
  CREATE INDEX "payload_locked_documents_rels_holon_capabilities_id_idx" ON "payload_locked_documents_rels" USING btree ("holon_capabilities_id");`)
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
