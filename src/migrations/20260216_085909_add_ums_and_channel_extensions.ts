import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tenants_type" AS ENUM('platform', 'tenant');
  CREATE TYPE "public"."enum_users_agent_config_capabilities" AS ENUM('query_posts', 'create_posts', 'update_posts', 'query_products', 'create_products', 'update_products', 'query_pages', 'create_pages', 'update_pages', 'manage_categories', 'manage_media', 'manage_navigation', 'create_orders', 'manage_spaces', 'send_emails', 'schedule_events', 'external_api');
  CREATE TYPE "public"."enum_users_agent_config_agent_type" AS ENUM('leo', 'support', 'sales', 'onboarding', 'integration', 'custom');
  CREATE TYPE "public"."enum_messages_visibility" AS ENUM('private', 'tenant', 'network');
  CREATE TYPE "public"."enum_messages_priority" AS ENUM('low', 'normal', 'high', 'urgent');
  CREATE TYPE "public"."enum_messages_status" AS ENUM('active', 'pending', 'resolved', 'archived');
  CREATE TYPE "public"."enum_workflows_channel_types" AS ENUM('general', 'support', 'sales', 'inventory', 'pdf', 'video');
  CREATE TYPE "public"."enum_workflows_attachment_types" AS ENUM('image', 'pdf', 'video_url');
  CREATE TYPE "public"."enum_workflows_trigger_type" AS ENUM('message_attachments', 'message_pattern', 'channel_type', 'manual');
  CREATE TYPE "public"."enum_bookings_booking_type" AS ENUM('service', 'consultation', 'rental', 'class', 'event', 'custom');
  CREATE TYPE "public"."enum_bookings_pricing_currency" AS ENUM('usd', 'eur');
  CREATE TYPE "public"."enum_bookings_status" AS ENUM('pending', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show');
  CREATE TYPE "public"."enum_bookings_location_type" AS ENUM('provider', 'client', 'remote', 'custom');
  CREATE TYPE "public"."enum_bookings_location_remote_details_platform" AS ENUM('zoom', 'google-meet', 'angelos-live', 'custom');
  CREATE TYPE "public"."enum_availability_service_types_service_type" AS ENUM('service', 'consultation', 'rental', 'class', 'event', 'custom');
  CREATE TYPE "public"."enum_availability_availability_type" AS ENUM('weekly', 'date-range', 'one-time');
  CREATE TYPE "public"."enum_availability_weekly_schedule_day_of_week" AS ENUM('0', '1', '2', '3', '4', '5', '6');
  CREATE TYPE "public"."enum_posts_hero_links_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_posts_hero_links_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum_posts_blocks_cta_links_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_posts_blocks_cta_links_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum_posts_blocks_content_columns_size" AS ENUM('oneThird', 'half', 'twoThirds', 'full');
  CREATE TYPE "public"."enum_posts_blocks_content_columns_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_posts_blocks_content_columns_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum_posts_blocks_archive_populate_by" AS ENUM('collection', 'selection');
  CREATE TYPE "public"."enum_posts_blocks_archive_relation_to" AS ENUM('products');
  CREATE TYPE "public"."enum_posts_blocks_carousel_populate_by" AS ENUM('collection', 'selection');
  CREATE TYPE "public"."enum_posts_blocks_carousel_relation_to" AS ENUM('products');
  CREATE TYPE "public"."enum_posts_blocks_banner_style" AS ENUM('info', 'warning', 'error', 'success');
  CREATE TYPE "public"."enum_posts_hero_type" AS ENUM('none', 'highImpact', 'mediumImpact', 'lowImpact');
  CREATE TYPE "public"."enum_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__posts_v_version_hero_links_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum__posts_v_version_hero_links_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum__posts_v_blocks_cta_links_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum__posts_v_blocks_cta_links_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum__posts_v_blocks_content_columns_size" AS ENUM('oneThird', 'half', 'twoThirds', 'full');
  CREATE TYPE "public"."enum__posts_v_blocks_content_columns_link_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum__posts_v_blocks_content_columns_link_appearance" AS ENUM('default', 'outline');
  CREATE TYPE "public"."enum__posts_v_blocks_archive_populate_by" AS ENUM('collection', 'selection');
  CREATE TYPE "public"."enum__posts_v_blocks_archive_relation_to" AS ENUM('products');
  CREATE TYPE "public"."enum__posts_v_blocks_carousel_populate_by" AS ENUM('collection', 'selection');
  CREATE TYPE "public"."enum__posts_v_blocks_carousel_relation_to" AS ENUM('products');
  CREATE TYPE "public"."enum__posts_v_blocks_banner_style" AS ENUM('info', 'warning', 'error', 'success');
  CREATE TYPE "public"."enum__posts_v_version_hero_type" AS ENUM('none', 'highImpact', 'mediumImpact', 'lowImpact');
  CREATE TYPE "public"."enum__posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_projects_gallery_stage" AS ENUM('before', 'progress', 'after', 'detail', 'material');
  CREATE TYPE "public"."enum_projects_materials_category" AS ENUM('cabinets', 'countertops', 'hardware', 'appliances', 'flooring', 'lighting', 'plumbing', 'finish', 'other');
  CREATE TYPE "public"."enum_projects_project_type" AS ENUM('kitchen', 'bathroom', 'cabinets', 'millwork', 'commercial', 'furniture', 'service', 'consultation', 'other');
  CREATE TYPE "public"."enum_projects_budget_currency" AS ENUM('usd', 'eur');
  CREATE TYPE "public"."enum_projects_budget_budget_range" AS ENUM('under-1k', '1k-5k', '5k-15k', '15k-50k', '50k-plus', 'contact');
  CREATE TYPE "public"."enum_projects_project_status" AS ENUM('planning', 'in-progress', 'completed', 'on-hold', 'cancelled');
  ALTER TYPE "public"."enum_users_roles" ADD VALUE 'archangel' BEFORE 'admin';
  ALTER TYPE "public"."enum_channels_type" ADD VALUE 'inventory' BEFORE 'team';
  ALTER TYPE "public"."enum_channels_type" ADD VALUE 'pdf' BEFORE 'team';
  ALTER TYPE "public"."enum_channels_type" ADD VALUE 'video' BEFORE 'team';
  ALTER TYPE "public"."enum_messages_message_type" ADD VALUE 'inventory';
  ALTER TYPE "public"."enum_messages_message_type" ADD VALUE 'pdf';
  ALTER TYPE "public"."enum_messages_message_type" ADD VALUE 'video';
  ALTER TYPE "public"."enum_messages_message_type" ADD VALUE 'booking';
  ALTER TYPE "public"."enum_messages_message_type" ADD VALUE 'form_submission';
  ALTER TYPE "public"."enum_messages_message_type" ADD VALUE 'transaction';
  ALTER TYPE "public"."enum_messages_message_type" ADD VALUE 'widget';
  ALTER TYPE "public"."enum_messages_message_type" ADD VALUE 'ethical_assessment';
  CREATE TABLE "users_agent_config_capabilities" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_agent_config_capabilities",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "users_agent_config_routing_rules_channels" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"channel_slug" varchar
  );
  
  CREATE TABLE "users_agent_config_routing_rules_keywords" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"keyword" varchar
  );
  
  CREATE TABLE "channels_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"workflows_id" integer
  );
  
  CREATE TABLE "messages_attachments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"media_id" integer NOT NULL,
  	"caption" varchar
  );
  
  CREATE TABLE "workflows_channel_types" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_workflows_channel_types",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "workflows_attachment_types" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_workflows_attachment_types",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "workflows" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"trigger_type" "enum_workflows_trigger_type" DEFAULT 'message_attachments' NOT NULL,
  	"output_schema" jsonb,
  	"handler_config" jsonb,
  	"is_active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "bookings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"title" varchar NOT NULL,
  	"booking_type" "enum_bookings_booking_type" DEFAULT 'service' NOT NULL,
  	"description" jsonb,
  	"provider_id" integer NOT NULL,
  	"client_id" integer NOT NULL,
  	"start_date_time" timestamp(3) with time zone NOT NULL,
  	"end_date_time" timestamp(3) with time zone NOT NULL,
  	"duration" numeric DEFAULT 60 NOT NULL,
  	"pricing_amount" numeric NOT NULL,
  	"pricing_currency" "enum_bookings_pricing_currency" DEFAULT 'usd' NOT NULL,
  	"pricing_split_configuration_provider_share" numeric DEFAULT 60 NOT NULL,
  	"pricing_split_configuration_platform_share" numeric DEFAULT 20 NOT NULL,
  	"pricing_split_configuration_operations_share" numeric DEFAULT 15 NOT NULL,
  	"pricing_split_configuration_justice_share" numeric DEFAULT 5 NOT NULL,
  	"status" "enum_bookings_status" DEFAULT 'pending' NOT NULL,
  	"location_type" "enum_bookings_location_type" DEFAULT 'provider' NOT NULL,
  	"location_address" varchar,
  	"location_remote_details_platform" "enum_bookings_location_remote_details_platform",
  	"location_remote_details_meeting_link" varchar,
  	"location_remote_details_access_code" varchar,
  	"requirements_client_preparation" jsonb,
  	"requirements_cancellation_policy" jsonb,
  	"requirements_special_instructions" jsonb,
  	"notifications_confirmation_sent" boolean DEFAULT false,
  	"notifications_reminder_sent" boolean DEFAULT false,
  	"notifications_follow_up_sent" boolean DEFAULT false,
  	"integration_stripe_payment_intent" varchar,
  	"integration_calendar_event_id" varchar,
  	"integration_leo_conversation_id" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "availability_exceptions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"reason" varchar,
  	"alternative_availability_start_time" varchar,
  	"alternative_availability_end_time" varchar
  );
  
  CREATE TABLE "availability_service_types" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"service_type" "enum_availability_service_types_service_type",
  	"max_concurrent" numeric DEFAULT 1
  );
  
  CREATE TABLE "availability" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"title" varchar NOT NULL,
  	"provider_id" integer NOT NULL,
  	"availability_type" "enum_availability_availability_type" DEFAULT 'weekly' NOT NULL,
  	"weekly_schedule_day_of_week" "enum_availability_weekly_schedule_day_of_week",
  	"weekly_schedule_start_time" varchar,
  	"weekly_schedule_end_time" varchar,
  	"date_range_start_date" timestamp(3) with time zone,
  	"date_range_end_date" timestamp(3) with time zone,
  	"date_range_start_time" varchar,
  	"date_range_end_time" varchar,
  	"one_time_block_start_date_time" timestamp(3) with time zone,
  	"one_time_block_end_date_time" timestamp(3) with time zone,
  	"slot_duration" numeric DEFAULT 60 NOT NULL,
  	"buffer_time" numeric DEFAULT 0,
  	"max_advance_booking" numeric DEFAULT 30,
  	"min_advance_booking" numeric DEFAULT 1,
  	"is_active" boolean DEFAULT true NOT NULL,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "posts_hero_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_posts_hero_links_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum_posts_hero_links_link_appearance" DEFAULT 'default'
  );
  
  CREATE TABLE "posts_blocks_cta_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"link_type" "enum_posts_blocks_cta_links_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum_posts_blocks_cta_links_link_appearance" DEFAULT 'default'
  );
  
  CREATE TABLE "posts_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"rich_text" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "posts_blocks_content_columns" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"size" "enum_posts_blocks_content_columns_size" DEFAULT 'oneThird',
  	"rich_text" jsonb,
  	"enable_link" boolean,
  	"link_type" "enum_posts_blocks_content_columns_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum_posts_blocks_content_columns_link_appearance" DEFAULT 'default'
  );
  
  CREATE TABLE "posts_blocks_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "posts_blocks_media_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"media_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "posts_blocks_archive" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"intro_content" jsonb,
  	"populate_by" "enum_posts_blocks_archive_populate_by" DEFAULT 'collection',
  	"relation_to" "enum_posts_blocks_archive_relation_to" DEFAULT 'products',
  	"limit" numeric DEFAULT 10,
  	"block_name" varchar
  );
  
  CREATE TABLE "posts_blocks_carousel" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"populate_by" "enum_posts_blocks_carousel_populate_by" DEFAULT 'collection',
  	"relation_to" "enum_posts_blocks_carousel_relation_to" DEFAULT 'products',
  	"limit" numeric DEFAULT 10,
  	"populated_docs_total" numeric,
  	"block_name" varchar
  );
  
  CREATE TABLE "posts_blocks_three_item_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "posts_blocks_banner" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"style" "enum_posts_blocks_banner_style" DEFAULT 'info',
  	"content" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "posts_blocks_form_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"form_id" integer,
  	"enable_intro" boolean,
  	"intro_content" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "posts_blocks_comments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar,
  	"heading" varchar DEFAULT 'Comments'
  );
  
  CREATE TABLE "posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"title" varchar,
  	"published_on" timestamp(3) with time zone,
  	"hero_type" "enum_posts_hero_type" DEFAULT 'lowImpact',
  	"hero_rich_text" jsonb,
  	"hero_media_id" integer,
  	"meta_title" varchar,
  	"meta_image_id" integer,
  	"meta_description" varchar,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_posts_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "posts_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"categories_id" integer,
  	"products_id" integer,
  	"posts_id" integer
  );
  
  CREATE TABLE "_posts_v_version_hero_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__posts_v_version_hero_links_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum__posts_v_version_hero_links_link_appearance" DEFAULT 'default',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_cta_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"link_type" "enum__posts_v_blocks_cta_links_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum__posts_v_blocks_cta_links_link_appearance" DEFAULT 'default',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_cta" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"rich_text" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_content_columns" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"size" "enum__posts_v_blocks_content_columns_size" DEFAULT 'oneThird',
  	"rich_text" jsonb,
  	"enable_link" boolean,
  	"link_type" "enum__posts_v_blocks_content_columns_link_type" DEFAULT 'reference',
  	"link_new_tab" boolean,
  	"link_url" varchar,
  	"link_label" varchar,
  	"link_appearance" "enum__posts_v_blocks_content_columns_link_appearance" DEFAULT 'default',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_content" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_media_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"media_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_archive" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"intro_content" jsonb,
  	"populate_by" "enum__posts_v_blocks_archive_populate_by" DEFAULT 'collection',
  	"relation_to" "enum__posts_v_blocks_archive_relation_to" DEFAULT 'products',
  	"limit" numeric DEFAULT 10,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_carousel" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"populate_by" "enum__posts_v_blocks_carousel_populate_by" DEFAULT 'collection',
  	"relation_to" "enum__posts_v_blocks_carousel_relation_to" DEFAULT 'products',
  	"limit" numeric DEFAULT 10,
  	"populated_docs_total" numeric,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_three_item_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_banner" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"style" "enum__posts_v_blocks_banner_style" DEFAULT 'info',
  	"content" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_form_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"form_id" integer,
  	"enable_intro" boolean,
  	"intro_content" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_comments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"block_name" varchar,
  	"heading" varchar DEFAULT 'Comments',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_posts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_tenant_id" integer,
  	"version_title" varchar,
  	"version_published_on" timestamp(3) with time zone,
  	"version_hero_type" "enum__posts_v_version_hero_type" DEFAULT 'lowImpact',
  	"version_hero_rich_text" jsonb,
  	"version_hero_media_id" integer,
  	"version_meta_title" varchar,
  	"version_meta_image_id" integer,
  	"version_meta_description" varchar,
  	"version_generate_slug" boolean DEFAULT true,
  	"version_slug" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__posts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_posts_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"pages_id" integer,
  	"categories_id" integer,
  	"products_id" integer,
  	"posts_id" integer
  );
  
  CREATE TABLE "projects_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL,
  	"caption" varchar,
  	"stage" "enum_projects_gallery_stage" DEFAULT 'after' NOT NULL,
  	"is_hero_image" boolean
  );
  
  CREATE TABLE "projects_materials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar NOT NULL,
  	"vendor" varchar,
  	"specifications" varchar,
  	"category" "enum_projects_materials_category",
  	"link" varchar
  );
  
  CREATE TABLE "projects_team" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"member_id" integer NOT NULL,
  	"role" varchar NOT NULL
  );
  
  CREATE TABLE "projects_challenges" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"challenge" varchar NOT NULL,
  	"solution" jsonb
  );
  
  CREATE TABLE "projects_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar NOT NULL
  );
  
  CREATE TABLE "projects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"title" varchar NOT NULL,
  	"slug" varchar,
  	"project_type" "enum_projects_project_type" DEFAULT 'other' NOT NULL,
  	"description" jsonb,
  	"client_name" varchar NOT NULL,
  	"client_display_name" varchar,
  	"client_contact_email" varchar,
  	"client_contact_phone" varchar,
  	"client_contact_address" varchar,
  	"timeline_start_date" timestamp(3) with time zone,
  	"timeline_completed_at" timestamp(3) with time zone,
  	"timeline_estimated_duration" varchar,
  	"budget_estimated_cost" numeric,
  	"budget_final_cost" numeric,
  	"budget_currency" "enum_projects_budget_currency" DEFAULT 'usd',
  	"budget_budget_range" "enum_projects_budget_budget_range",
  	"project_status" "enum_projects_project_status" DEFAULT 'planning' NOT NULL,
  	"testimonial_quote" varchar,
  	"testimonial_rating" numeric,
  	"testimonial_is_public" boolean,
  	"is_public" boolean DEFAULT false NOT NULL,
  	"is_featured" boolean DEFAULT false,
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "projects_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"projects_id" integer
  );
  
  CREATE TABLE "comments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"author" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"content" varchar NOT NULL,
  	"rating" numeric,
  	"is_approved" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "comments_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"posts_id" integer,
  	"products_id" integer
  );
  
  CREATE TABLE "products_blocks_comments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar,
  	"heading" varchar DEFAULT 'Comments'
  );
  
  CREATE TABLE "_products_v_blocks_comments" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"block_name" varchar,
  	"heading" varchar DEFAULT 'Comments',
  	"_uuid" varchar
  );
  
  CREATE TABLE "payload_mcp_api_keys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"label" varchar,
  	"description" varchar,
  	"posts_find" boolean DEFAULT false,
  	"posts_create" boolean DEFAULT false,
  	"posts_update" boolean DEFAULT false,
  	"posts_delete" boolean DEFAULT false,
  	"products_find" boolean DEFAULT false,
  	"products_create" boolean DEFAULT false,
  	"products_update" boolean DEFAULT false,
  	"products_delete" boolean DEFAULT false,
  	"pages_find" boolean DEFAULT false,
  	"pages_create" boolean DEFAULT false,
  	"pages_update" boolean DEFAULT false,
  	"pages_delete" boolean DEFAULT false,
  	"tenants_find" boolean DEFAULT false,
  	"tenants_create" boolean DEFAULT false,
  	"tenants_update" boolean DEFAULT false,
  	"tenants_delete" boolean DEFAULT false,
  	"categories_find" boolean DEFAULT false,
  	"categories_create" boolean DEFAULT false,
  	"categories_update" boolean DEFAULT false,
  	"categories_delete" boolean DEFAULT false,
  	"media_find" boolean DEFAULT false,
  	"media_create" boolean DEFAULT false,
  	"media_update" boolean DEFAULT false,
  	"media_delete" boolean DEFAULT false,
  	"bookings_find" boolean DEFAULT false,
  	"bookings_create" boolean DEFAULT false,
  	"bookings_update" boolean DEFAULT false,
  	"bookings_delete" boolean DEFAULT false,
  	"availability_find" boolean DEFAULT false,
  	"availability_create" boolean DEFAULT false,
  	"availability_update" boolean DEFAULT false,
  	"availability_delete" boolean DEFAULT false,
  	"workflows_find" boolean DEFAULT false,
  	"workflows_create" boolean DEFAULT false,
  	"workflows_update" boolean DEFAULT false,
  	"workflows_delete" boolean DEFAULT false,
  	"payload_mcp_tool_leo_respond" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar
  );
  
  DROP INDEX "spaces_slug_idx";
  DROP INDEX "channels_slug_idx";
  DROP INDEX "pages_slug_idx";
  DROP INDEX "categories_slug_idx";
  DROP INDEX "products_slug_idx";
  ALTER TABLE "messages" ALTER COLUMN "author_id" DROP NOT NULL;
  ALTER TABLE "messages" ALTER COLUMN "content" SET DATA TYPE jsonb;
  ALTER TABLE "tenants" ADD COLUMN "type" "enum_tenants_type" DEFAULT 'tenant' NOT NULL;
  ALTER TABLE "users" ADD COLUMN "agent_config_agent_type" "enum_users_agent_config_agent_type" DEFAULT 'leo';
  ALTER TABLE "users" ADD COLUMN "agent_config_angel_name" varchar DEFAULT 'LEO';
  ALTER TABLE "users" ADD COLUMN "agent_config_display_name" varchar;
  ALTER TABLE "users" ADD COLUMN "agent_config_personality" varchar;
  ALTER TABLE "users" ADD COLUMN "agent_config_response_rules" jsonb;
  ALTER TABLE "users" ADD COLUMN "agent_config_handoff_to_id" integer;
  ALTER TABLE "users" ADD COLUMN "agent_config_appearance_avatar_id" integer;
  ALTER TABLE "users" ADD COLUMN "agent_config_appearance_color" varchar;
  ALTER TABLE "users" ADD COLUMN "agent_config_appearance_emoji" varchar;
  ALTER TABLE "users" ADD COLUMN "agent_config_routing_rules_is_default" boolean DEFAULT false;
  ALTER TABLE "channels" ADD COLUMN "data" jsonb;
  ALTER TABLE "channels" ADD COLUMN "widgets" jsonb;
  ALTER TABLE "channels" ADD COLUMN "data_version" numeric DEFAULT 0;
  ALTER TABLE "messages" ADD COLUMN "visibility" "enum_messages_visibility" DEFAULT 'tenant';
  ALTER TABLE "messages" ADD COLUMN "priority" "enum_messages_priority" DEFAULT 'normal';
  ALTER TABLE "messages" ADD COLUMN "status" "enum_messages_status" DEFAULT 'active';
  ALTER TABLE "messages" ADD COLUMN "metadata" jsonb;
  ALTER TABLE "messages" ADD COLUMN "parent_message_id" integer;
  ALTER TABLE "messages" ADD COLUMN "federation_id" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "workflows_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "bookings_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "availability_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "posts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "projects_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "comments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "users_agent_config_capabilities" ADD CONSTRAINT "users_agent_config_capabilities_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_agent_config_routing_rules_channels" ADD CONSTRAINT "users_agent_config_routing_rules_channels_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_agent_config_routing_rules_keywords" ADD CONSTRAINT "users_agent_config_routing_rules_keywords_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "channels_rels" ADD CONSTRAINT "channels_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "channels_rels" ADD CONSTRAINT "channels_rels_workflows_fk" FOREIGN KEY ("workflows_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "messages_attachments" ADD CONSTRAINT "messages_attachments_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages_attachments" ADD CONSTRAINT "messages_attachments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "workflows_channel_types" ADD CONSTRAINT "workflows_channel_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "workflows_attachment_types" ADD CONSTRAINT "workflows_attachment_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "workflows" ADD CONSTRAINT "workflows_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "availability_exceptions" ADD CONSTRAINT "availability_exceptions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."availability"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "availability_service_types" ADD CONSTRAINT "availability_service_types_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."availability"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "availability" ADD CONSTRAINT "availability_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "availability" ADD CONSTRAINT "availability_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts_hero_links" ADD CONSTRAINT "posts_hero_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_cta_links" ADD CONSTRAINT "posts_blocks_cta_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts_blocks_cta"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_cta" ADD CONSTRAINT "posts_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_content_columns" ADD CONSTRAINT "posts_blocks_content_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts_blocks_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_content" ADD CONSTRAINT "posts_blocks_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_media_block" ADD CONSTRAINT "posts_blocks_media_block_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts_blocks_media_block" ADD CONSTRAINT "posts_blocks_media_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_archive" ADD CONSTRAINT "posts_blocks_archive_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_carousel" ADD CONSTRAINT "posts_blocks_carousel_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_three_item_grid" ADD CONSTRAINT "posts_blocks_three_item_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_banner" ADD CONSTRAINT "posts_blocks_banner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_form_block" ADD CONSTRAINT "posts_blocks_form_block_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts_blocks_form_block" ADD CONSTRAINT "posts_blocks_form_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_comments" ADD CONSTRAINT "posts_blocks_comments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_rels" ADD CONSTRAINT "posts_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_version_hero_links" ADD CONSTRAINT "_posts_v_version_hero_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_cta_links" ADD CONSTRAINT "_posts_v_blocks_cta_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v_blocks_cta"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_cta" ADD CONSTRAINT "_posts_v_blocks_cta_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_content_columns" ADD CONSTRAINT "_posts_v_blocks_content_columns_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v_blocks_content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_content" ADD CONSTRAINT "_posts_v_blocks_content_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_media_block" ADD CONSTRAINT "_posts_v_blocks_media_block_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_media_block" ADD CONSTRAINT "_posts_v_blocks_media_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_archive" ADD CONSTRAINT "_posts_v_blocks_archive_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_carousel" ADD CONSTRAINT "_posts_v_blocks_carousel_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_three_item_grid" ADD CONSTRAINT "_posts_v_blocks_three_item_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_banner" ADD CONSTRAINT "_posts_v_blocks_banner_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_form_block" ADD CONSTRAINT "_posts_v_blocks_form_block_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_form_block" ADD CONSTRAINT "_posts_v_blocks_form_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_comments" ADD CONSTRAINT "_posts_v_blocks_comments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_parent_id_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_tenant_id_tenants_id_fk" FOREIGN KEY ("version_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_hero_media_id_media_id_fk" FOREIGN KEY ("version_hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v" ADD CONSTRAINT "_posts_v_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_rels" ADD CONSTRAINT "_posts_v_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_gallery" ADD CONSTRAINT "projects_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projects_gallery" ADD CONSTRAINT "projects_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_materials" ADD CONSTRAINT "projects_materials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_team" ADD CONSTRAINT "projects_team_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projects_team" ADD CONSTRAINT "projects_team_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_challenges" ADD CONSTRAINT "projects_challenges_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_tags" ADD CONSTRAINT "projects_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "projects_rels" ADD CONSTRAINT "projects_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "comments" ADD CONSTRAINT "comments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "comments_rels" ADD CONSTRAINT "comments_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "comments_rels" ADD CONSTRAINT "comments_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "comments_rels" ADD CONSTRAINT "comments_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_blocks_comments" ADD CONSTRAINT "products_blocks_comments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_blocks_comments" ADD CONSTRAINT "_products_v_blocks_comments_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_mcp_api_keys" ADD CONSTRAINT "payload_mcp_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_agent_config_capabilities_order_idx" ON "users_agent_config_capabilities" USING btree ("order");
  CREATE INDEX "users_agent_config_capabilities_parent_idx" ON "users_agent_config_capabilities" USING btree ("parent_id");
  CREATE INDEX "users_agent_config_routing_rules_channels_order_idx" ON "users_agent_config_routing_rules_channels" USING btree ("_order");
  CREATE INDEX "users_agent_config_routing_rules_channels_parent_id_idx" ON "users_agent_config_routing_rules_channels" USING btree ("_parent_id");
  CREATE INDEX "users_agent_config_routing_rules_keywords_order_idx" ON "users_agent_config_routing_rules_keywords" USING btree ("_order");
  CREATE INDEX "users_agent_config_routing_rules_keywords_parent_id_idx" ON "users_agent_config_routing_rules_keywords" USING btree ("_parent_id");
  CREATE INDEX "channels_rels_order_idx" ON "channels_rels" USING btree ("order");
  CREATE INDEX "channels_rels_parent_idx" ON "channels_rels" USING btree ("parent_id");
  CREATE INDEX "channels_rels_path_idx" ON "channels_rels" USING btree ("path");
  CREATE INDEX "channels_rels_workflows_id_idx" ON "channels_rels" USING btree ("workflows_id");
  CREATE INDEX "messages_attachments_order_idx" ON "messages_attachments" USING btree ("_order");
  CREATE INDEX "messages_attachments_parent_id_idx" ON "messages_attachments" USING btree ("_parent_id");
  CREATE INDEX "messages_attachments_media_idx" ON "messages_attachments" USING btree ("media_id");
  CREATE INDEX "workflows_channel_types_order_idx" ON "workflows_channel_types" USING btree ("order");
  CREATE INDEX "workflows_channel_types_parent_idx" ON "workflows_channel_types" USING btree ("parent_id");
  CREATE INDEX "workflows_attachment_types_order_idx" ON "workflows_attachment_types" USING btree ("order");
  CREATE INDEX "workflows_attachment_types_parent_idx" ON "workflows_attachment_types" USING btree ("parent_id");
  CREATE INDEX "workflows_tenant_idx" ON "workflows" USING btree ("tenant_id");
  CREATE UNIQUE INDEX "workflows_slug_idx" ON "workflows" USING btree ("slug");
  CREATE INDEX "workflows_updated_at_idx" ON "workflows" USING btree ("updated_at");
  CREATE INDEX "workflows_created_at_idx" ON "workflows" USING btree ("created_at");
  CREATE INDEX "bookings_tenant_idx" ON "bookings" USING btree ("tenant_id");
  CREATE INDEX "bookings_provider_idx" ON "bookings" USING btree ("provider_id");
  CREATE INDEX "bookings_client_idx" ON "bookings" USING btree ("client_id");
  CREATE INDEX "bookings_updated_at_idx" ON "bookings" USING btree ("updated_at");
  CREATE INDEX "bookings_created_at_idx" ON "bookings" USING btree ("created_at");
  CREATE INDEX "availability_exceptions_order_idx" ON "availability_exceptions" USING btree ("_order");
  CREATE INDEX "availability_exceptions_parent_id_idx" ON "availability_exceptions" USING btree ("_parent_id");
  CREATE INDEX "availability_service_types_order_idx" ON "availability_service_types" USING btree ("_order");
  CREATE INDEX "availability_service_types_parent_id_idx" ON "availability_service_types" USING btree ("_parent_id");
  CREATE INDEX "availability_tenant_idx" ON "availability" USING btree ("tenant_id");
  CREATE INDEX "availability_provider_idx" ON "availability" USING btree ("provider_id");
  CREATE INDEX "availability_updated_at_idx" ON "availability" USING btree ("updated_at");
  CREATE INDEX "availability_created_at_idx" ON "availability" USING btree ("created_at");
  CREATE INDEX "posts_hero_links_order_idx" ON "posts_hero_links" USING btree ("_order");
  CREATE INDEX "posts_hero_links_parent_id_idx" ON "posts_hero_links" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_cta_links_order_idx" ON "posts_blocks_cta_links" USING btree ("_order");
  CREATE INDEX "posts_blocks_cta_links_parent_id_idx" ON "posts_blocks_cta_links" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_cta_order_idx" ON "posts_blocks_cta" USING btree ("_order");
  CREATE INDEX "posts_blocks_cta_parent_id_idx" ON "posts_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_cta_path_idx" ON "posts_blocks_cta" USING btree ("_path");
  CREATE INDEX "posts_blocks_content_columns_order_idx" ON "posts_blocks_content_columns" USING btree ("_order");
  CREATE INDEX "posts_blocks_content_columns_parent_id_idx" ON "posts_blocks_content_columns" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_content_order_idx" ON "posts_blocks_content" USING btree ("_order");
  CREATE INDEX "posts_blocks_content_parent_id_idx" ON "posts_blocks_content" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_content_path_idx" ON "posts_blocks_content" USING btree ("_path");
  CREATE INDEX "posts_blocks_media_block_order_idx" ON "posts_blocks_media_block" USING btree ("_order");
  CREATE INDEX "posts_blocks_media_block_parent_id_idx" ON "posts_blocks_media_block" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_media_block_path_idx" ON "posts_blocks_media_block" USING btree ("_path");
  CREATE INDEX "posts_blocks_media_block_media_idx" ON "posts_blocks_media_block" USING btree ("media_id");
  CREATE INDEX "posts_blocks_archive_order_idx" ON "posts_blocks_archive" USING btree ("_order");
  CREATE INDEX "posts_blocks_archive_parent_id_idx" ON "posts_blocks_archive" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_archive_path_idx" ON "posts_blocks_archive" USING btree ("_path");
  CREATE INDEX "posts_blocks_carousel_order_idx" ON "posts_blocks_carousel" USING btree ("_order");
  CREATE INDEX "posts_blocks_carousel_parent_id_idx" ON "posts_blocks_carousel" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_carousel_path_idx" ON "posts_blocks_carousel" USING btree ("_path");
  CREATE INDEX "posts_blocks_three_item_grid_order_idx" ON "posts_blocks_three_item_grid" USING btree ("_order");
  CREATE INDEX "posts_blocks_three_item_grid_parent_id_idx" ON "posts_blocks_three_item_grid" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_three_item_grid_path_idx" ON "posts_blocks_three_item_grid" USING btree ("_path");
  CREATE INDEX "posts_blocks_banner_order_idx" ON "posts_blocks_banner" USING btree ("_order");
  CREATE INDEX "posts_blocks_banner_parent_id_idx" ON "posts_blocks_banner" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_banner_path_idx" ON "posts_blocks_banner" USING btree ("_path");
  CREATE INDEX "posts_blocks_form_block_order_idx" ON "posts_blocks_form_block" USING btree ("_order");
  CREATE INDEX "posts_blocks_form_block_parent_id_idx" ON "posts_blocks_form_block" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_form_block_path_idx" ON "posts_blocks_form_block" USING btree ("_path");
  CREATE INDEX "posts_blocks_form_block_form_idx" ON "posts_blocks_form_block" USING btree ("form_id");
  CREATE INDEX "posts_blocks_comments_order_idx" ON "posts_blocks_comments" USING btree ("_order");
  CREATE INDEX "posts_blocks_comments_parent_id_idx" ON "posts_blocks_comments" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_comments_path_idx" ON "posts_blocks_comments" USING btree ("_path");
  CREATE INDEX "posts_tenant_idx" ON "posts" USING btree ("tenant_id");
  CREATE INDEX "posts_hero_hero_media_idx" ON "posts" USING btree ("hero_media_id");
  CREATE INDEX "posts_meta_meta_image_idx" ON "posts" USING btree ("meta_image_id");
  CREATE INDEX "posts_slug_idx" ON "posts" USING btree ("slug");
  CREATE INDEX "posts_updated_at_idx" ON "posts" USING btree ("updated_at");
  CREATE INDEX "posts_created_at_idx" ON "posts" USING btree ("created_at");
  CREATE INDEX "posts__status_idx" ON "posts" USING btree ("_status");
  CREATE INDEX "posts_rels_order_idx" ON "posts_rels" USING btree ("order");
  CREATE INDEX "posts_rels_parent_idx" ON "posts_rels" USING btree ("parent_id");
  CREATE INDEX "posts_rels_path_idx" ON "posts_rels" USING btree ("path");
  CREATE INDEX "posts_rels_pages_id_idx" ON "posts_rels" USING btree ("pages_id");
  CREATE INDEX "posts_rels_categories_id_idx" ON "posts_rels" USING btree ("categories_id");
  CREATE INDEX "posts_rels_products_id_idx" ON "posts_rels" USING btree ("products_id");
  CREATE INDEX "posts_rels_posts_id_idx" ON "posts_rels" USING btree ("posts_id");
  CREATE INDEX "_posts_v_version_hero_links_order_idx" ON "_posts_v_version_hero_links" USING btree ("_order");
  CREATE INDEX "_posts_v_version_hero_links_parent_id_idx" ON "_posts_v_version_hero_links" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_cta_links_order_idx" ON "_posts_v_blocks_cta_links" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_cta_links_parent_id_idx" ON "_posts_v_blocks_cta_links" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_cta_order_idx" ON "_posts_v_blocks_cta" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_cta_parent_id_idx" ON "_posts_v_blocks_cta" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_cta_path_idx" ON "_posts_v_blocks_cta" USING btree ("_path");
  CREATE INDEX "_posts_v_blocks_content_columns_order_idx" ON "_posts_v_blocks_content_columns" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_content_columns_parent_id_idx" ON "_posts_v_blocks_content_columns" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_content_order_idx" ON "_posts_v_blocks_content" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_content_parent_id_idx" ON "_posts_v_blocks_content" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_content_path_idx" ON "_posts_v_blocks_content" USING btree ("_path");
  CREATE INDEX "_posts_v_blocks_media_block_order_idx" ON "_posts_v_blocks_media_block" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_media_block_parent_id_idx" ON "_posts_v_blocks_media_block" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_media_block_path_idx" ON "_posts_v_blocks_media_block" USING btree ("_path");
  CREATE INDEX "_posts_v_blocks_media_block_media_idx" ON "_posts_v_blocks_media_block" USING btree ("media_id");
  CREATE INDEX "_posts_v_blocks_archive_order_idx" ON "_posts_v_blocks_archive" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_archive_parent_id_idx" ON "_posts_v_blocks_archive" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_archive_path_idx" ON "_posts_v_blocks_archive" USING btree ("_path");
  CREATE INDEX "_posts_v_blocks_carousel_order_idx" ON "_posts_v_blocks_carousel" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_carousel_parent_id_idx" ON "_posts_v_blocks_carousel" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_carousel_path_idx" ON "_posts_v_blocks_carousel" USING btree ("_path");
  CREATE INDEX "_posts_v_blocks_three_item_grid_order_idx" ON "_posts_v_blocks_three_item_grid" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_three_item_grid_parent_id_idx" ON "_posts_v_blocks_three_item_grid" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_three_item_grid_path_idx" ON "_posts_v_blocks_three_item_grid" USING btree ("_path");
  CREATE INDEX "_posts_v_blocks_banner_order_idx" ON "_posts_v_blocks_banner" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_banner_parent_id_idx" ON "_posts_v_blocks_banner" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_banner_path_idx" ON "_posts_v_blocks_banner" USING btree ("_path");
  CREATE INDEX "_posts_v_blocks_form_block_order_idx" ON "_posts_v_blocks_form_block" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_form_block_parent_id_idx" ON "_posts_v_blocks_form_block" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_form_block_path_idx" ON "_posts_v_blocks_form_block" USING btree ("_path");
  CREATE INDEX "_posts_v_blocks_form_block_form_idx" ON "_posts_v_blocks_form_block" USING btree ("form_id");
  CREATE INDEX "_posts_v_blocks_comments_order_idx" ON "_posts_v_blocks_comments" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_comments_parent_id_idx" ON "_posts_v_blocks_comments" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_comments_path_idx" ON "_posts_v_blocks_comments" USING btree ("_path");
  CREATE INDEX "_posts_v_parent_idx" ON "_posts_v" USING btree ("parent_id");
  CREATE INDEX "_posts_v_version_version_tenant_idx" ON "_posts_v" USING btree ("version_tenant_id");
  CREATE INDEX "_posts_v_version_hero_version_hero_media_idx" ON "_posts_v" USING btree ("version_hero_media_id");
  CREATE INDEX "_posts_v_version_meta_version_meta_image_idx" ON "_posts_v" USING btree ("version_meta_image_id");
  CREATE INDEX "_posts_v_version_version_slug_idx" ON "_posts_v" USING btree ("version_slug");
  CREATE INDEX "_posts_v_version_version_updated_at_idx" ON "_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_posts_v_version_version_created_at_idx" ON "_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_posts_v_version_version__status_idx" ON "_posts_v" USING btree ("version__status");
  CREATE INDEX "_posts_v_created_at_idx" ON "_posts_v" USING btree ("created_at");
  CREATE INDEX "_posts_v_updated_at_idx" ON "_posts_v" USING btree ("updated_at");
  CREATE INDEX "_posts_v_latest_idx" ON "_posts_v" USING btree ("latest");
  CREATE INDEX "_posts_v_autosave_idx" ON "_posts_v" USING btree ("autosave");
  CREATE INDEX "_posts_v_rels_order_idx" ON "_posts_v_rels" USING btree ("order");
  CREATE INDEX "_posts_v_rels_parent_idx" ON "_posts_v_rels" USING btree ("parent_id");
  CREATE INDEX "_posts_v_rels_path_idx" ON "_posts_v_rels" USING btree ("path");
  CREATE INDEX "_posts_v_rels_pages_id_idx" ON "_posts_v_rels" USING btree ("pages_id");
  CREATE INDEX "_posts_v_rels_categories_id_idx" ON "_posts_v_rels" USING btree ("categories_id");
  CREATE INDEX "_posts_v_rels_products_id_idx" ON "_posts_v_rels" USING btree ("products_id");
  CREATE INDEX "_posts_v_rels_posts_id_idx" ON "_posts_v_rels" USING btree ("posts_id");
  CREATE INDEX "projects_gallery_order_idx" ON "projects_gallery" USING btree ("_order");
  CREATE INDEX "projects_gallery_parent_id_idx" ON "projects_gallery" USING btree ("_parent_id");
  CREATE INDEX "projects_gallery_image_idx" ON "projects_gallery" USING btree ("image_id");
  CREATE INDEX "projects_materials_order_idx" ON "projects_materials" USING btree ("_order");
  CREATE INDEX "projects_materials_parent_id_idx" ON "projects_materials" USING btree ("_parent_id");
  CREATE INDEX "projects_team_order_idx" ON "projects_team" USING btree ("_order");
  CREATE INDEX "projects_team_parent_id_idx" ON "projects_team" USING btree ("_parent_id");
  CREATE INDEX "projects_team_member_idx" ON "projects_team" USING btree ("member_id");
  CREATE INDEX "projects_challenges_order_idx" ON "projects_challenges" USING btree ("_order");
  CREATE INDEX "projects_challenges_parent_id_idx" ON "projects_challenges" USING btree ("_parent_id");
  CREATE INDEX "projects_tags_order_idx" ON "projects_tags" USING btree ("_order");
  CREATE INDEX "projects_tags_parent_id_idx" ON "projects_tags" USING btree ("_parent_id");
  CREATE INDEX "projects_tenant_idx" ON "projects" USING btree ("tenant_id");
  CREATE UNIQUE INDEX "projects_slug_idx" ON "projects" USING btree ("slug");
  CREATE INDEX "projects_updated_at_idx" ON "projects" USING btree ("updated_at");
  CREATE INDEX "projects_created_at_idx" ON "projects" USING btree ("created_at");
  CREATE INDEX "projects_rels_order_idx" ON "projects_rels" USING btree ("order");
  CREATE INDEX "projects_rels_parent_idx" ON "projects_rels" USING btree ("parent_id");
  CREATE INDEX "projects_rels_path_idx" ON "projects_rels" USING btree ("path");
  CREATE INDEX "projects_rels_projects_id_idx" ON "projects_rels" USING btree ("projects_id");
  CREATE INDEX "comments_tenant_idx" ON "comments" USING btree ("tenant_id");
  CREATE INDEX "comments_updated_at_idx" ON "comments" USING btree ("updated_at");
  CREATE INDEX "comments_created_at_idx" ON "comments" USING btree ("created_at");
  CREATE INDEX "comments_rels_order_idx" ON "comments_rels" USING btree ("order");
  CREATE INDEX "comments_rels_parent_idx" ON "comments_rels" USING btree ("parent_id");
  CREATE INDEX "comments_rels_path_idx" ON "comments_rels" USING btree ("path");
  CREATE INDEX "comments_rels_posts_id_idx" ON "comments_rels" USING btree ("posts_id");
  CREATE INDEX "comments_rels_products_id_idx" ON "comments_rels" USING btree ("products_id");
  CREATE INDEX "products_blocks_comments_order_idx" ON "products_blocks_comments" USING btree ("_order");
  CREATE INDEX "products_blocks_comments_parent_id_idx" ON "products_blocks_comments" USING btree ("_parent_id");
  CREATE INDEX "products_blocks_comments_path_idx" ON "products_blocks_comments" USING btree ("_path");
  CREATE INDEX "_products_v_blocks_comments_order_idx" ON "_products_v_blocks_comments" USING btree ("_order");
  CREATE INDEX "_products_v_blocks_comments_parent_id_idx" ON "_products_v_blocks_comments" USING btree ("_parent_id");
  CREATE INDEX "_products_v_blocks_comments_path_idx" ON "_products_v_blocks_comments" USING btree ("_path");
  CREATE INDEX "payload_mcp_api_keys_user_idx" ON "payload_mcp_api_keys" USING btree ("user_id");
  CREATE INDEX "payload_mcp_api_keys_updated_at_idx" ON "payload_mcp_api_keys" USING btree ("updated_at");
  CREATE INDEX "payload_mcp_api_keys_created_at_idx" ON "payload_mcp_api_keys" USING btree ("created_at");
  ALTER TABLE "users" ADD CONSTRAINT "users_agent_config_handoff_to_id_users_id_fk" FOREIGN KEY ("agent_config_handoff_to_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_agent_config_appearance_avatar_id_media_id_fk" FOREIGN KEY ("agent_config_appearance_avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "messages" ADD CONSTRAINT "messages_parent_message_id_messages_id_fk" FOREIGN KEY ("parent_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_workflows_fk" FOREIGN KEY ("workflows_id") REFERENCES "public"."workflows"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_bookings_fk" FOREIGN KEY ("bookings_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_availability_fk" FOREIGN KEY ("availability_id") REFERENCES "public"."availability"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_posts_fk" FOREIGN KEY ("posts_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_projects_fk" FOREIGN KEY ("projects_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_comments_fk" FOREIGN KEY ("comments_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_agent_config_agent_config_handoff_to_idx" ON "users" USING btree ("agent_config_handoff_to_id");
  CREATE INDEX "users_agent_config_appearance_agent_config_appearance_av_idx" ON "users" USING btree ("agent_config_appearance_avatar_id");
  CREATE INDEX "messages_parent_message_idx" ON "messages" USING btree ("parent_message_id");
  CREATE INDEX "payload_locked_documents_rels_workflows_id_idx" ON "payload_locked_documents_rels" USING btree ("workflows_id");
  CREATE INDEX "payload_locked_documents_rels_bookings_id_idx" ON "payload_locked_documents_rels" USING btree ("bookings_id");
  CREATE INDEX "payload_locked_documents_rels_availability_id_idx" ON "payload_locked_documents_rels" USING btree ("availability_id");
  CREATE INDEX "payload_locked_documents_rels_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("posts_id");
  CREATE INDEX "payload_locked_documents_rels_projects_id_idx" ON "payload_locked_documents_rels" USING btree ("projects_id");
  CREATE INDEX "payload_locked_documents_rels_comments_id_idx" ON "payload_locked_documents_rels" USING btree ("comments_id");
  CREATE INDEX "payload_locked_documents_rels_payload_mcp_api_keys_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "payload_preferences_rels_payload_mcp_api_keys_id_idx" ON "payload_preferences_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "spaces_slug_idx" ON "spaces" USING btree ("slug");
  CREATE INDEX "channels_slug_idx" ON "channels" USING btree ("slug");
  CREATE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "products_slug_idx" ON "products" USING btree ("slug");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_agent_config_capabilities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_agent_config_routing_rules_channels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "users_agent_config_routing_rules_keywords" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "channels_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "messages_attachments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "workflows_channel_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "workflows_attachment_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "workflows" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "bookings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "availability_exceptions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "availability_service_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "availability" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_hero_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_blocks_cta_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_blocks_cta" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_blocks_content_columns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_blocks_content" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_blocks_media_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_blocks_archive" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_blocks_carousel" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_blocks_three_item_grid" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_blocks_banner" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_blocks_form_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_blocks_comments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_version_hero_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_blocks_cta_links" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_blocks_cta" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_blocks_content_columns" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_blocks_content" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_blocks_media_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_blocks_archive" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_blocks_carousel" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_blocks_three_item_grid" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_blocks_banner" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_blocks_form_block" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_blocks_comments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "projects_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "projects_materials" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "projects_team" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "projects_challenges" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "projects_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "projects" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "projects_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "comments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "comments_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_blocks_comments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_products_v_blocks_comments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_mcp_api_keys" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_agent_config_capabilities" CASCADE;
  DROP TABLE "users_agent_config_routing_rules_channels" CASCADE;
  DROP TABLE "users_agent_config_routing_rules_keywords" CASCADE;
  DROP TABLE "channels_rels" CASCADE;
  DROP TABLE "messages_attachments" CASCADE;
  DROP TABLE "workflows_channel_types" CASCADE;
  DROP TABLE "workflows_attachment_types" CASCADE;
  DROP TABLE "workflows" CASCADE;
  DROP TABLE "bookings" CASCADE;
  DROP TABLE "availability_exceptions" CASCADE;
  DROP TABLE "availability_service_types" CASCADE;
  DROP TABLE "availability" CASCADE;
  DROP TABLE "posts_hero_links" CASCADE;
  DROP TABLE "posts_blocks_cta_links" CASCADE;
  DROP TABLE "posts_blocks_cta" CASCADE;
  DROP TABLE "posts_blocks_content_columns" CASCADE;
  DROP TABLE "posts_blocks_content" CASCADE;
  DROP TABLE "posts_blocks_media_block" CASCADE;
  DROP TABLE "posts_blocks_archive" CASCADE;
  DROP TABLE "posts_blocks_carousel" CASCADE;
  DROP TABLE "posts_blocks_three_item_grid" CASCADE;
  DROP TABLE "posts_blocks_banner" CASCADE;
  DROP TABLE "posts_blocks_form_block" CASCADE;
  DROP TABLE "posts_blocks_comments" CASCADE;
  DROP TABLE "posts" CASCADE;
  DROP TABLE "posts_rels" CASCADE;
  DROP TABLE "_posts_v_version_hero_links" CASCADE;
  DROP TABLE "_posts_v_blocks_cta_links" CASCADE;
  DROP TABLE "_posts_v_blocks_cta" CASCADE;
  DROP TABLE "_posts_v_blocks_content_columns" CASCADE;
  DROP TABLE "_posts_v_blocks_content" CASCADE;
  DROP TABLE "_posts_v_blocks_media_block" CASCADE;
  DROP TABLE "_posts_v_blocks_archive" CASCADE;
  DROP TABLE "_posts_v_blocks_carousel" CASCADE;
  DROP TABLE "_posts_v_blocks_three_item_grid" CASCADE;
  DROP TABLE "_posts_v_blocks_banner" CASCADE;
  DROP TABLE "_posts_v_blocks_form_block" CASCADE;
  DROP TABLE "_posts_v_blocks_comments" CASCADE;
  DROP TABLE "_posts_v" CASCADE;
  DROP TABLE "_posts_v_rels" CASCADE;
  DROP TABLE "projects_gallery" CASCADE;
  DROP TABLE "projects_materials" CASCADE;
  DROP TABLE "projects_team" CASCADE;
  DROP TABLE "projects_challenges" CASCADE;
  DROP TABLE "projects_tags" CASCADE;
  DROP TABLE "projects" CASCADE;
  DROP TABLE "projects_rels" CASCADE;
  DROP TABLE "comments" CASCADE;
  DROP TABLE "comments_rels" CASCADE;
  DROP TABLE "products_blocks_comments" CASCADE;
  DROP TABLE "_products_v_blocks_comments" CASCADE;
  DROP TABLE "payload_mcp_api_keys" CASCADE;
  ALTER TABLE "users" DROP CONSTRAINT "users_agent_config_handoff_to_id_users_id_fk";
  
  ALTER TABLE "users" DROP CONSTRAINT "users_agent_config_appearance_avatar_id_media_id_fk";
  
  ALTER TABLE "messages" DROP CONSTRAINT "messages_parent_message_id_messages_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_workflows_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_bookings_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_availability_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_posts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_projects_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_comments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_roles";
  CREATE TYPE "public"."enum_users_roles" AS ENUM('super_admin', 'admin', 'customer');
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_roles" USING "value"::"public"."enum_users_roles";
  ALTER TABLE "channels" ALTER COLUMN "type" SET DATA TYPE text;
  ALTER TABLE "channels" ALTER COLUMN "type" SET DEFAULT 'general'::text;
  DROP TYPE "public"."enum_channels_type";
  CREATE TYPE "public"."enum_channels_type" AS ENUM('general', 'announcements', 'support', 'sales', 'team', 'social');
  ALTER TABLE "channels" ALTER COLUMN "type" SET DEFAULT 'general'::"public"."enum_channels_type";
  ALTER TABLE "channels" ALTER COLUMN "type" SET DATA TYPE "public"."enum_channels_type" USING "type"::"public"."enum_channels_type";
  ALTER TABLE "messages" ALTER COLUMN "message_type" SET DATA TYPE text;
  ALTER TABLE "messages" ALTER COLUMN "message_type" SET DEFAULT 'user'::text;
  DROP TYPE "public"."enum_messages_message_type";
  CREATE TYPE "public"."enum_messages_message_type" AS ENUM('user', 'system', 'announcement', 'ai_agent');
  ALTER TABLE "messages" ALTER COLUMN "message_type" SET DEFAULT 'user'::"public"."enum_messages_message_type";
  ALTER TABLE "messages" ALTER COLUMN "message_type" SET DATA TYPE "public"."enum_messages_message_type" USING "message_type"::"public"."enum_messages_message_type";
  DROP INDEX "users_agent_config_agent_config_handoff_to_idx";
  DROP INDEX "users_agent_config_appearance_agent_config_appearance_av_idx";
  DROP INDEX "messages_parent_message_idx";
  DROP INDEX "payload_locked_documents_rels_workflows_id_idx";
  DROP INDEX "payload_locked_documents_rels_bookings_id_idx";
  DROP INDEX "payload_locked_documents_rels_availability_id_idx";
  DROP INDEX "payload_locked_documents_rels_posts_id_idx";
  DROP INDEX "payload_locked_documents_rels_projects_id_idx";
  DROP INDEX "payload_locked_documents_rels_comments_id_idx";
  DROP INDEX "payload_locked_documents_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "payload_preferences_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "spaces_slug_idx";
  DROP INDEX "channels_slug_idx";
  DROP INDEX "pages_slug_idx";
  DROP INDEX "categories_slug_idx";
  DROP INDEX "products_slug_idx";
  ALTER TABLE "messages" ALTER COLUMN "author_id" SET NOT NULL;
  ALTER TABLE "messages" ALTER COLUMN "content" SET DATA TYPE varchar;
  CREATE UNIQUE INDEX "spaces_slug_idx" ON "spaces" USING btree ("slug");
  CREATE UNIQUE INDEX "channels_slug_idx" ON "channels" USING btree ("slug");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");
  ALTER TABLE "tenants" DROP COLUMN "type";
  ALTER TABLE "users" DROP COLUMN "agent_config_agent_type";
  ALTER TABLE "users" DROP COLUMN "agent_config_angel_name";
  ALTER TABLE "users" DROP COLUMN "agent_config_display_name";
  ALTER TABLE "users" DROP COLUMN "agent_config_personality";
  ALTER TABLE "users" DROP COLUMN "agent_config_response_rules";
  ALTER TABLE "users" DROP COLUMN "agent_config_handoff_to_id";
  ALTER TABLE "users" DROP COLUMN "agent_config_appearance_avatar_id";
  ALTER TABLE "users" DROP COLUMN "agent_config_appearance_color";
  ALTER TABLE "users" DROP COLUMN "agent_config_appearance_emoji";
  ALTER TABLE "users" DROP COLUMN "agent_config_routing_rules_is_default";
  ALTER TABLE "channels" DROP COLUMN "data";
  ALTER TABLE "channels" DROP COLUMN "widgets";
  ALTER TABLE "channels" DROP COLUMN "data_version";
  ALTER TABLE "messages" DROP COLUMN "visibility";
  ALTER TABLE "messages" DROP COLUMN "priority";
  ALTER TABLE "messages" DROP COLUMN "status";
  ALTER TABLE "messages" DROP COLUMN "metadata";
  ALTER TABLE "messages" DROP COLUMN "parent_message_id";
  ALTER TABLE "messages" DROP COLUMN "federation_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "workflows_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "bookings_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "availability_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "posts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "projects_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "comments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payload_mcp_api_keys_id";
  ALTER TABLE "payload_preferences_rels" DROP COLUMN "payload_mcp_api_keys_id";
  DROP TYPE "public"."enum_tenants_type";
  DROP TYPE "public"."enum_users_agent_config_capabilities";
  DROP TYPE "public"."enum_users_agent_config_agent_type";
  DROP TYPE "public"."enum_messages_visibility";
  DROP TYPE "public"."enum_messages_priority";
  DROP TYPE "public"."enum_messages_status";
  DROP TYPE "public"."enum_workflows_channel_types";
  DROP TYPE "public"."enum_workflows_attachment_types";
  DROP TYPE "public"."enum_workflows_trigger_type";
  DROP TYPE "public"."enum_bookings_booking_type";
  DROP TYPE "public"."enum_bookings_pricing_currency";
  DROP TYPE "public"."enum_bookings_status";
  DROP TYPE "public"."enum_bookings_location_type";
  DROP TYPE "public"."enum_bookings_location_remote_details_platform";
  DROP TYPE "public"."enum_availability_service_types_service_type";
  DROP TYPE "public"."enum_availability_availability_type";
  DROP TYPE "public"."enum_availability_weekly_schedule_day_of_week";
  DROP TYPE "public"."enum_posts_hero_links_link_type";
  DROP TYPE "public"."enum_posts_hero_links_link_appearance";
  DROP TYPE "public"."enum_posts_blocks_cta_links_link_type";
  DROP TYPE "public"."enum_posts_blocks_cta_links_link_appearance";
  DROP TYPE "public"."enum_posts_blocks_content_columns_size";
  DROP TYPE "public"."enum_posts_blocks_content_columns_link_type";
  DROP TYPE "public"."enum_posts_blocks_content_columns_link_appearance";
  DROP TYPE "public"."enum_posts_blocks_archive_populate_by";
  DROP TYPE "public"."enum_posts_blocks_archive_relation_to";
  DROP TYPE "public"."enum_posts_blocks_carousel_populate_by";
  DROP TYPE "public"."enum_posts_blocks_carousel_relation_to";
  DROP TYPE "public"."enum_posts_blocks_banner_style";
  DROP TYPE "public"."enum_posts_hero_type";
  DROP TYPE "public"."enum_posts_status";
  DROP TYPE "public"."enum__posts_v_version_hero_links_link_type";
  DROP TYPE "public"."enum__posts_v_version_hero_links_link_appearance";
  DROP TYPE "public"."enum__posts_v_blocks_cta_links_link_type";
  DROP TYPE "public"."enum__posts_v_blocks_cta_links_link_appearance";
  DROP TYPE "public"."enum__posts_v_blocks_content_columns_size";
  DROP TYPE "public"."enum__posts_v_blocks_content_columns_link_type";
  DROP TYPE "public"."enum__posts_v_blocks_content_columns_link_appearance";
  DROP TYPE "public"."enum__posts_v_blocks_archive_populate_by";
  DROP TYPE "public"."enum__posts_v_blocks_archive_relation_to";
  DROP TYPE "public"."enum__posts_v_blocks_carousel_populate_by";
  DROP TYPE "public"."enum__posts_v_blocks_carousel_relation_to";
  DROP TYPE "public"."enum__posts_v_blocks_banner_style";
  DROP TYPE "public"."enum__posts_v_version_hero_type";
  DROP TYPE "public"."enum__posts_v_version_status";
  DROP TYPE "public"."enum_projects_gallery_stage";
  DROP TYPE "public"."enum_projects_materials_category";
  DROP TYPE "public"."enum_projects_project_type";
  DROP TYPE "public"."enum_projects_budget_currency";
  DROP TYPE "public"."enum_projects_budget_budget_range";
  DROP TYPE "public"."enum_projects_project_status";`)
}
