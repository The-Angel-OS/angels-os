import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tenants_storefront_social_links_platform" AS ENUM('facebook', 'instagram', 'twitter', 'youtube', 'tiktok', 'linkedin', 'website');
  CREATE TYPE "public"."enum_tenants_storefront_business_hours_day" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
  CREATE TYPE "public"."enum_tenants_business_type" AS ENUM('retail', 'service', 'content_creator', 'nonprofit', 'professional_services', 'custom');
  CREATE TYPE "public"."enum_tenants_commerce_currency" AS ENUM('usd', 'cad', 'eur', 'gbp', 'aud');
  CREATE TYPE "public"."enum_channels_source" AS ENUM('native', 'whatsapp', 'email', 'google_chat', 'sms');
  CREATE TYPE "public"."enum_events_gallery_category" AS ENUM('venue', 'speaker', 'promo', 'recap', 'sponsor');
  CREATE TYPE "public"."enum_events_video_embed_provider" AS ENUM('youtube', 'vimeo', 'twitch', 'custom');
  CREATE TYPE "public"."enum_justice_fund_transactions_type" AS ENUM('allocation', 'disbursement', 'adjustment');
  CREATE TYPE "public"."enum_justice_fund_transactions_status" AS ENUM('completed', 'pending', 'failed');
  CREATE TYPE "public"."enum_application_logs_level" AS ENUM('error', 'warning', 'info', 'debug');
  CREATE TYPE "public"."enum_reviews_source" AS ENUM('angelos', 'google', 'manual');
  CREATE TYPE "public"."enum_products_production_type" AS ENUM('ready_made', 'print_on_demand', 'custom_order', 'digital');
  CREATE TYPE "public"."enum__products_v_version_production_type" AS ENUM('ready_made', 'print_on_demand', 'custom_order', 'digital');
  ALTER TYPE "public"."enum_tenants_type" ADD VALUE 'ministry';
  ALTER TYPE "public"."enum_users_roles" ADD VALUE 'producer' BEFORE 'customer';
  ALTER TYPE "public"."enum_channels_type" ADD VALUE 'dm';
  CREATE TABLE "tenants_storefront_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"platform" "enum_tenants_storefront_social_links_platform" NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "tenants_storefront_business_hours" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"day" "enum_tenants_storefront_business_hours_day" NOT NULL,
  	"open" varchar NOT NULL,
  	"close" varchar NOT NULL
  );
  
  CREATE TABLE "events_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"caption" varchar,
  	"category" "enum_events_gallery_category" DEFAULT 'recap',
  	"is_featured" boolean DEFAULT false
  );
  
  CREATE TABLE "justice_fund_transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"type" "enum_justice_fund_transactions_type" NOT NULL,
  	"amount_cents" numeric NOT NULL,
  	"source_payment_intent_id" varchar,
  	"source_total_cents" numeric,
  	"percentage" numeric,
  	"description" varchar,
  	"status" "enum_justice_fund_transactions_status" DEFAULT 'completed' NOT NULL,
  	"processed_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "processed_stripe_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"event_id" varchar NOT NULL,
  	"event_type" varchar NOT NULL,
  	"processed_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "application_logs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"level" "enum_application_logs_level" DEFAULT 'error' NOT NULL,
  	"source" varchar NOT NULL,
  	"message" varchar NOT NULL,
  	"details" varchar,
  	"status_code" numeric,
  	"url" varchar,
  	"user_agent" varchar,
  	"user_id" varchar,
  	"tenant_id" varchar,
  	"resolved" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "reviews" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"author" varchar NOT NULL,
  	"author_email" varchar,
  	"rating" numeric NOT NULL,
  	"content" varchar NOT NULL,
  	"source" "enum_reviews_source" DEFAULT 'angelos',
  	"external_id" varchar,
  	"is_verified" boolean DEFAULT false,
  	"published_at" timestamp(3) with time zone,
  	"response_content" varchar,
  	"response_responded_at" timestamp(3) with time zone,
  	"response_responded_by_id" integer,
  	"product_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  DROP INDEX "header_tenant_idx";
  DROP INDEX "footer_tenant_idx";
  ALTER TABLE "tenants" ADD COLUMN "business_type" "enum_tenants_business_type";
  ALTER TABLE "tenants" ADD COLUMN "storefront_description" varchar;
  ALTER TABLE "tenants" ADD COLUMN "storefront_cover_image_id" integer;
  ALTER TABLE "tenants" ADD COLUMN "storefront_contact_email" varchar;
  ALTER TABLE "tenants" ADD COLUMN "storefront_contact_phone" varchar;
  ALTER TABLE "tenants" ADD COLUMN "commerce_currency" "enum_tenants_commerce_currency" DEFAULT 'usd';
  ALTER TABLE "tenants" ADD COLUMN "commerce_tax_rate" numeric;
  ALTER TABLE "tenants" ADD COLUMN "commerce_shipping_enabled" boolean DEFAULT false;
  ALTER TABLE "tenants" ADD COLUMN "commerce_bookings_enabled" boolean DEFAULT false;
  ALTER TABLE "tenants" ADD COLUMN "commerce_events_enabled" boolean DEFAULT false;
  ALTER TABLE "tenants" ADD COLUMN "commerce_digital_products_enabled" boolean DEFAULT false;
  ALTER TABLE "tenants" ADD COLUMN "commerce_is_tax_exempt" boolean DEFAULT false;
  ALTER TABLE "tenants" ADD COLUMN "commerce_tax_exempt_id" varchar;
  ALTER TABLE "tenants" ADD COLUMN "stripe_connect_stripe_account_id" varchar;
  ALTER TABLE "tenants" ADD COLUMN "stripe_connect_stripe_onboarding_complete" boolean DEFAULT false;
  ALTER TABLE "tenants" ADD COLUMN "stripe_connect_stripe_payouts_enabled" boolean DEFAULT false;
  ALTER TABLE "tenants" ADD COLUMN "stripe_connect_stripe_charges_enabled" boolean DEFAULT false;
  ALTER TABLE "tenants" ADD COLUMN "stripe_connect_connected_at" timestamp(3) with time zone;
  ALTER TABLE "tenants" ADD COLUMN "ai_config_anthropic_api_key" varchar;
  ALTER TABLE "tenants" ADD COLUMN "ai_config_openrouter_api_key" varchar;
  ALTER TABLE "spaces" ADD COLUMN "enabled_applets" jsonb DEFAULT '["chat","files","tasks"]'::jsonb;
  ALTER TABLE "channels" ADD COLUMN "source" "enum_channels_source" DEFAULT 'native';
  ALTER TABLE "channels_rels" ADD COLUMN "users_id" integer;
  ALTER TABLE "events" ADD COLUMN "video_embed_provider" "enum_events_video_embed_provider";
  ALTER TABLE "events" ADD COLUMN "video_embed_video_url" varchar;
  ALTER TABLE "events" ADD COLUMN "video_embed_embed_url" varchar;
  ALTER TABLE "products" ADD COLUMN "is_limited_edition" boolean DEFAULT false;
  ALTER TABLE "products" ADD COLUMN "available_until" timestamp(3) with time zone;
  ALTER TABLE "products" ADD COLUMN "vendor_id" integer;
  ALTER TABLE "products" ADD COLUMN "production_type" "enum_products_production_type";
  ALTER TABLE "products" ADD COLUMN "cad_file_id" integer;
  ALTER TABLE "products" ADD COLUMN "configurator_options" jsonb;
  ALTER TABLE "_products_v" ADD COLUMN "version_is_limited_edition" boolean DEFAULT false;
  ALTER TABLE "_products_v" ADD COLUMN "version_available_until" timestamp(3) with time zone;
  ALTER TABLE "_products_v" ADD COLUMN "version_vendor_id" integer;
  ALTER TABLE "_products_v" ADD COLUMN "version_production_type" "enum__products_v_version_production_type";
  ALTER TABLE "_products_v" ADD COLUMN "version_cad_file_id" integer;
  ALTER TABLE "_products_v" ADD COLUMN "version_configurator_options" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "justice_fund_transactions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "processed_stripe_events_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "application_logs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "reviews_id" integer;
  ALTER TABLE "tenants_storefront_social_links" ADD CONSTRAINT "tenants_storefront_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tenants_storefront_business_hours" ADD CONSTRAINT "tenants_storefront_business_hours_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_gallery" ADD CONSTRAINT "events_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events_gallery" ADD CONSTRAINT "events_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "justice_fund_transactions" ADD CONSTRAINT "justice_fund_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_response_responded_by_id_users_id_fk" FOREIGN KEY ("response_responded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "tenants_storefront_social_links_order_idx" ON "tenants_storefront_social_links" USING btree ("_order");
  CREATE INDEX "tenants_storefront_social_links_parent_id_idx" ON "tenants_storefront_social_links" USING btree ("_parent_id");
  CREATE INDEX "tenants_storefront_business_hours_order_idx" ON "tenants_storefront_business_hours" USING btree ("_order");
  CREATE INDEX "tenants_storefront_business_hours_parent_id_idx" ON "tenants_storefront_business_hours" USING btree ("_parent_id");
  CREATE INDEX "events_gallery_order_idx" ON "events_gallery" USING btree ("_order");
  CREATE INDEX "events_gallery_parent_id_idx" ON "events_gallery" USING btree ("_parent_id");
  CREATE INDEX "events_gallery_image_idx" ON "events_gallery" USING btree ("image_id");
  CREATE INDEX "justice_fund_transactions_tenant_idx" ON "justice_fund_transactions" USING btree ("tenant_id");
  CREATE INDEX "justice_fund_transactions_updated_at_idx" ON "justice_fund_transactions" USING btree ("updated_at");
  CREATE INDEX "justice_fund_transactions_created_at_idx" ON "justice_fund_transactions" USING btree ("created_at");
  CREATE UNIQUE INDEX "processed_stripe_events_event_id_idx" ON "processed_stripe_events" USING btree ("event_id");
  CREATE INDEX "application_logs_level_idx" ON "application_logs" USING btree ("level");
  CREATE INDEX "application_logs_source_idx" ON "application_logs" USING btree ("source");
  CREATE INDEX "application_logs_tenant_id_idx" ON "application_logs" USING btree ("tenant_id");
  CREATE INDEX "application_logs_resolved_idx" ON "application_logs" USING btree ("resolved");
  CREATE INDEX "application_logs_updated_at_idx" ON "application_logs" USING btree ("updated_at");
  CREATE INDEX "application_logs_created_at_idx" ON "application_logs" USING btree ("created_at");
  CREATE INDEX "reviews_response_response_responded_by_idx" ON "reviews" USING btree ("response_responded_by_id");
  CREATE INDEX "reviews_product_idx" ON "reviews" USING btree ("product_id");
  CREATE INDEX "reviews_updated_at_idx" ON "reviews" USING btree ("updated_at");
  CREATE INDEX "reviews_created_at_idx" ON "reviews" USING btree ("created_at");
  ALTER TABLE "tenants" ADD CONSTRAINT "tenants_storefront_cover_image_id_media_id_fk" FOREIGN KEY ("storefront_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "channels_rels" ADD CONSTRAINT "channels_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_vendor_id_tenants_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_cad_file_id_media_id_fk" FOREIGN KEY ("cad_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_version_vendor_id_tenants_id_fk" FOREIGN KEY ("version_vendor_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_products_v" ADD CONSTRAINT "_products_v_version_cad_file_id_media_id_fk" FOREIGN KEY ("version_cad_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_justice_fund_transactions_fk" FOREIGN KEY ("justice_fund_transactions_id") REFERENCES "public"."justice_fund_transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_processed_stripe_events_fk" FOREIGN KEY ("processed_stripe_events_id") REFERENCES "public"."processed_stripe_events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_application_logs_fk" FOREIGN KEY ("application_logs_id") REFERENCES "public"."application_logs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_reviews_fk" FOREIGN KEY ("reviews_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "tenants_storefront_storefront_cover_image_idx" ON "tenants" USING btree ("storefront_cover_image_id");
  CREATE INDEX "channels_rels_users_id_idx" ON "channels_rels" USING btree ("users_id");
  CREATE INDEX "products_vendor_idx" ON "products" USING btree ("vendor_id");
  CREATE INDEX "products_cad_file_idx" ON "products" USING btree ("cad_file_id");
  CREATE INDEX "_products_v_version_version_vendor_idx" ON "_products_v" USING btree ("version_vendor_id");
  CREATE INDEX "_products_v_version_version_cad_file_idx" ON "_products_v" USING btree ("version_cad_file_id");
  CREATE INDEX "payload_locked_documents_rels_justice_fund_transactions__idx" ON "payload_locked_documents_rels" USING btree ("justice_fund_transactions_id");
  CREATE INDEX "payload_locked_documents_rels_processed_stripe_events_id_idx" ON "payload_locked_documents_rels" USING btree ("processed_stripe_events_id");
  CREATE INDEX "payload_locked_documents_rels_application_logs_id_idx" ON "payload_locked_documents_rels" USING btree ("application_logs_id");
  CREATE INDEX "payload_locked_documents_rels_reviews_id_idx" ON "payload_locked_documents_rels" USING btree ("reviews_id");
  CREATE INDEX "header_tenant_idx" ON "header" USING btree ("tenant_id");
  CREATE INDEX "footer_tenant_idx" ON "footer" USING btree ("tenant_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenants_storefront_social_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tenants_storefront_business_hours" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "justice_fund_transactions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "processed_stripe_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "application_logs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "reviews" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "tenants_storefront_social_links" CASCADE;
  DROP TABLE "tenants_storefront_business_hours" CASCADE;
  DROP TABLE "events_gallery" CASCADE;
  DROP TABLE "justice_fund_transactions" CASCADE;
  DROP TABLE "processed_stripe_events" CASCADE;
  DROP TABLE "application_logs" CASCADE;
  DROP TABLE "reviews" CASCADE;
  ALTER TABLE "tenants" DROP CONSTRAINT "tenants_storefront_cover_image_id_media_id_fk";
  
  ALTER TABLE "channels_rels" DROP CONSTRAINT "channels_rels_users_fk";
  
  ALTER TABLE "products" DROP CONSTRAINT "products_vendor_id_tenants_id_fk";
  
  ALTER TABLE "products" DROP CONSTRAINT "products_cad_file_id_media_id_fk";
  
  ALTER TABLE "_products_v" DROP CONSTRAINT "_products_v_version_vendor_id_tenants_id_fk";
  
  ALTER TABLE "_products_v" DROP CONSTRAINT "_products_v_version_cad_file_id_media_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_justice_fund_transactions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_processed_stripe_events_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_application_logs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_reviews_fk";
  
  ALTER TABLE "tenants" ALTER COLUMN "type" SET DATA TYPE text;
  ALTER TABLE "tenants" ALTER COLUMN "type" SET DEFAULT 'tenant'::text;
  DROP TYPE "public"."enum_tenants_type";
  CREATE TYPE "public"."enum_tenants_type" AS ENUM('platform', 'tenant');
  ALTER TABLE "tenants" ALTER COLUMN "type" SET DEFAULT 'tenant'::"public"."enum_tenants_type";
  ALTER TABLE "tenants" ALTER COLUMN "type" SET DATA TYPE "public"."enum_tenants_type" USING "type"::"public"."enum_tenants_type";
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_roles";
  CREATE TYPE "public"."enum_users_roles" AS ENUM('super_admin', 'archangel', 'admin', 'customer');
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_roles" USING "value"::"public"."enum_users_roles";
  ALTER TABLE "channels" ALTER COLUMN "type" SET DATA TYPE text;
  ALTER TABLE "channels" ALTER COLUMN "type" SET DEFAULT 'general'::text;
  DROP TYPE "public"."enum_channels_type";
  CREATE TYPE "public"."enum_channels_type" AS ENUM('general', 'announcements', 'support', 'sales', 'inventory', 'pdf', 'video', 'team', 'social');
  ALTER TABLE "channels" ALTER COLUMN "type" SET DEFAULT 'general'::"public"."enum_channels_type";
  ALTER TABLE "channels" ALTER COLUMN "type" SET DATA TYPE "public"."enum_channels_type" USING "type"::"public"."enum_channels_type";
  DROP INDEX "tenants_storefront_storefront_cover_image_idx";
  DROP INDEX "channels_rels_users_id_idx";
  DROP INDEX "products_vendor_idx";
  DROP INDEX "products_cad_file_idx";
  DROP INDEX "_products_v_version_version_vendor_idx";
  DROP INDEX "_products_v_version_version_cad_file_idx";
  DROP INDEX "payload_locked_documents_rels_justice_fund_transactions__idx";
  DROP INDEX "payload_locked_documents_rels_processed_stripe_events_id_idx";
  DROP INDEX "payload_locked_documents_rels_application_logs_id_idx";
  DROP INDEX "payload_locked_documents_rels_reviews_id_idx";
  DROP INDEX "header_tenant_idx";
  DROP INDEX "footer_tenant_idx";
  CREATE UNIQUE INDEX "header_tenant_idx" ON "header" USING btree ("tenant_id");
  CREATE UNIQUE INDEX "footer_tenant_idx" ON "footer" USING btree ("tenant_id");
  ALTER TABLE "tenants" DROP COLUMN "business_type";
  ALTER TABLE "tenants" DROP COLUMN "storefront_description";
  ALTER TABLE "tenants" DROP COLUMN "storefront_cover_image_id";
  ALTER TABLE "tenants" DROP COLUMN "storefront_contact_email";
  ALTER TABLE "tenants" DROP COLUMN "storefront_contact_phone";
  ALTER TABLE "tenants" DROP COLUMN "commerce_currency";
  ALTER TABLE "tenants" DROP COLUMN "commerce_tax_rate";
  ALTER TABLE "tenants" DROP COLUMN "commerce_shipping_enabled";
  ALTER TABLE "tenants" DROP COLUMN "commerce_bookings_enabled";
  ALTER TABLE "tenants" DROP COLUMN "commerce_events_enabled";
  ALTER TABLE "tenants" DROP COLUMN "commerce_digital_products_enabled";
  ALTER TABLE "tenants" DROP COLUMN "commerce_is_tax_exempt";
  ALTER TABLE "tenants" DROP COLUMN "commerce_tax_exempt_id";
  ALTER TABLE "tenants" DROP COLUMN "stripe_connect_stripe_account_id";
  ALTER TABLE "tenants" DROP COLUMN "stripe_connect_stripe_onboarding_complete";
  ALTER TABLE "tenants" DROP COLUMN "stripe_connect_stripe_payouts_enabled";
  ALTER TABLE "tenants" DROP COLUMN "stripe_connect_stripe_charges_enabled";
  ALTER TABLE "tenants" DROP COLUMN "stripe_connect_connected_at";
  ALTER TABLE "tenants" DROP COLUMN "ai_config_anthropic_api_key";
  ALTER TABLE "tenants" DROP COLUMN "ai_config_openrouter_api_key";
  ALTER TABLE "spaces" DROP COLUMN "enabled_applets";
  ALTER TABLE "channels" DROP COLUMN "source";
  ALTER TABLE "channels_rels" DROP COLUMN "users_id";
  ALTER TABLE "events" DROP COLUMN "video_embed_provider";
  ALTER TABLE "events" DROP COLUMN "video_embed_video_url";
  ALTER TABLE "events" DROP COLUMN "video_embed_embed_url";
  ALTER TABLE "products" DROP COLUMN "is_limited_edition";
  ALTER TABLE "products" DROP COLUMN "available_until";
  ALTER TABLE "products" DROP COLUMN "vendor_id";
  ALTER TABLE "products" DROP COLUMN "production_type";
  ALTER TABLE "products" DROP COLUMN "cad_file_id";
  ALTER TABLE "products" DROP COLUMN "configurator_options";
  ALTER TABLE "_products_v" DROP COLUMN "version_is_limited_edition";
  ALTER TABLE "_products_v" DROP COLUMN "version_available_until";
  ALTER TABLE "_products_v" DROP COLUMN "version_vendor_id";
  ALTER TABLE "_products_v" DROP COLUMN "version_production_type";
  ALTER TABLE "_products_v" DROP COLUMN "version_cad_file_id";
  ALTER TABLE "_products_v" DROP COLUMN "version_configurator_options";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "justice_fund_transactions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "processed_stripe_events_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "application_logs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "reviews_id";
  DROP TYPE "public"."enum_tenants_storefront_social_links_platform";
  DROP TYPE "public"."enum_tenants_storefront_business_hours_day";
  DROP TYPE "public"."enum_tenants_business_type";
  DROP TYPE "public"."enum_tenants_commerce_currency";
  DROP TYPE "public"."enum_channels_source";
  DROP TYPE "public"."enum_events_gallery_category";
  DROP TYPE "public"."enum_events_video_embed_provider";
  DROP TYPE "public"."enum_justice_fund_transactions_type";
  DROP TYPE "public"."enum_justice_fund_transactions_status";
  DROP TYPE "public"."enum_application_logs_level";
  DROP TYPE "public"."enum_reviews_source";
  DROP TYPE "public"."enum_products_production_type";
  DROP TYPE "public"."enum__products_v_version_production_type";`)
}
