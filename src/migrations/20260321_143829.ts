import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tenants_ai_config_preferred_image_provider" AS ENUM('auto', 'openai', 'google', 'openrouter', 'cloudflare');
  CREATE TYPE "public"."enum_users_agent_config_model_strategy_standard_tier" AS ENUM('low', 'medium', 'high', 'critical');
  CREATE TYPE "public"."enum_users_agent_config_model_strategy_escalation_tier" AS ENUM('low', 'medium', 'high', 'critical');
  CREATE TYPE "public"."enum_tenant_memberships_propagation_trigger" AS ENUM('purchase', 'booking', 'event_registration', 'space_join', 'federation_interaction', 'manual');
  CREATE TYPE "public"."enum_header_nav_items_children_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_footer_nav_groups_items_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_site_settings_social_links_platform" AS ENUM('facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok', 'github', 'discord', 'bluesky');
  CREATE TYPE "public"."enum_endeavors_crew_active_departments" AS ENUM('bridge', 'engineering', 'operations', 'science', 'communications', 'medical', 'security', 'logistics');
  CREATE TYPE "public"."enum_endeavors_crew_watch_rotation" AS ENUM('fixed', 'rotating', 'flexible');
  CREATE TYPE "public"."enum_crew_assignments_capabilities_proficiency" AS ENUM('expert', 'proficient', 'learning');
  CREATE TYPE "public"."enum_crew_assignments_department" AS ENUM('bridge', 'engineering', 'operations', 'science', 'communications', 'medical', 'security', 'logistics');
  CREATE TYPE "public"."enum_crew_assignments_rank" AS ENUM('captain', 'commander', 'lt_commander', 'lieutenant', 'ensign', 'specialist', 'cadet');
  CREATE TYPE "public"."enum_crew_assignments_duty_status" AS ENUM('active_duty', 'shore_leave', 'detached', 'reserve');
  CREATE TYPE "public"."enum_crew_assignments_watch_section" AS ENUM('alpha', 'beta', 'gamma', 'delta');
  ALTER TYPE "public"."enum_connectors_type" ADD VALUE 'youtube_channel';
  CREATE TABLE "header_nav_items_children" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_header_nav_items_children_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar NOT NULL
  );
  
  CREATE TABLE "footer_nav_groups_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_footer_nav_groups_items_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar NOT NULL
  );
  
  CREATE TABLE "footer_nav_groups" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar NOT NULL
  );
  
  CREATE TABLE "site_settings_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"platform" "enum_site_settings_social_links_platform" NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"label" varchar DEFAULT 'Site Settings',
  	"google_analytics_id" varchar,
  	"default_og_image_id" integer,
  	"default_meta_description" varchar,
  	"donations_enabled" boolean DEFAULT true,
  	"maintenance_mode" boolean DEFAULT false,
  	"maintenance_message" varchar,
  	"announcement_bar_enabled" boolean DEFAULT false,
  	"announcement_bar_text" varchar,
  	"announcement_bar_link" varchar,
  	"announcement_bar_background_color" varchar DEFAULT '#f5a623',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "endeavors_crew_active_departments" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_endeavors_crew_active_departments",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "crew_assignments_capabilities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"skill" varchar NOT NULL,
  	"proficiency" "enum_crew_assignments_capabilities_proficiency" DEFAULT 'proficient'
  );
  
  CREATE TABLE "crew_assignments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"membership_id" integer NOT NULL,
  	"endeavor_id" integer NOT NULL,
  	"department" "enum_crew_assignments_department" NOT NULL,
  	"station" varchar NOT NULL,
  	"rank" "enum_crew_assignments_rank" DEFAULT 'ensign' NOT NULL,
  	"duty_status" "enum_crew_assignments_duty_status" DEFAULT 'active_duty' NOT NULL,
  	"watch_section" "enum_crew_assignments_watch_section",
  	"assigned_at" timestamp(3) with time zone,
  	"assigned_by_id" integer,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "tenants" ADD COLUMN "ai_config_openai_api_key" varchar;
  ALTER TABLE "tenants" ADD COLUMN "ai_config_google_ai_api_key" varchar;
  ALTER TABLE "tenants" ADD COLUMN "ai_config_cloudflare_account_id" varchar;
  ALTER TABLE "tenants" ADD COLUMN "ai_config_cloudflare_ai_token" varchar;
  ALTER TABLE "tenants" ADD COLUMN "ai_config_preferred_image_provider" "enum_tenants_ai_config_preferred_image_provider" DEFAULT 'auto';
  ALTER TABLE "tenants" ADD COLUMN "setup_is_flagship" boolean DEFAULT false;
  ALTER TABLE "tenants" ADD COLUMN "setup_commissioned_at" timestamp(3) with time zone;
  ALTER TABLE "users" ADD COLUMN "agent_config_model_strategy_enabled" boolean DEFAULT true;
  ALTER TABLE "users" ADD COLUMN "agent_config_model_strategy_standard_rounds" numeric DEFAULT 4;
  ALTER TABLE "users" ADD COLUMN "agent_config_model_strategy_standard_tier" "enum_users_agent_config_model_strategy_standard_tier" DEFAULT 'medium';
  ALTER TABLE "users" ADD COLUMN "agent_config_model_strategy_escalation_tier" "enum_users_agent_config_model_strategy_escalation_tier" DEFAULT 'critical';
  ALTER TABLE "tenant_memberships" ADD COLUMN "propagation_trigger" "enum_tenant_memberships_propagation_trigger";
  ALTER TABLE "spaces" ADD COLUMN "is_main" boolean DEFAULT false;
  ALTER TABLE "footer" ADD COLUMN "bottom_text" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_thumbnail_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_card_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_card_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_card_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_card_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_card_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_card_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_hero_url" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_hero_width" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_hero_height" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_hero_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "sizes_hero_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "sizes_hero_filename" varchar;
  ALTER TABLE "endeavors" ADD COLUMN "federation_domain" varchar;
  ALTER TABLE "endeavors" ADD COLUMN "federation_commissioned_at" timestamp(3) with time zone;
  ALTER TABLE "endeavors" ADD COLUMN "federation_commissioned_by" varchar;
  ALTER TABLE "endeavors" ADD COLUMN "crew_max_crew_size" numeric DEFAULT 0;
  ALTER TABLE "endeavors" ADD COLUMN "crew_watch_rotation" "enum_endeavors_crew_watch_rotation" DEFAULT 'flexible';
  ALTER TABLE "endeavors" ADD COLUMN "crew_commanding_officer_id" integer;
  ALTER TABLE "endeavors" ADD COLUMN "crew_executive_officer_id" integer;
  ALTER TABLE "work_units" ADD COLUMN "assigned_crew_member_id" integer;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "application_logs_find" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_run_subsafe" boolean DEFAULT true;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "payload_mcp_tool_query_errors" boolean DEFAULT true;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "site_settings_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "crew_assignments_id" integer;
  ALTER TABLE "header_nav_items_children" ADD CONSTRAINT "header_nav_items_children_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."header_nav_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_nav_groups_items" ADD CONSTRAINT "footer_nav_groups_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer_nav_groups"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "footer_nav_groups" ADD CONSTRAINT "footer_nav_groups_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."footer"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_social_links" ADD CONSTRAINT "site_settings_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_default_og_image_id_media_id_fk" FOREIGN KEY ("default_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "endeavors_crew_active_departments" ADD CONSTRAINT "endeavors_crew_active_departments_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."endeavors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "crew_assignments_capabilities" ADD CONSTRAINT "crew_assignments_capabilities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."crew_assignments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "crew_assignments" ADD CONSTRAINT "crew_assignments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "crew_assignments" ADD CONSTRAINT "crew_assignments_membership_id_tenant_memberships_id_fk" FOREIGN KEY ("membership_id") REFERENCES "public"."tenant_memberships"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "crew_assignments" ADD CONSTRAINT "crew_assignments_endeavor_id_endeavors_id_fk" FOREIGN KEY ("endeavor_id") REFERENCES "public"."endeavors"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "crew_assignments" ADD CONSTRAINT "crew_assignments_assigned_by_id_users_id_fk" FOREIGN KEY ("assigned_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "header_nav_items_children_order_idx" ON "header_nav_items_children" USING btree ("_order");
  CREATE INDEX "header_nav_items_children_parent_id_idx" ON "header_nav_items_children" USING btree ("_parent_id");
  CREATE INDEX "footer_nav_groups_items_order_idx" ON "footer_nav_groups_items" USING btree ("_order");
  CREATE INDEX "footer_nav_groups_items_parent_id_idx" ON "footer_nav_groups_items" USING btree ("_parent_id");
  CREATE INDEX "footer_nav_groups_order_idx" ON "footer_nav_groups" USING btree ("_order");
  CREATE INDEX "footer_nav_groups_parent_id_idx" ON "footer_nav_groups" USING btree ("_parent_id");
  CREATE INDEX "site_settings_social_links_order_idx" ON "site_settings_social_links" USING btree ("_order");
  CREATE INDEX "site_settings_social_links_parent_id_idx" ON "site_settings_social_links" USING btree ("_parent_id");
  CREATE INDEX "site_settings_tenant_idx" ON "site_settings" USING btree ("tenant_id");
  CREATE INDEX "site_settings_default_og_image_idx" ON "site_settings" USING btree ("default_og_image_id");
  CREATE INDEX "site_settings_updated_at_idx" ON "site_settings" USING btree ("updated_at");
  CREATE INDEX "site_settings_created_at_idx" ON "site_settings" USING btree ("created_at");
  CREATE INDEX "endeavors_crew_active_departments_order_idx" ON "endeavors_crew_active_departments" USING btree ("order");
  CREATE INDEX "endeavors_crew_active_departments_parent_idx" ON "endeavors_crew_active_departments" USING btree ("parent_id");
  CREATE INDEX "crew_assignments_capabilities_order_idx" ON "crew_assignments_capabilities" USING btree ("_order");
  CREATE INDEX "crew_assignments_capabilities_parent_id_idx" ON "crew_assignments_capabilities" USING btree ("_parent_id");
  CREATE INDEX "crew_assignments_tenant_idx" ON "crew_assignments" USING btree ("tenant_id");
  CREATE INDEX "crew_assignments_membership_idx" ON "crew_assignments" USING btree ("membership_id");
  CREATE INDEX "crew_assignments_endeavor_idx" ON "crew_assignments" USING btree ("endeavor_id");
  CREATE INDEX "crew_assignments_assigned_by_idx" ON "crew_assignments" USING btree ("assigned_by_id");
  CREATE INDEX "crew_assignments_updated_at_idx" ON "crew_assignments" USING btree ("updated_at");
  CREATE INDEX "crew_assignments_created_at_idx" ON "crew_assignments" USING btree ("created_at");
  ALTER TABLE "endeavors" ADD CONSTRAINT "endeavors_crew_commanding_officer_id_crew_assignments_id_fk" FOREIGN KEY ("crew_commanding_officer_id") REFERENCES "public"."crew_assignments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "endeavors" ADD CONSTRAINT "endeavors_crew_executive_officer_id_crew_assignments_id_fk" FOREIGN KEY ("crew_executive_officer_id") REFERENCES "public"."crew_assignments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "work_units" ADD CONSTRAINT "work_units_assigned_crew_member_id_crew_assignments_id_fk" FOREIGN KEY ("assigned_crew_member_id") REFERENCES "public"."crew_assignments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_site_settings_fk" FOREIGN KEY ("site_settings_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_crew_assignments_fk" FOREIGN KEY ("crew_assignments_id") REFERENCES "public"."crew_assignments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "media_sizes_hero_sizes_hero_filename_idx" ON "media" USING btree ("sizes_hero_filename");
  CREATE INDEX "endeavors_crew_crew_commanding_officer_idx" ON "endeavors" USING btree ("crew_commanding_officer_id");
  CREATE INDEX "endeavors_crew_crew_executive_officer_idx" ON "endeavors" USING btree ("crew_executive_officer_id");
  CREATE INDEX "work_units_assigned_crew_member_idx" ON "work_units" USING btree ("assigned_crew_member_id");
  CREATE INDEX "payload_locked_documents_rels_site_settings_id_idx" ON "payload_locked_documents_rels" USING btree ("site_settings_id");
  CREATE INDEX "payload_locked_documents_rels_crew_assignments_id_idx" ON "payload_locked_documents_rels" USING btree ("crew_assignments_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "header_nav_items_children" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "footer_nav_groups_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "footer_nav_groups" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings_social_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "endeavors_crew_active_departments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "crew_assignments_capabilities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "crew_assignments" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "header_nav_items_children" CASCADE;
  DROP TABLE "footer_nav_groups_items" CASCADE;
  DROP TABLE "footer_nav_groups" CASCADE;
  DROP TABLE "site_settings_social_links" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TABLE "endeavors_crew_active_departments" CASCADE;
  DROP TABLE "crew_assignments_capabilities" CASCADE;
  DROP TABLE "crew_assignments" CASCADE;
  ALTER TABLE "endeavors" DROP CONSTRAINT "endeavors_crew_commanding_officer_id_crew_assignments_id_fk";
  
  ALTER TABLE "endeavors" DROP CONSTRAINT "endeavors_crew_executive_officer_id_crew_assignments_id_fk";
  
  ALTER TABLE "work_units" DROP CONSTRAINT "work_units_assigned_crew_member_id_crew_assignments_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_site_settings_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_crew_assignments_fk";
  
  ALTER TABLE "connectors" ALTER COLUMN "type" SET DATA TYPE text;
  DROP TYPE "public"."enum_connectors_type";
  CREATE TYPE "public"."enum_connectors_type" AS ENUM('email_inbound', 'email_outbound', 'cloudflare_worker', 'stripe', 'whatsapp', 'google_chat', 'sms', 'webhook', 'livekit', 'discord', 'telegram', 'slack');
  ALTER TABLE "connectors" ALTER COLUMN "type" SET DATA TYPE "public"."enum_connectors_type" USING "type"::"public"."enum_connectors_type";
  DROP INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx";
  DROP INDEX "media_sizes_card_sizes_card_filename_idx";
  DROP INDEX "media_sizes_hero_sizes_hero_filename_idx";
  DROP INDEX "endeavors_crew_crew_commanding_officer_idx";
  DROP INDEX "endeavors_crew_crew_executive_officer_idx";
  DROP INDEX "work_units_assigned_crew_member_idx";
  DROP INDEX "payload_locked_documents_rels_site_settings_id_idx";
  DROP INDEX "payload_locked_documents_rels_crew_assignments_id_idx";
  ALTER TABLE "tenants" DROP COLUMN "ai_config_openai_api_key";
  ALTER TABLE "tenants" DROP COLUMN "ai_config_google_ai_api_key";
  ALTER TABLE "tenants" DROP COLUMN "ai_config_cloudflare_account_id";
  ALTER TABLE "tenants" DROP COLUMN "ai_config_cloudflare_ai_token";
  ALTER TABLE "tenants" DROP COLUMN "ai_config_preferred_image_provider";
  ALTER TABLE "tenants" DROP COLUMN "setup_is_flagship";
  ALTER TABLE "tenants" DROP COLUMN "setup_commissioned_at";
  ALTER TABLE "users" DROP COLUMN "agent_config_model_strategy_enabled";
  ALTER TABLE "users" DROP COLUMN "agent_config_model_strategy_standard_rounds";
  ALTER TABLE "users" DROP COLUMN "agent_config_model_strategy_standard_tier";
  ALTER TABLE "users" DROP COLUMN "agent_config_model_strategy_escalation_tier";
  ALTER TABLE "tenant_memberships" DROP COLUMN "propagation_trigger";
  ALTER TABLE "spaces" DROP COLUMN "is_main";
  ALTER TABLE "footer" DROP COLUMN "bottom_text";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_url";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_width";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_height";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_thumbnail_filename";
  ALTER TABLE "media" DROP COLUMN "sizes_card_url";
  ALTER TABLE "media" DROP COLUMN "sizes_card_width";
  ALTER TABLE "media" DROP COLUMN "sizes_card_height";
  ALTER TABLE "media" DROP COLUMN "sizes_card_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_card_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_card_filename";
  ALTER TABLE "media" DROP COLUMN "sizes_hero_url";
  ALTER TABLE "media" DROP COLUMN "sizes_hero_width";
  ALTER TABLE "media" DROP COLUMN "sizes_hero_height";
  ALTER TABLE "media" DROP COLUMN "sizes_hero_mime_type";
  ALTER TABLE "media" DROP COLUMN "sizes_hero_filesize";
  ALTER TABLE "media" DROP COLUMN "sizes_hero_filename";
  ALTER TABLE "endeavors" DROP COLUMN "federation_domain";
  ALTER TABLE "endeavors" DROP COLUMN "federation_commissioned_at";
  ALTER TABLE "endeavors" DROP COLUMN "federation_commissioned_by";
  ALTER TABLE "endeavors" DROP COLUMN "crew_max_crew_size";
  ALTER TABLE "endeavors" DROP COLUMN "crew_watch_rotation";
  ALTER TABLE "endeavors" DROP COLUMN "crew_commanding_officer_id";
  ALTER TABLE "endeavors" DROP COLUMN "crew_executive_officer_id";
  ALTER TABLE "work_units" DROP COLUMN "assigned_crew_member_id";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "application_logs_find";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_run_subsafe";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "payload_mcp_tool_query_errors";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "site_settings_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "crew_assignments_id";
  DROP TYPE "public"."enum_tenants_ai_config_preferred_image_provider";
  DROP TYPE "public"."enum_users_agent_config_model_strategy_standard_tier";
  DROP TYPE "public"."enum_users_agent_config_model_strategy_escalation_tier";
  DROP TYPE "public"."enum_tenant_memberships_propagation_trigger";
  DROP TYPE "public"."enum_header_nav_items_children_link_type";
  DROP TYPE "public"."enum_footer_nav_groups_items_link_type";
  DROP TYPE "public"."enum_site_settings_social_links_platform";
  DROP TYPE "public"."enum_endeavors_crew_active_departments";
  DROP TYPE "public"."enum_endeavors_crew_watch_rotation";
  DROP TYPE "public"."enum_crew_assignments_capabilities_proficiency";
  DROP TYPE "public"."enum_crew_assignments_department";
  DROP TYPE "public"."enum_crew_assignments_rank";
  DROP TYPE "public"."enum_crew_assignments_duty_status";
  DROP TYPE "public"."enum_crew_assignments_watch_section";`)
}
