import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tenants_bootstrap_fees_tier" AS ENUM('free', 'bootstrap', 'standard');
  CREATE TYPE "public"."enum_tenants_bootstrap_fees_refund_status" AS ENUM('accruing', 'processing', 'completed', 'waived');
  CREATE TYPE "public"."enum_users_social_providers_provider" AS ENUM('google', 'github', 'apple', 'discord', 'whatsapp', 'telegram');
  CREATE TYPE "public"."enum_bookings_cancellation_cancelled_by" AS ENUM('client', 'provider', 'system');
  CREATE TYPE "public"."enum_pages_blocks_calendar_source_type" AS ENUM('manual', 'products');
  CREATE TYPE "public"."enum_pages_blocks_calendar_default_view" AS ENUM('list', 'month');
  CREATE TYPE "public"."enum_pages_blocks_featured_endeavors_source" AS ENUM('recent', 'manual');
  CREATE TYPE "public"."enum_pages_blocks_featured_endeavors_layout" AS ENUM('grid', 'carousel', 'featured');
  CREATE TYPE "public"."enum__pages_v_blocks_calendar_source_type" AS ENUM('manual', 'products');
  CREATE TYPE "public"."enum__pages_v_blocks_calendar_default_view" AS ENUM('list', 'month');
  CREATE TYPE "public"."enum__pages_v_blocks_featured_endeavors_source" AS ENUM('recent', 'manual');
  CREATE TYPE "public"."enum__pages_v_blocks_featured_endeavors_layout" AS ENUM('grid', 'carousel', 'featured');
  CREATE TYPE "public"."enum_posts_blocks_calendar_source_type" AS ENUM('manual', 'products');
  CREATE TYPE "public"."enum_posts_blocks_calendar_default_view" AS ENUM('list', 'month');
  CREATE TYPE "public"."enum_posts_source_type" AS ENUM('youtube', 'vimeo', 'rss', 'manual');
  CREATE TYPE "public"."enum__posts_v_blocks_calendar_source_type" AS ENUM('manual', 'products');
  CREATE TYPE "public"."enum__posts_v_blocks_calendar_default_view" AS ENUM('list', 'month');
  CREATE TYPE "public"."enum__posts_v_version_source_type" AS ENUM('youtube', 'vimeo', 'rss', 'manual');
  CREATE TYPE "public"."enum_endeavors_holon_types" AS ENUM('manufacturer', 'retailer', 'creator', 'community', 'guardian-angel');
  CREATE TYPE "public"."enum_endeavors_beneficiaries_verification_status" AS ENUM('pending', 'invited', 'verified', 'declined');
  CREATE TYPE "public"."enum_connectors_type" AS ENUM('email_inbound', 'email_outbound', 'cloudflare_worker', 'stripe', 'whatsapp', 'google_chat', 'sms', 'webhook', 'livekit', 'discord', 'telegram', 'slack');
  CREATE TYPE "public"."enum_connectors_status" AS ENUM('active', 'paused', 'error', 'provisioning');
  CREATE TYPE "public"."enum_federation_audit_log_action" AS ENUM('discovery', 'heartbeat', 'catalog_browse', 'skill_invoke', 'payment', 'vouch', 'skill_list');
  CREATE TYPE "public"."enum_federation_audit_log_direction" AS ENUM('inbound', 'outbound');
  CREATE TYPE "public"."enum_federation_audit_log_trust_level" AS ENUM('none', 'probationary', 'vouched', 'full');
  CREATE TYPE "public"."enum_agent_transactions_type" AS ENUM('spend', 'earn', 'refund');
  CREATE TYPE "public"."enum_agent_transactions_skill_category" AS ENUM('catalog', 'booking', 'content', 'communication', 'analytics', 'payment', 'moderation', 'infrastructure');
  CREATE TYPE "public"."enum_agent_transactions_status" AS ENUM('pending', 'completed', 'failed', 'refunded');
  CREATE TYPE "public"."enum_media_meta_status" AS ENUM('pending', 'processing', 'complete', 'error');
  CREATE TYPE "public"."enum_media_meta_extraction_type" AS ENUM('image_vision', 'pdf_page', 'ocr', 'manual');
  CREATE TYPE "public"."enum_street_signs_holon_types" AS ENUM('manufacturer', 'retailer', 'creator', 'community', 'guardian-angel');
  CREATE TYPE "public"."enum_street_signs_content_type" AS ENUM('product', 'post', 'event', 'endeavor', 'portfolio', 'service');
  CREATE TYPE "public"."enum_street_signs_status" AS ENUM('active', 'expired', 'revoked');
  CREATE TYPE "public"."enum_quests_objectives_verification_method" AS ENUM('photo', 'video', 'gps', 'receipt', 'manual', 'auto');
  CREATE TYPE "public"."enum_quests_evidence_requirements_type" AS ENUM('photo', 'video', 'document', 'gps_checkin', 'text_report', 'receipt', 'link');
  CREATE TYPE "public"."enum_quests_status" AS ENUM('draft', 'posted', 'active', 'paused', 'completed', 'expired', 'cancelled');
  CREATE TYPE "public"."enum_quests_payout_type" AS ENUM('fixed', 'per_objective', 'bounty', 'tip');
  CREATE TYPE "public"."enum_quests_payout_payment_method" AS ENUM('stripe', 'angel_token', 'platform_credit');
  CREATE TYPE "public"."enum_quests_difficulty" AS ENUM('easy', 'medium', 'hard', 'expert');
  CREATE TYPE "public"."enum_quest_participations_evidence_type" AS ENUM('photo', 'video', 'document', 'gps_checkin', 'text_report', 'receipt', 'link');
  CREATE TYPE "public"."enum_quest_participations_status" AS ENUM('accepted', 'in_progress', 'submitted', 'under_review', 'approved', 'rejected', 'paid', 'abandoned');
  CREATE TYPE "public"."enum_quest_participations_payout_status" AS ENUM('pending', 'processing', 'paid', 'failed');
  CREATE TYPE "public"."enum_board_members_permissions" AS ENUM('oversight', 'veto', 'provision', 'moderate', 'configure');
  CREATE TYPE "public"."enum_board_members_role" AS ENUM('founder', 'advisor', 'sentinel_representative', 'observer');
  CREATE TYPE "public"."enum_board_members_term" AS ENUM('permanent', '1yr', '2yr');
  CREATE TYPE "public"."enum_board_members_status" AS ENUM('active', 'emeritus', 'removed');
  CREATE TYPE "public"."enum_logistics_nodes_inventory_category" AS ENUM('food', 'medicine', 'clothing', 'hygiene', 'shelter', 'baby', 'pet', 'other');
  CREATE TYPE "public"."enum_logistics_nodes_needs_category" AS ENUM('food', 'medicine', 'clothing', 'hygiene', 'shelter', 'baby', 'pet', 'other');
  CREATE TYPE "public"."enum_logistics_nodes_needs_urgency" AS ENUM('standard', 'urgent', 'sos');
  CREATE TYPE "public"."enum_logistics_nodes_type" AS ENUM('pantry', 'shelter', 'dropzone', 'warehouse', 'medical', 'distribution', 'community_fridge');
  CREATE TYPE "public"."enum_logistics_nodes_governance_mode" AS ENUM('regulated', 'autonomous');
  CREATE TYPE "public"."enum_logistics_nodes_status" AS ENUM('active', 'inactive', 'seasonal');
  CREATE TYPE "public"."enum_transports_special_capabilities" AS ENUM('refrigerated', 'temp_controlled', 'hazmat', 'accessible', 'pet_friendly');
  CREATE TYPE "public"."enum_transports_transport_type" AS ENUM('van', 'pickup', 'box_truck', 'car', 'bicycle', 'foot', 'boat', 'drone');
  CREATE TYPE "public"."enum_transports_status" AS ENUM('idle', 'en_route', 'loading', 'returning', 'offline', 'maintenance');
  CREATE TYPE "public"."enum_shipments_manifest_category" AS ENUM('food', 'medicine', 'clothing', 'hygiene', 'shelter', 'baby', 'pet', 'other');
  CREATE TYPE "public"."enum_shipments_priority" AS ENUM('standard', 'urgent', 'sos');
  CREATE TYPE "public"."enum_shipments_status" AS ENUM('pending', 'matched', 'dispatched', 'in_transit', 'delivered', 'cancelled', 'failed');
  CREATE TYPE "public"."enum_shipments_match_type" AS ENUM('manual', 'auto', 'sos_dispatch');
  CREATE TYPE "public"."enum_work_units_type" AS ENUM('computation', 'analysis', 'generation', 'transformation', 'aggregation');
  CREATE TYPE "public"."enum_work_units_status" AS ENUM('pending', 'claimed', 'executing', 'completed', 'failed', 'timeout', 'cancelled');
  CREATE TYPE "public"."enum_work_units_priority" AS ENUM('critical', 'high', 'normal', 'low', 'background');
  CREATE TYPE "public"."enum_work_units_requirements_compute_class" AS ENUM('lightweight', 'standard', 'heavy');
  CREATE TYPE "public"."enum_work_units_requirements_min_trust_level" AS ENUM('none', 'probationary', 'vouched', 'full');
  CREATE TYPE "public"."enum_products_blocks_calendar_source_type" AS ENUM('manual', 'products');
  CREATE TYPE "public"."enum_products_blocks_calendar_default_view" AS ENUM('list', 'month');
  CREATE TYPE "public"."enum_products_participants_role" AS ENUM('designer', 'manufacturer', 'licensor', 'affiliate', 'contributor');
  CREATE TYPE "public"."enum__products_v_blocks_calendar_source_type" AS ENUM('manual', 'products');
  CREATE TYPE "public"."enum__products_v_blocks_calendar_default_view" AS ENUM('list', 'month');
  CREATE TYPE "public"."enum__products_v_version_participants_role" AS ENUM('designer', 'manufacturer', 'licensor', 'affiliate', 'contributor');
  CREATE TYPE "public"."enum_orders_fulfillment_token_status" AS ENUM('active', 'redeemed', 'refunded');
  ALTER TYPE "public"."enum_tenants_business_type" ADD VALUE 'gift_shop' BEFORE 'service';
  ALTER TYPE "public"."enum_tenants_business_type" ADD VALUE 'ministry' BEFORE 'professional_services';
  ALTER TYPE "public"."enum_tenants_business_type" ADD VALUE 'artisan_maker' BEFORE 'custom';
  ALTER TYPE "public"."enum_channels_type" ADD VALUE 'leo' BEFORE 'announcements';
  ALTER TYPE "public"."enum_channels_type" ADD VALUE 'email' BEFORE 'dm';
  ALTER TYPE "public"."enum_channels_type" ADD VALUE 'whatsapp' BEFORE 'dm';
  ALTER TYPE "public"."enum_channels_type" ADD VALUE 'sms' BEFORE 'dm';
  ALTER TYPE "public"."enum_channels_source" ADD VALUE 'discord';
  ALTER TYPE "public"."enum_channels_source" ADD VALUE 'telegram';
  ALTER TYPE "public"."enum_channels_source" ADD VALUE 'slack';
  ALTER TYPE "public"."enum_channels_source" ADD VALUE 'federation';
  ALTER TYPE "public"."enum_messages_message_type" ADD VALUE 'voice_call';
  ALTER TYPE "public"."enum_messages_message_type" ADD VALUE 'discord_message';
  ALTER TYPE "public"."enum_messages_message_type" ADD VALUE 'whatsapp_message';
  ALTER TYPE "public"."enum_messages_message_type" ADD VALUE 'email_message';
  ALTER TYPE "public"."enum_messages_message_type" ADD VALUE 'sms_message';
  ALTER TYPE "public"."enum_messages_message_type" ADD VALUE 'telegram_message';
  ALTER TYPE "public"."enum_messages_message_type" ADD VALUE 'federation_message';
  ALTER TYPE "public"."enum_orders_fulfillment_fulfillment_status" ADD VALUE 'cancelled';
  CREATE TABLE "users_social_providers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"provider" "enum_users_social_providers_provider" NOT NULL,
  	"provider_id" varchar NOT NULL,
  	"email" varchar,
  	"display_name" varchar,
  	"avatar_url" varchar,
  	"linked_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "pages_blocks_calendar_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"date" timestamp(3) with time zone,
  	"time" varchar,
  	"venue" varchar,
  	"location" varchar,
  	"description" varchar,
  	"ticket_url" varchar,
  	"sold_out" boolean DEFAULT false,
  	"featured" boolean DEFAULT false
  );
  
  CREATE TABLE "pages_blocks_calendar" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"description" jsonb,
  	"source_type" "enum_pages_blocks_calendar_source_type" DEFAULT 'manual',
  	"product_category" varchar DEFAULT 'events',
  	"max_events" numeric DEFAULT 20,
  	"default_view" "enum_pages_blocks_calendar_default_view" DEFAULT 'list',
  	"show_past_events" boolean DEFAULT false,
  	"accent_color" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_featured_endeavors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Featured Endeavors',
  	"subheading" varchar,
  	"source" "enum_pages_blocks_featured_endeavors_source" DEFAULT 'recent',
  	"max_items" numeric DEFAULT 5,
  	"layout" "enum_pages_blocks_featured_endeavors_layout" DEFAULT 'grid',
  	"show_description" boolean DEFAULT true,
  	"show_region" boolean DEFAULT true,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_calendar_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"date" timestamp(3) with time zone,
  	"time" varchar,
  	"venue" varchar,
  	"location" varchar,
  	"description" varchar,
  	"ticket_url" varchar,
  	"sold_out" boolean DEFAULT false,
  	"featured" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_calendar" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"description" jsonb,
  	"source_type" "enum__pages_v_blocks_calendar_source_type" DEFAULT 'manual',
  	"product_category" varchar DEFAULT 'events',
  	"max_events" numeric DEFAULT 20,
  	"default_view" "enum__pages_v_blocks_calendar_default_view" DEFAULT 'list',
  	"show_past_events" boolean DEFAULT false,
  	"accent_color" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_featured_endeavors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar DEFAULT 'Featured Endeavors',
  	"subheading" varchar,
  	"source" "enum__pages_v_blocks_featured_endeavors_source" DEFAULT 'recent',
  	"max_items" numeric DEFAULT 5,
  	"layout" "enum__pages_v_blocks_featured_endeavors_layout" DEFAULT 'grid',
  	"show_description" boolean DEFAULT true,
  	"show_region" boolean DEFAULT true,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "posts_blocks_calendar_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"date" timestamp(3) with time zone,
  	"time" varchar,
  	"venue" varchar,
  	"location" varchar,
  	"description" varchar,
  	"ticket_url" varchar,
  	"sold_out" boolean DEFAULT false,
  	"featured" boolean DEFAULT false
  );
  
  CREATE TABLE "posts_blocks_calendar" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"description" jsonb,
  	"source_type" "enum_posts_blocks_calendar_source_type" DEFAULT 'manual',
  	"product_category" varchar DEFAULT 'events',
  	"max_events" numeric DEFAULT 20,
  	"default_view" "enum_posts_blocks_calendar_default_view" DEFAULT 'list',
  	"show_past_events" boolean DEFAULT false,
  	"accent_color" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_calendar_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"date" timestamp(3) with time zone,
  	"time" varchar,
  	"venue" varchar,
  	"location" varchar,
  	"description" varchar,
  	"ticket_url" varchar,
  	"sold_out" boolean DEFAULT false,
  	"featured" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_posts_v_blocks_calendar" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"description" jsonb,
  	"source_type" "enum__posts_v_blocks_calendar_source_type" DEFAULT 'manual',
  	"product_category" varchar DEFAULT 'events',
  	"max_events" numeric DEFAULT 20,
  	"default_view" "enum__posts_v_blocks_calendar_default_view" DEFAULT 'list',
  	"show_past_events" boolean DEFAULT false,
  	"accent_color" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "endeavors_holon_types" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_endeavors_holon_types",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "endeavors_beneficiaries" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"email" varchar,
  	"role" varchar,
  	"description" varchar,
  	"claim_token" varchar,
  	"verification_status" "enum_endeavors_beneficiaries_verification_status" DEFAULT 'pending',
  	"linked_user_id" integer,
  	"verified_at" timestamp(3) with time zone,
  	"designated_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "connectors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"name" varchar NOT NULL,
  	"type" "enum_connectors_type" NOT NULL,
  	"space_id" integer,
  	"enabled" boolean DEFAULT true,
  	"priority" numeric DEFAULT 0,
  	"config" jsonb,
  	"routing_channel_id" integer,
  	"system_user_id" integer,
  	"status" "enum_connectors_status" DEFAULT 'active',
  	"last_activity" timestamp(3) with time zone,
  	"error_message" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "federation_audit_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"action" "enum_federation_audit_log_action" NOT NULL,
  	"direction" "enum_federation_audit_log_direction" NOT NULL,
  	"source_federation_id" varchar NOT NULL,
  	"source_domain" varchar,
  	"source_name" varchar,
  	"target_action" varchar,
  	"trust_level" "enum_federation_audit_log_trust_level",
  	"allowed" boolean DEFAULT false NOT NULL,
  	"denied_reason" varchar,
  	"response_time_ms" numeric,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "agent_transactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"type" "enum_agent_transactions_type" NOT NULL,
  	"amount_cents" numeric NOT NULL,
  	"currency" varchar DEFAULT 'usd',
  	"description" varchar NOT NULL,
  	"counterparty_federation_id" varchar,
  	"counterparty_domain" varchar,
  	"counterparty_name" varchar,
  	"skill_invoked" varchar,
  	"skill_category" "enum_agent_transactions_skill_category",
  	"stripe_payment_intent_id" varchar,
  	"status" "enum_agent_transactions_status" DEFAULT 'pending' NOT NULL,
  	"metadata" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "media_meta" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"media_id" integer NOT NULL,
  	"source_message_id" integer,
  	"status" "enum_media_meta_status" DEFAULT 'pending' NOT NULL,
  	"extraction_type" "enum_media_meta_extraction_type" NOT NULL,
  	"vision_analysis" jsonb,
  	"ocr_text" varchar,
  	"document_group" varchar,
  	"page_number" numeric,
  	"total_pages" numeric,
  	"tags" jsonb,
  	"entities" jsonb,
  	"summary" varchar,
  	"rag_indexed" boolean DEFAULT false,
  	"rag_chunks" jsonb,
  	"embedding" jsonb,
  	"processed_at" timestamp(3) with time zone,
  	"processed_by" varchar,
  	"processing_error" varchar,
  	"processing_duration_ms" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "street_signs_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar NOT NULL
  );
  
  CREATE TABLE "street_signs_holon_types" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_street_signs_holon_types",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "street_signs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"content_type" "enum_street_signs_content_type" NOT NULL,
  	"source_diocese_name" varchar NOT NULL,
  	"source_diocese_domain" varchar NOT NULL,
  	"source_federation_id" varchar NOT NULL,
  	"source_content_id" varchar NOT NULL,
  	"source_content_url" varchar,
  	"source_creator_name" varchar,
  	"region" varchar,
  	"thumbnail_id" integer,
  	"price" numeric,
  	"currency" varchar DEFAULT 'usd',
  	"status" "enum_street_signs_status" DEFAULT 'active' NOT NULL,
  	"impressions" numeric DEFAULT 0,
  	"click_throughs" numeric DEFAULT 0,
  	"last_synced_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "quests_objectives" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"required" boolean DEFAULT true,
  	"verification_method" "enum_quests_objectives_verification_method" DEFAULT 'manual'
  );
  
  CREATE TABLE "quests_evidence_requirements" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_quests_evidence_requirements_type" NOT NULL,
  	"description" varchar,
  	"required" boolean DEFAULT true
  );
  
  CREATE TABLE "quests" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"title" varchar NOT NULL,
  	"description" jsonb,
  	"status" "enum_quests_status" DEFAULT 'draft' NOT NULL,
  	"quest_type" varchar,
  	"featured_image_id" integer,
  	"payout_type" "enum_quests_payout_type" DEFAULT 'fixed',
  	"payout_amount" numeric,
  	"payout_currency" varchar DEFAULT 'USD',
  	"payout_payment_method" "enum_quests_payout_payment_method" DEFAULT 'stripe',
  	"requirements_min_participants" numeric DEFAULT 1,
  	"requirements_max_participants" numeric,
  	"requirements_team_size" numeric,
  	"requirements_starts_at" timestamp(3) with time zone,
  	"requirements_expires_at" timestamp(3) with time zone,
  	"requirements_time_limit" numeric,
  	"requirements_prerequisites" jsonb,
  	"location_address" varchar,
  	"location_latitude" numeric,
  	"location_longitude" numeric,
  	"location_radius" numeric,
  	"location_is_remote" boolean DEFAULT true,
  	"posted_by_id" integer,
  	"metadata" jsonb,
  	"difficulty" "enum_quests_difficulty",
  	"reputation_reward" numeric,
  	"network_listing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "quests_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"categories_id" integer
  );
  
  CREATE TABLE "quest_participations_evidence" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_quest_participations_evidence_type" NOT NULL,
  	"media_id" integer,
  	"text" varchar,
  	"url" varchar,
  	"latitude" numeric,
  	"longitude" numeric,
  	"submitted_at" timestamp(3) with time zone,
  	"notes" varchar
  );
  
  CREATE TABLE "quest_participations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"quest_id" integer NOT NULL,
  	"participant_id" integer NOT NULL,
  	"status" "enum_quest_participations_status" DEFAULT 'accepted' NOT NULL,
  	"objectives_completed" jsonb,
  	"reviewed_by_id" integer,
  	"review_notes" varchar,
  	"rating" numeric,
  	"payout_status" "enum_quest_participations_payout_status" DEFAULT 'pending',
  	"payout_amount" numeric,
  	"accepted_at" timestamp(3) with time zone,
  	"started_at" timestamp(3) with time zone,
  	"submitted_at" timestamp(3) with time zone,
  	"reviewed_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"team_id" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "quest_participations_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "board_members_permissions" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_board_members_permissions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "board_members" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"user_id" integer NOT NULL,
  	"role" "enum_board_members_role" DEFAULT 'observer' NOT NULL,
  	"title" varchar NOT NULL,
  	"appointed_at" timestamp(3) with time zone NOT NULL,
  	"term" "enum_board_members_term" DEFAULT 'permanent' NOT NULL,
  	"status" "enum_board_members_status" DEFAULT 'active' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "logistics_nodes_compliance_certs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"cert_type" varchar,
  	"cert_doc_id" integer,
  	"expires_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "logistics_nodes_inventory" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar NOT NULL,
  	"category" "enum_logistics_nodes_inventory_category",
  	"quantity" numeric NOT NULL,
  	"unit" varchar DEFAULT 'units',
  	"expires_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "logistics_nodes_needs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar NOT NULL,
  	"category" "enum_logistics_nodes_needs_category",
  	"quantity" numeric NOT NULL,
  	"urgency" "enum_logistics_nodes_needs_urgency" DEFAULT 'standard'
  );
  
  CREATE TABLE "logistics_nodes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"name" varchar NOT NULL,
  	"handle" varchar,
  	"type" "enum_logistics_nodes_type" NOT NULL,
  	"governance_mode" "enum_logistics_nodes_governance_mode" DEFAULT 'autonomous' NOT NULL,
  	"insurance_policy_id" integer,
  	"liability_waiver_signed" boolean DEFAULT false,
  	"trust_score" numeric DEFAULT 1,
  	"completed_shipments" numeric DEFAULT 0,
  	"location_lat" numeric NOT NULL,
  	"location_lng" numeric NOT NULL,
  	"location_address" varchar,
  	"location_city" varchar,
  	"location_state" varchar,
  	"location_zip" varchar,
  	"geohash" varchar,
  	"service_radius" numeric DEFAULT 25,
  	"status" "enum_logistics_nodes_status" DEFAULT 'active',
  	"operating_hours" varchar,
  	"contact_name" varchar,
  	"contact_phone" varchar,
  	"contact_email" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "transports_special_capabilities" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_transports_special_capabilities",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "transports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"vehicle_name" varchar NOT NULL,
  	"owner_id" integer NOT NULL,
  	"transport_type" "enum_transports_transport_type" DEFAULT 'van' NOT NULL,
  	"capacity" numeric NOT NULL,
  	"status" "enum_transports_status" DEFAULT 'idle' NOT NULL,
  	"current_location_lat" numeric,
  	"current_location_lng" numeric,
  	"current_location_updated_at" timestamp(3) with time zone,
  	"home_base_id" integer,
  	"max_range" numeric DEFAULT 50,
  	"available_from" varchar,
  	"completed_deliveries" numeric DEFAULT 0,
  	"rating" numeric DEFAULT 5,
  	"active_shipment_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "shipments_manifest" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"item" varchar NOT NULL,
  	"category" "enum_shipments_manifest_category",
  	"quantity" numeric NOT NULL,
  	"unit" varchar DEFAULT 'units',
  	"weight" numeric,
  	"perishable" boolean DEFAULT false,
  	"requires_refrigeration" boolean DEFAULT false
  );
  
  CREATE TABLE "shipments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"shipment_id" varchar,
  	"origin_id" integer NOT NULL,
  	"destination_id" integer NOT NULL,
  	"distance_miles" numeric,
  	"priority" "enum_shipments_priority" DEFAULT 'standard' NOT NULL,
  	"status" "enum_shipments_status" DEFAULT 'pending' NOT NULL,
  	"failure_reason" varchar,
  	"assigned_transport_id" integer,
  	"driver_id" integer,
  	"match_type" "enum_shipments_match_type" DEFAULT 'manual',
  	"match_score" numeric,
  	"matched_at" timestamp(3) with time zone,
  	"dispatched_at" timestamp(3) with time zone,
  	"picked_up_at" timestamp(3) with time zone,
  	"delivered_at" timestamp(3) with time zone,
  	"estimated_arrival" timestamp(3) with time zone,
  	"proof_of_delivery_photo_id" integer,
  	"proof_of_delivery_recipient_name" varchar,
  	"proof_of_delivery_recipient_signature" boolean,
  	"proof_of_delivery_notes" varchar,
  	"total_size" numeric,
  	"total_weight" numeric,
  	"requested_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pheromones" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"context_hash" varchar NOT NULL,
  	"path" varchar NOT NULL,
  	"tool_name" varchar,
  	"strength" numeric DEFAULT 1 NOT NULL,
  	"successful_traversals" numeric DEFAULT 1,
  	"abandonments" numeric DEFAULT 0,
  	"last_traversed_at" timestamp(3) with time zone NOT NULL,
  	"decay" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "work_units" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"work_unit_id" varchar NOT NULL,
  	"type" "enum_work_units_type" NOT NULL,
  	"status" "enum_work_units_status" DEFAULT 'pending' NOT NULL,
  	"priority" "enum_work_units_priority" DEFAULT 'normal' NOT NULL,
  	"input_data" jsonb NOT NULL,
  	"output_schema" jsonb,
  	"result" jsonb,
  	"requirements_compute_class" "enum_work_units_requirements_compute_class" DEFAULT 'standard' NOT NULL,
  	"requirements_min_trust_level" "enum_work_units_requirements_min_trust_level" DEFAULT 'probationary' NOT NULL,
  	"requirements_required_capabilities" jsonb DEFAULT '[]'::jsonb,
  	"requirements_estimated_duration_ms" numeric DEFAULT 30000,
  	"requirements_max_duration_ms" numeric DEFAULT 120000,
  	"retry_policy_max_retries" numeric DEFAULT 3,
  	"retry_policy_backoff_ms" numeric DEFAULT 1000,
  	"retry_policy_backoff_multiplier" numeric DEFAULT 2,
  	"attempt_count" numeric DEFAULT 0,
  	"last_error" varchar,
  	"assigned_node" varchar,
  	"claimed_at" timestamp(3) with time zone,
  	"started_at" timestamp(3) with time zone,
  	"completed_at" timestamp(3) with time zone,
  	"deadline" timestamp(3) with time zone,
  	"origin_node" varchar NOT NULL,
  	"origin_tenant" numeric,
  	"skill_name" varchar,
  	"parent_work_unit_id" varchar,
  	"execution_time_ms" numeric,
  	"executed_by" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_blocks_calendar_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"date" timestamp(3) with time zone,
  	"time" varchar,
  	"venue" varchar,
  	"location" varchar,
  	"description" varchar,
  	"ticket_url" varchar,
  	"sold_out" boolean DEFAULT false,
  	"featured" boolean DEFAULT false
  );
  
  CREATE TABLE "products_blocks_calendar" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"description" jsonb,
  	"source_type" "enum_products_blocks_calendar_source_type" DEFAULT 'manual',
  	"product_category" varchar DEFAULT 'events',
  	"max_events" numeric DEFAULT 20,
  	"default_view" "enum_products_blocks_calendar_default_view" DEFAULT 'list',
  	"show_past_events" boolean DEFAULT false,
  	"accent_color" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "products_participants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"role" "enum_products_participants_role",
  	"percentage" numeric,
  	"label" varchar
  );
  
  CREATE TABLE "_products_v_blocks_calendar_events" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"date" timestamp(3) with time zone,
  	"time" varchar,
  	"venue" varchar,
  	"location" varchar,
  	"description" varchar,
  	"ticket_url" varchar,
  	"sold_out" boolean DEFAULT false,
  	"featured" boolean DEFAULT false,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_products_v_blocks_calendar" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"description" jsonb,
  	"source_type" "enum__products_v_blocks_calendar_source_type" DEFAULT 'manual',
  	"product_category" varchar DEFAULT 'events',
  	"max_events" numeric DEFAULT 20,
  	"default_view" "enum__products_v_blocks_calendar_default_view" DEFAULT 'list',
  	"show_past_events" boolean DEFAULT false,
  	"accent_color" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_products_v_version_participants" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"role" "enum__products_v_version_participants_role",
  	"percentage" numeric,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  ALTER TABLE "tenants" ADD COLUMN "vapi_enabled" boolean DEFAULT false;
  ALTER TABLE "tenants" ADD COLUMN "vapi_phone_number" varchar;
  ALTER TABLE "tenants" ADD COLUMN "vapi_assistant_id" varchar;
  ALTER TABLE "tenants" ADD COLUMN "vapi_voice_id" varchar;
  ALTER TABLE "tenants" ADD COLUMN "vapi_greeting" varchar;
  ALTER TABLE "tenants" ADD COLUMN "agent_wallet_enabled" boolean DEFAULT false;
  ALTER TABLE "tenants" ADD COLUMN "agent_wallet_monthly_budget_cents" numeric DEFAULT 0;
  ALTER TABLE "tenants" ADD COLUMN "agent_wallet_spent_this_month_cents" numeric DEFAULT 0;
  ALTER TABLE "tenants" ADD COLUMN "agent_wallet_lifetime_spent_cents" numeric DEFAULT 0;
  ALTER TABLE "tenants" ADD COLUMN "agent_wallet_lifetime_earned_cents" numeric DEFAULT 0;
  ALTER TABLE "tenants" ADD COLUMN "agent_wallet_last_reset_at" timestamp(3) with time zone;
  ALTER TABLE "tenants" ADD COLUMN "agent_wallet_spending_rules" jsonb;
  ALTER TABLE "tenants" ADD COLUMN "bootstrap_fees_tier" "enum_tenants_bootstrap_fees_tier" DEFAULT 'free';
  ALTER TABLE "tenants" ADD COLUMN "bootstrap_fees_free_transactions_used" numeric DEFAULT 0;
  ALTER TABLE "tenants" ADD COLUMN "bootstrap_fees_free_transaction_limit" numeric DEFAULT 50;
  ALTER TABLE "tenants" ADD COLUMN "bootstrap_fees_free_gmv_cents" numeric DEFAULT 0;
  ALTER TABLE "tenants" ADD COLUMN "bootstrap_fees_free_gmv_limit_cents" numeric DEFAULT 500000;
  ALTER TABLE "tenants" ADD COLUMN "bootstrap_fees_bootstrap_fee_percent" numeric DEFAULT 5;
  ALTER TABLE "tenants" ADD COLUMN "bootstrap_fees_total_fees_collected_cents" numeric DEFAULT 0;
  ALTER TABLE "tenants" ADD COLUMN "bootstrap_fees_refund_promised" boolean DEFAULT true;
  ALTER TABLE "tenants" ADD COLUMN "bootstrap_fees_refund_status" "enum_tenants_bootstrap_fees_refund_status" DEFAULT 'accruing';
  ALTER TABLE "tenants" ADD COLUMN "bootstrap_fees_bootstrap_started_at" timestamp(3) with time zone;
  ALTER TABLE "tenants" ADD COLUMN "bootstrap_fees_bootstrap_ended_at" timestamp(3) with time zone;
  ALTER TABLE "bookings" ADD COLUMN "cancellation_reason" varchar;
  ALTER TABLE "bookings" ADD COLUMN "cancellation_cancelled_by" "enum_bookings_cancellation_cancelled_by";
  ALTER TABLE "bookings" ADD COLUMN "cancellation_cancelled_at" timestamp(3) with time zone;
  ALTER TABLE "bookings" ADD COLUMN "rescheduling_rescheduled_from" jsonb;
  ALTER TABLE "bookings" ADD COLUMN "rescheduling_reschedule_count" numeric DEFAULT 0;
  ALTER TABLE "header" ADD COLUMN "label" varchar DEFAULT 'Main Header';
  ALTER TABLE "footer" ADD COLUMN "label" varchar DEFAULT 'Main Footer';
  ALTER TABLE "pages_rels" ADD COLUMN "endeavors_id" integer;
  ALTER TABLE "_pages_v_rels" ADD COLUMN "endeavors_id" integer;
  ALTER TABLE "posts" ADD COLUMN "source_url" varchar;
  ALTER TABLE "posts" ADD COLUMN "source_type" "enum_posts_source_type";
  ALTER TABLE "_posts_v" ADD COLUMN "version_source_url" varchar;
  ALTER TABLE "_posts_v" ADD COLUMN "version_source_type" "enum__posts_v_version_source_type";
  ALTER TABLE "reviews" ADD COLUMN "tenant_id" integer;
  ALTER TABLE "endeavors" ADD COLUMN "tenant_id" integer;
  ALTER TABLE "endeavors" ADD COLUMN "mission_statement" varchar;
  ALTER TABLE "products_required_capabilities" ADD COLUMN "equipment" varchar;
  ALTER TABLE "products" ADD COLUMN "low_stock_threshold" numeric DEFAULT 10;
  ALTER TABLE "products_rels" ADD COLUMN "users_id" integer;
  ALTER TABLE "products_rels" ADD COLUMN "tenants_id" integer;
  ALTER TABLE "_products_v_version_required_capabilities" ADD COLUMN "equipment" varchar;
  ALTER TABLE "_products_v" ADD COLUMN "version_low_stock_threshold" numeric DEFAULT 10;
  ALTER TABLE "_products_v_rels" ADD COLUMN "users_id" integer;
  ALTER TABLE "_products_v_rels" ADD COLUMN "tenants_id" integer;
  ALTER TABLE "orders_fulfillment" ADD COLUMN "angel_token_id" varchar;
  ALTER TABLE "orders_fulfillment" ADD COLUMN "token_status" "enum_orders_fulfillment_token_status";
  ALTER TABLE "orders_fulfillment" ADD COLUMN "queued_at" timestamp(3) with time zone;
  ALTER TABLE "orders_fulfillment" ADD COLUMN "queue_reason" varchar;
  ALTER TABLE "orders_fulfillment" ADD COLUMN "customer_notified_at" timestamp(3) with time zone;
  ALTER TABLE "orders_fulfillment" ADD COLUMN "selected_configuration" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "connectors_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "federation_audit_log_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "agent_transactions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "media_meta_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "street_signs_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "quests_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "quest_participations_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "board_members_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "logistics_nodes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "transports_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "shipments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "pheromones_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "work_units_id" integer;
  ALTER TABLE "users_social_providers" ADD CONSTRAINT "users_social_providers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_calendar_events" ADD CONSTRAINT "pages_blocks_calendar_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_calendar"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_calendar" ADD CONSTRAINT "pages_blocks_calendar_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_featured_endeavors" ADD CONSTRAINT "pages_blocks_featured_endeavors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_calendar_events" ADD CONSTRAINT "_pages_v_blocks_calendar_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_calendar"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_calendar" ADD CONSTRAINT "_pages_v_blocks_calendar_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_featured_endeavors" ADD CONSTRAINT "_pages_v_blocks_featured_endeavors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_calendar_events" ADD CONSTRAINT "posts_blocks_calendar_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts_blocks_calendar"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_blocks_calendar" ADD CONSTRAINT "posts_blocks_calendar_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_calendar_events" ADD CONSTRAINT "_posts_v_blocks_calendar_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v_blocks_calendar"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_posts_v_blocks_calendar" ADD CONSTRAINT "_posts_v_blocks_calendar_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "endeavors_holon_types" ADD CONSTRAINT "endeavors_holon_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."endeavors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "endeavors_beneficiaries" ADD CONSTRAINT "endeavors_beneficiaries_linked_user_id_users_id_fk" FOREIGN KEY ("linked_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "endeavors_beneficiaries" ADD CONSTRAINT "endeavors_beneficiaries_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."endeavors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "connectors" ADD CONSTRAINT "connectors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "connectors" ADD CONSTRAINT "connectors_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "connectors" ADD CONSTRAINT "connectors_routing_channel_id_channels_id_fk" FOREIGN KEY ("routing_channel_id") REFERENCES "public"."channels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "connectors" ADD CONSTRAINT "connectors_system_user_id_users_id_fk" FOREIGN KEY ("system_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "agent_transactions" ADD CONSTRAINT "agent_transactions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media_meta" ADD CONSTRAINT "media_meta_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media_meta" ADD CONSTRAINT "media_meta_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media_meta" ADD CONSTRAINT "media_meta_source_message_id_messages_id_fk" FOREIGN KEY ("source_message_id") REFERENCES "public"."messages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "street_signs_tags" ADD CONSTRAINT "street_signs_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."street_signs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "street_signs_holon_types" ADD CONSTRAINT "street_signs_holon_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."street_signs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "street_signs" ADD CONSTRAINT "street_signs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "street_signs" ADD CONSTRAINT "street_signs_thumbnail_id_media_id_fk" FOREIGN KEY ("thumbnail_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quests_objectives" ADD CONSTRAINT "quests_objectives_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quests_evidence_requirements" ADD CONSTRAINT "quests_evidence_requirements_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quests" ADD CONSTRAINT "quests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quests" ADD CONSTRAINT "quests_featured_image_id_media_id_fk" FOREIGN KEY ("featured_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quests" ADD CONSTRAINT "quests_posted_by_id_users_id_fk" FOREIGN KEY ("posted_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quests_rels" ADD CONSTRAINT "quests_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quests_rels" ADD CONSTRAINT "quests_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quest_participations_evidence" ADD CONSTRAINT "quest_participations_evidence_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quest_participations_evidence" ADD CONSTRAINT "quest_participations_evidence_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quest_participations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quest_participations" ADD CONSTRAINT "quest_participations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quest_participations" ADD CONSTRAINT "quest_participations_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quest_participations" ADD CONSTRAINT "quest_participations_participant_id_users_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quest_participations" ADD CONSTRAINT "quest_participations_reviewed_by_id_users_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quest_participations_rels" ADD CONSTRAINT "quest_participations_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."quest_participations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quest_participations_rels" ADD CONSTRAINT "quest_participations_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "board_members_permissions" ADD CONSTRAINT "board_members_permissions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."board_members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "board_members" ADD CONSTRAINT "board_members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "board_members" ADD CONSTRAINT "board_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "logistics_nodes_compliance_certs" ADD CONSTRAINT "logistics_nodes_compliance_certs_cert_doc_id_media_id_fk" FOREIGN KEY ("cert_doc_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "logistics_nodes_compliance_certs" ADD CONSTRAINT "logistics_nodes_compliance_certs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."logistics_nodes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "logistics_nodes_inventory" ADD CONSTRAINT "logistics_nodes_inventory_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."logistics_nodes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "logistics_nodes_needs" ADD CONSTRAINT "logistics_nodes_needs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."logistics_nodes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "logistics_nodes" ADD CONSTRAINT "logistics_nodes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "logistics_nodes" ADD CONSTRAINT "logistics_nodes_insurance_policy_id_media_id_fk" FOREIGN KEY ("insurance_policy_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transports_special_capabilities" ADD CONSTRAINT "transports_special_capabilities_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."transports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "transports" ADD CONSTRAINT "transports_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transports" ADD CONSTRAINT "transports_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transports" ADD CONSTRAINT "transports_home_base_id_logistics_nodes_id_fk" FOREIGN KEY ("home_base_id") REFERENCES "public"."logistics_nodes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "transports" ADD CONSTRAINT "transports_active_shipment_id_shipments_id_fk" FOREIGN KEY ("active_shipment_id") REFERENCES "public"."shipments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "shipments_manifest" ADD CONSTRAINT "shipments_manifest_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "shipments" ADD CONSTRAINT "shipments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "shipments" ADD CONSTRAINT "shipments_origin_id_logistics_nodes_id_fk" FOREIGN KEY ("origin_id") REFERENCES "public"."logistics_nodes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "shipments" ADD CONSTRAINT "shipments_destination_id_logistics_nodes_id_fk" FOREIGN KEY ("destination_id") REFERENCES "public"."logistics_nodes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "shipments" ADD CONSTRAINT "shipments_assigned_transport_id_transports_id_fk" FOREIGN KEY ("assigned_transport_id") REFERENCES "public"."transports"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "shipments" ADD CONSTRAINT "shipments_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "shipments" ADD CONSTRAINT "shipments_proof_of_delivery_photo_id_media_id_fk" FOREIGN KEY ("proof_of_delivery_photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "shipments" ADD CONSTRAINT "shipments_requested_by_id_users_id_fk" FOREIGN KEY ("requested_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pheromones" ADD CONSTRAINT "pheromones_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "work_units" ADD CONSTRAINT "work_units_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_blocks_calendar_events" ADD CONSTRAINT "products_blocks_calendar_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_blocks_calendar"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_blocks_calendar" ADD CONSTRAINT "products_blocks_calendar_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_participants" ADD CONSTRAINT "products_participants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_blocks_calendar_events" ADD CONSTRAINT "_products_v_blocks_calendar_events_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v_blocks_calendar"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_blocks_calendar" ADD CONSTRAINT "_products_v_blocks_calendar_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_version_participants" ADD CONSTRAINT "_products_v_version_participants_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_products_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_social_providers_order_idx" ON "users_social_providers" USING btree ("_order");
  CREATE INDEX "users_social_providers_parent_id_idx" ON "users_social_providers" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_calendar_events_order_idx" ON "pages_blocks_calendar_events" USING btree ("_order");
  CREATE INDEX "pages_blocks_calendar_events_parent_id_idx" ON "pages_blocks_calendar_events" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_calendar_order_idx" ON "pages_blocks_calendar" USING btree ("_order");
  CREATE INDEX "pages_blocks_calendar_parent_id_idx" ON "pages_blocks_calendar" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_calendar_path_idx" ON "pages_blocks_calendar" USING btree ("_path");
  CREATE INDEX "pages_blocks_featured_endeavors_order_idx" ON "pages_blocks_featured_endeavors" USING btree ("_order");
  CREATE INDEX "pages_blocks_featured_endeavors_parent_id_idx" ON "pages_blocks_featured_endeavors" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_featured_endeavors_path_idx" ON "pages_blocks_featured_endeavors" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_calendar_events_order_idx" ON "_pages_v_blocks_calendar_events" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_calendar_events_parent_id_idx" ON "_pages_v_blocks_calendar_events" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_calendar_order_idx" ON "_pages_v_blocks_calendar" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_calendar_parent_id_idx" ON "_pages_v_blocks_calendar" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_calendar_path_idx" ON "_pages_v_blocks_calendar" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_featured_endeavors_order_idx" ON "_pages_v_blocks_featured_endeavors" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_featured_endeavors_parent_id_idx" ON "_pages_v_blocks_featured_endeavors" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_featured_endeavors_path_idx" ON "_pages_v_blocks_featured_endeavors" USING btree ("_path");
  CREATE INDEX "posts_blocks_calendar_events_order_idx" ON "posts_blocks_calendar_events" USING btree ("_order");
  CREATE INDEX "posts_blocks_calendar_events_parent_id_idx" ON "posts_blocks_calendar_events" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_calendar_order_idx" ON "posts_blocks_calendar" USING btree ("_order");
  CREATE INDEX "posts_blocks_calendar_parent_id_idx" ON "posts_blocks_calendar" USING btree ("_parent_id");
  CREATE INDEX "posts_blocks_calendar_path_idx" ON "posts_blocks_calendar" USING btree ("_path");
  CREATE INDEX "_posts_v_blocks_calendar_events_order_idx" ON "_posts_v_blocks_calendar_events" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_calendar_events_parent_id_idx" ON "_posts_v_blocks_calendar_events" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_calendar_order_idx" ON "_posts_v_blocks_calendar" USING btree ("_order");
  CREATE INDEX "_posts_v_blocks_calendar_parent_id_idx" ON "_posts_v_blocks_calendar" USING btree ("_parent_id");
  CREATE INDEX "_posts_v_blocks_calendar_path_idx" ON "_posts_v_blocks_calendar" USING btree ("_path");
  CREATE INDEX "endeavors_holon_types_order_idx" ON "endeavors_holon_types" USING btree ("order");
  CREATE INDEX "endeavors_holon_types_parent_idx" ON "endeavors_holon_types" USING btree ("parent_id");
  CREATE INDEX "endeavors_beneficiaries_order_idx" ON "endeavors_beneficiaries" USING btree ("_order");
  CREATE INDEX "endeavors_beneficiaries_parent_id_idx" ON "endeavors_beneficiaries" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "endeavors_beneficiaries_claim_token_idx" ON "endeavors_beneficiaries" USING btree ("claim_token");
  CREATE INDEX "endeavors_beneficiaries_linked_user_idx" ON "endeavors_beneficiaries" USING btree ("linked_user_id");
  CREATE INDEX "connectors_tenant_idx" ON "connectors" USING btree ("tenant_id");
  CREATE INDEX "connectors_type_idx" ON "connectors" USING btree ("type");
  CREATE INDEX "connectors_space_idx" ON "connectors" USING btree ("space_id");
  CREATE INDEX "connectors_routing_channel_idx" ON "connectors" USING btree ("routing_channel_id");
  CREATE INDEX "connectors_system_user_idx" ON "connectors" USING btree ("system_user_id");
  CREATE INDEX "connectors_status_idx" ON "connectors" USING btree ("status");
  CREATE INDEX "connectors_updated_at_idx" ON "connectors" USING btree ("updated_at");
  CREATE INDEX "connectors_created_at_idx" ON "connectors" USING btree ("created_at");
  CREATE INDEX "federation_audit_log_action_idx" ON "federation_audit_log" USING btree ("action");
  CREATE INDEX "federation_audit_log_source_federation_id_idx" ON "federation_audit_log" USING btree ("source_federation_id");
  CREATE INDEX "federation_audit_log_updated_at_idx" ON "federation_audit_log" USING btree ("updated_at");
  CREATE INDEX "federation_audit_log_created_at_idx" ON "federation_audit_log" USING btree ("created_at");
  CREATE INDEX "agent_transactions_tenant_idx" ON "agent_transactions" USING btree ("tenant_id");
  CREATE INDEX "agent_transactions_type_idx" ON "agent_transactions" USING btree ("type");
  CREATE INDEX "agent_transactions_status_idx" ON "agent_transactions" USING btree ("status");
  CREATE INDEX "agent_transactions_updated_at_idx" ON "agent_transactions" USING btree ("updated_at");
  CREATE INDEX "agent_transactions_created_at_idx" ON "agent_transactions" USING btree ("created_at");
  CREATE INDEX "media_meta_tenant_idx" ON "media_meta" USING btree ("tenant_id");
  CREATE INDEX "media_meta_media_idx" ON "media_meta" USING btree ("media_id");
  CREATE INDEX "media_meta_source_message_idx" ON "media_meta" USING btree ("source_message_id");
  CREATE INDEX "media_meta_document_group_idx" ON "media_meta" USING btree ("document_group");
  CREATE INDEX "media_meta_updated_at_idx" ON "media_meta" USING btree ("updated_at");
  CREATE INDEX "media_meta_created_at_idx" ON "media_meta" USING btree ("created_at");
  CREATE INDEX "street_signs_tags_order_idx" ON "street_signs_tags" USING btree ("_order");
  CREATE INDEX "street_signs_tags_parent_id_idx" ON "street_signs_tags" USING btree ("_parent_id");
  CREATE INDEX "street_signs_holon_types_order_idx" ON "street_signs_holon_types" USING btree ("order");
  CREATE INDEX "street_signs_holon_types_parent_idx" ON "street_signs_holon_types" USING btree ("parent_id");
  CREATE INDEX "street_signs_tenant_idx" ON "street_signs" USING btree ("tenant_id");
  CREATE INDEX "street_signs_content_type_idx" ON "street_signs" USING btree ("content_type");
  CREATE INDEX "street_signs_thumbnail_idx" ON "street_signs" USING btree ("thumbnail_id");
  CREATE INDEX "street_signs_status_idx" ON "street_signs" USING btree ("status");
  CREATE INDEX "street_signs_updated_at_idx" ON "street_signs" USING btree ("updated_at");
  CREATE INDEX "street_signs_created_at_idx" ON "street_signs" USING btree ("created_at");
  CREATE INDEX "quests_objectives_order_idx" ON "quests_objectives" USING btree ("_order");
  CREATE INDEX "quests_objectives_parent_id_idx" ON "quests_objectives" USING btree ("_parent_id");
  CREATE INDEX "quests_evidence_requirements_order_idx" ON "quests_evidence_requirements" USING btree ("_order");
  CREATE INDEX "quests_evidence_requirements_parent_id_idx" ON "quests_evidence_requirements" USING btree ("_parent_id");
  CREATE INDEX "quests_tenant_idx" ON "quests" USING btree ("tenant_id");
  CREATE INDEX "quests_status_idx" ON "quests" USING btree ("status");
  CREATE INDEX "quests_featured_image_idx" ON "quests" USING btree ("featured_image_id");
  CREATE INDEX "quests_posted_by_idx" ON "quests" USING btree ("posted_by_id");
  CREATE INDEX "quests_updated_at_idx" ON "quests" USING btree ("updated_at");
  CREATE INDEX "quests_created_at_idx" ON "quests" USING btree ("created_at");
  CREATE INDEX "quests_rels_order_idx" ON "quests_rels" USING btree ("order");
  CREATE INDEX "quests_rels_parent_idx" ON "quests_rels" USING btree ("parent_id");
  CREATE INDEX "quests_rels_path_idx" ON "quests_rels" USING btree ("path");
  CREATE INDEX "quests_rels_categories_id_idx" ON "quests_rels" USING btree ("categories_id");
  CREATE INDEX "quest_participations_evidence_order_idx" ON "quest_participations_evidence" USING btree ("_order");
  CREATE INDEX "quest_participations_evidence_parent_id_idx" ON "quest_participations_evidence" USING btree ("_parent_id");
  CREATE INDEX "quest_participations_evidence_media_idx" ON "quest_participations_evidence" USING btree ("media_id");
  CREATE INDEX "quest_participations_tenant_idx" ON "quest_participations" USING btree ("tenant_id");
  CREATE INDEX "quest_participations_quest_idx" ON "quest_participations" USING btree ("quest_id");
  CREATE INDEX "quest_participations_participant_idx" ON "quest_participations" USING btree ("participant_id");
  CREATE INDEX "quest_participations_status_idx" ON "quest_participations" USING btree ("status");
  CREATE INDEX "quest_participations_reviewed_by_idx" ON "quest_participations" USING btree ("reviewed_by_id");
  CREATE INDEX "quest_participations_updated_at_idx" ON "quest_participations" USING btree ("updated_at");
  CREATE INDEX "quest_participations_created_at_idx" ON "quest_participations" USING btree ("created_at");
  CREATE INDEX "quest_participations_rels_order_idx" ON "quest_participations_rels" USING btree ("order");
  CREATE INDEX "quest_participations_rels_parent_idx" ON "quest_participations_rels" USING btree ("parent_id");
  CREATE INDEX "quest_participations_rels_path_idx" ON "quest_participations_rels" USING btree ("path");
  CREATE INDEX "quest_participations_rels_users_id_idx" ON "quest_participations_rels" USING btree ("users_id");
  CREATE INDEX "board_members_permissions_order_idx" ON "board_members_permissions" USING btree ("order");
  CREATE INDEX "board_members_permissions_parent_idx" ON "board_members_permissions" USING btree ("parent_id");
  CREATE INDEX "board_members_tenant_idx" ON "board_members" USING btree ("tenant_id");
  CREATE INDEX "board_members_user_idx" ON "board_members" USING btree ("user_id");
  CREATE INDEX "board_members_status_idx" ON "board_members" USING btree ("status");
  CREATE INDEX "board_members_updated_at_idx" ON "board_members" USING btree ("updated_at");
  CREATE INDEX "board_members_created_at_idx" ON "board_members" USING btree ("created_at");
  CREATE INDEX "logistics_nodes_compliance_certs_order_idx" ON "logistics_nodes_compliance_certs" USING btree ("_order");
  CREATE INDEX "logistics_nodes_compliance_certs_parent_id_idx" ON "logistics_nodes_compliance_certs" USING btree ("_parent_id");
  CREATE INDEX "logistics_nodes_compliance_certs_cert_doc_idx" ON "logistics_nodes_compliance_certs" USING btree ("cert_doc_id");
  CREATE INDEX "logistics_nodes_inventory_order_idx" ON "logistics_nodes_inventory" USING btree ("_order");
  CREATE INDEX "logistics_nodes_inventory_parent_id_idx" ON "logistics_nodes_inventory" USING btree ("_parent_id");
  CREATE INDEX "logistics_nodes_needs_order_idx" ON "logistics_nodes_needs" USING btree ("_order");
  CREATE INDEX "logistics_nodes_needs_parent_id_idx" ON "logistics_nodes_needs" USING btree ("_parent_id");
  CREATE INDEX "logistics_nodes_tenant_idx" ON "logistics_nodes" USING btree ("tenant_id");
  CREATE UNIQUE INDEX "logistics_nodes_handle_idx" ON "logistics_nodes" USING btree ("handle");
  CREATE INDEX "logistics_nodes_type_idx" ON "logistics_nodes" USING btree ("type");
  CREATE INDEX "logistics_nodes_insurance_policy_idx" ON "logistics_nodes" USING btree ("insurance_policy_id");
  CREATE INDEX "logistics_nodes_geohash_idx" ON "logistics_nodes" USING btree ("geohash");
  CREATE INDEX "logistics_nodes_status_idx" ON "logistics_nodes" USING btree ("status");
  CREATE INDEX "logistics_nodes_updated_at_idx" ON "logistics_nodes" USING btree ("updated_at");
  CREATE INDEX "logistics_nodes_created_at_idx" ON "logistics_nodes" USING btree ("created_at");
  CREATE INDEX "transports_special_capabilities_order_idx" ON "transports_special_capabilities" USING btree ("order");
  CREATE INDEX "transports_special_capabilities_parent_idx" ON "transports_special_capabilities" USING btree ("parent_id");
  CREATE INDEX "transports_tenant_idx" ON "transports" USING btree ("tenant_id");
  CREATE INDEX "transports_owner_idx" ON "transports" USING btree ("owner_id");
  CREATE INDEX "transports_status_idx" ON "transports" USING btree ("status");
  CREATE INDEX "transports_home_base_idx" ON "transports" USING btree ("home_base_id");
  CREATE INDEX "transports_active_shipment_idx" ON "transports" USING btree ("active_shipment_id");
  CREATE INDEX "transports_updated_at_idx" ON "transports" USING btree ("updated_at");
  CREATE INDEX "transports_created_at_idx" ON "transports" USING btree ("created_at");
  CREATE INDEX "shipments_manifest_order_idx" ON "shipments_manifest" USING btree ("_order");
  CREATE INDEX "shipments_manifest_parent_id_idx" ON "shipments_manifest" USING btree ("_parent_id");
  CREATE INDEX "shipments_tenant_idx" ON "shipments" USING btree ("tenant_id");
  CREATE UNIQUE INDEX "shipments_shipment_id_idx" ON "shipments" USING btree ("shipment_id");
  CREATE INDEX "shipments_origin_idx" ON "shipments" USING btree ("origin_id");
  CREATE INDEX "shipments_destination_idx" ON "shipments" USING btree ("destination_id");
  CREATE INDEX "shipments_priority_idx" ON "shipments" USING btree ("priority");
  CREATE INDEX "shipments_status_idx" ON "shipments" USING btree ("status");
  CREATE INDEX "shipments_assigned_transport_idx" ON "shipments" USING btree ("assigned_transport_id");
  CREATE INDEX "shipments_driver_idx" ON "shipments" USING btree ("driver_id");
  CREATE INDEX "shipments_proof_of_delivery_proof_of_delivery_photo_idx" ON "shipments" USING btree ("proof_of_delivery_photo_id");
  CREATE INDEX "shipments_requested_by_idx" ON "shipments" USING btree ("requested_by_id");
  CREATE INDEX "shipments_updated_at_idx" ON "shipments" USING btree ("updated_at");
  CREATE INDEX "shipments_created_at_idx" ON "shipments" USING btree ("created_at");
  CREATE INDEX "pheromones_tenant_idx" ON "pheromones" USING btree ("tenant_id");
  CREATE INDEX "pheromones_context_hash_idx" ON "pheromones" USING btree ("context_hash");
  CREATE INDEX "pheromones_path_idx" ON "pheromones" USING btree ("path");
  CREATE INDEX "pheromones_tool_name_idx" ON "pheromones" USING btree ("tool_name");
  CREATE INDEX "pheromones_last_traversed_at_idx" ON "pheromones" USING btree ("last_traversed_at");
  CREATE INDEX "pheromones_decay_idx" ON "pheromones" USING btree ("decay");
  CREATE INDEX "pheromones_updated_at_idx" ON "pheromones" USING btree ("updated_at");
  CREATE INDEX "pheromones_created_at_idx" ON "pheromones" USING btree ("created_at");
  CREATE INDEX "work_units_tenant_idx" ON "work_units" USING btree ("tenant_id");
  CREATE UNIQUE INDEX "work_units_work_unit_id_idx" ON "work_units" USING btree ("work_unit_id");
  CREATE INDEX "work_units_type_idx" ON "work_units" USING btree ("type");
  CREATE INDEX "work_units_status_idx" ON "work_units" USING btree ("status");
  CREATE INDEX "work_units_priority_idx" ON "work_units" USING btree ("priority");
  CREATE INDEX "work_units_assigned_node_idx" ON "work_units" USING btree ("assigned_node");
  CREATE INDEX "work_units_deadline_idx" ON "work_units" USING btree ("deadline");
  CREATE INDEX "work_units_origin_node_idx" ON "work_units" USING btree ("origin_node");
  CREATE INDEX "work_units_skill_name_idx" ON "work_units" USING btree ("skill_name");
  CREATE INDEX "work_units_parent_work_unit_id_idx" ON "work_units" USING btree ("parent_work_unit_id");
  CREATE INDEX "work_units_updated_at_idx" ON "work_units" USING btree ("updated_at");
  CREATE INDEX "work_units_created_at_idx" ON "work_units" USING btree ("created_at");
  CREATE INDEX "products_blocks_calendar_events_order_idx" ON "products_blocks_calendar_events" USING btree ("_order");
  CREATE INDEX "products_blocks_calendar_events_parent_id_idx" ON "products_blocks_calendar_events" USING btree ("_parent_id");
  CREATE INDEX "products_blocks_calendar_order_idx" ON "products_blocks_calendar" USING btree ("_order");
  CREATE INDEX "products_blocks_calendar_parent_id_idx" ON "products_blocks_calendar" USING btree ("_parent_id");
  CREATE INDEX "products_blocks_calendar_path_idx" ON "products_blocks_calendar" USING btree ("_path");
  CREATE INDEX "products_participants_order_idx" ON "products_participants" USING btree ("_order");
  CREATE INDEX "products_participants_parent_id_idx" ON "products_participants" USING btree ("_parent_id");
  CREATE INDEX "_products_v_blocks_calendar_events_order_idx" ON "_products_v_blocks_calendar_events" USING btree ("_order");
  CREATE INDEX "_products_v_blocks_calendar_events_parent_id_idx" ON "_products_v_blocks_calendar_events" USING btree ("_parent_id");
  CREATE INDEX "_products_v_blocks_calendar_order_idx" ON "_products_v_blocks_calendar" USING btree ("_order");
  CREATE INDEX "_products_v_blocks_calendar_parent_id_idx" ON "_products_v_blocks_calendar" USING btree ("_parent_id");
  CREATE INDEX "_products_v_blocks_calendar_path_idx" ON "_products_v_blocks_calendar" USING btree ("_path");
  CREATE INDEX "_products_v_version_participants_order_idx" ON "_products_v_version_participants" USING btree ("_order");
  CREATE INDEX "_products_v_version_participants_parent_id_idx" ON "_products_v_version_participants" USING btree ("_parent_id");
  ALTER TABLE "pages_rels" ADD CONSTRAINT "pages_rels_endeavors_fk" FOREIGN KEY ("endeavors_id") REFERENCES "public"."endeavors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_rels" ADD CONSTRAINT "_pages_v_rels_endeavors_fk" FOREIGN KEY ("endeavors_id") REFERENCES "public"."endeavors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "endeavors" ADD CONSTRAINT "endeavors_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_tenants_fk" FOREIGN KEY ("tenants_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_products_v_rels" ADD CONSTRAINT "_products_v_rels_tenants_fk" FOREIGN KEY ("tenants_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_connectors_fk" FOREIGN KEY ("connectors_id") REFERENCES "public"."connectors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_federation_audit_log_fk" FOREIGN KEY ("federation_audit_log_id") REFERENCES "public"."federation_audit_log"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_agent_transactions_fk" FOREIGN KEY ("agent_transactions_id") REFERENCES "public"."agent_transactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_meta_fk" FOREIGN KEY ("media_meta_id") REFERENCES "public"."media_meta"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_street_signs_fk" FOREIGN KEY ("street_signs_id") REFERENCES "public"."street_signs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quests_fk" FOREIGN KEY ("quests_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_quest_participations_fk" FOREIGN KEY ("quest_participations_id") REFERENCES "public"."quest_participations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_board_members_fk" FOREIGN KEY ("board_members_id") REFERENCES "public"."board_members"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_logistics_nodes_fk" FOREIGN KEY ("logistics_nodes_id") REFERENCES "public"."logistics_nodes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_transports_fk" FOREIGN KEY ("transports_id") REFERENCES "public"."transports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_shipments_fk" FOREIGN KEY ("shipments_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pheromones_fk" FOREIGN KEY ("pheromones_id") REFERENCES "public"."pheromones"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_work_units_fk" FOREIGN KEY ("work_units_id") REFERENCES "public"."work_units"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "tenants_type_idx" ON "tenants" USING btree ("type");
  CREATE INDEX "tenants_domain_idx" ON "tenants" USING btree ("domain");
  CREATE INDEX "tenants_status_idx" ON "tenants" USING btree ("status");
  CREATE INDEX "users_is_system_user_idx" ON "users" USING btree ("is_system_user");
  CREATE INDEX "tenant_memberships_status_idx" ON "tenant_memberships" USING btree ("status");
  CREATE INDEX "space_memberships_status_idx" ON "space_memberships" USING btree ("status");
  CREATE INDEX "channels_type_idx" ON "channels" USING btree ("type");
  CREATE INDEX "messages_channel_idx" ON "messages" USING btree ("channel");
  CREATE INDEX "messages_message_type_idx" ON "messages" USING btree ("message_type");
  CREATE INDEX "messages_status_idx" ON "messages" USING btree ("status");
  CREATE INDEX "bookings_status_idx" ON "bookings" USING btree ("status");
  CREATE INDEX "events_status_idx" ON "events" USING btree ("status");
  CREATE INDEX "event_registrations_email_idx" ON "event_registrations" USING btree ("email");
  CREATE INDEX "event_registrations_status_idx" ON "event_registrations" USING btree ("status");
  CREATE INDEX "pages_rels_endeavors_id_idx" ON "pages_rels" USING btree ("endeavors_id");
  CREATE INDEX "_pages_v_rels_endeavors_id_idx" ON "_pages_v_rels" USING btree ("endeavors_id");
  CREATE INDEX "posts_source_url_idx" ON "posts" USING btree ("source_url");
  CREATE INDEX "_posts_v_version_version_source_url_idx" ON "_posts_v" USING btree ("version_source_url");
  CREATE INDEX "comments_is_approved_idx" ON "comments" USING btree ("is_approved");
  CREATE INDEX "holon_capabilities_node_type_idx" ON "holon_capabilities" USING btree ("node_type");
  CREATE INDEX "holon_capabilities_accepting_orders_idx" ON "holon_capabilities" USING btree ("accepting_orders");
  CREATE INDEX "justice_fund_transactions_type_idx" ON "justice_fund_transactions" USING btree ("type");
  CREATE INDEX "justice_fund_transactions_status_idx" ON "justice_fund_transactions" USING btree ("status");
  CREATE INDEX "reviews_tenant_idx" ON "reviews" USING btree ("tenant_id");
  CREATE INDEX "reviews_source_idx" ON "reviews" USING btree ("source");
  CREATE INDEX "endeavors_tenant_idx" ON "endeavors" USING btree ("tenant_id");
  CREATE INDEX "endeavors_status_idx" ON "endeavors" USING btree ("status");
  CREATE INDEX "products_rels_users_id_idx" ON "products_rels" USING btree ("users_id");
  CREATE INDEX "products_rels_tenants_id_idx" ON "products_rels" USING btree ("tenants_id");
  CREATE INDEX "_products_v_rels_users_id_idx" ON "_products_v_rels" USING btree ("users_id");
  CREATE INDEX "_products_v_rels_tenants_id_idx" ON "_products_v_rels" USING btree ("tenants_id");
  CREATE UNIQUE INDEX "orders_fulfillment_angel_token_id_idx" ON "orders_fulfillment" USING btree ("angel_token_id");
  CREATE INDEX "payload_locked_documents_rels_connectors_id_idx" ON "payload_locked_documents_rels" USING btree ("connectors_id");
  CREATE INDEX "payload_locked_documents_rels_federation_audit_log_id_idx" ON "payload_locked_documents_rels" USING btree ("federation_audit_log_id");
  CREATE INDEX "payload_locked_documents_rels_agent_transactions_id_idx" ON "payload_locked_documents_rels" USING btree ("agent_transactions_id");
  CREATE INDEX "payload_locked_documents_rels_media_meta_id_idx" ON "payload_locked_documents_rels" USING btree ("media_meta_id");
  CREATE INDEX "payload_locked_documents_rels_street_signs_id_idx" ON "payload_locked_documents_rels" USING btree ("street_signs_id");
  CREATE INDEX "payload_locked_documents_rels_quests_id_idx" ON "payload_locked_documents_rels" USING btree ("quests_id");
  CREATE INDEX "payload_locked_documents_rels_quest_participations_id_idx" ON "payload_locked_documents_rels" USING btree ("quest_participations_id");
  CREATE INDEX "payload_locked_documents_rels_board_members_id_idx" ON "payload_locked_documents_rels" USING btree ("board_members_id");
  CREATE INDEX "payload_locked_documents_rels_logistics_nodes_id_idx" ON "payload_locked_documents_rels" USING btree ("logistics_nodes_id");
  CREATE INDEX "payload_locked_documents_rels_transports_id_idx" ON "payload_locked_documents_rels" USING btree ("transports_id");
  CREATE INDEX "payload_locked_documents_rels_shipments_id_idx" ON "payload_locked_documents_rels" USING btree ("shipments_id");
  CREATE INDEX "payload_locked_documents_rels_pheromones_id_idx" ON "payload_locked_documents_rels" USING btree ("pheromones_id");
  CREATE INDEX "payload_locked_documents_rels_work_units_id_idx" ON "payload_locked_documents_rels" USING btree ("work_units_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_social_providers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_calendar_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_calendar" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pages_blocks_featured_endeavors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_calendar_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_calendar" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_pages_v_blocks_featured_endeavors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_blocks_calendar_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_blocks_calendar" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_blocks_calendar_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_posts_v_blocks_calendar" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "endeavors_holon_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "endeavors_beneficiaries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "connectors" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "federation_audit_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "agent_transactions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "media_meta" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "street_signs_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "street_signs_holon_types" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "street_signs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quests_objectives" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quests_evidence_requirements" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quests" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quests_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quest_participations_evidence" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quest_participations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "quest_participations_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "board_members_permissions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "board_members" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "logistics_nodes_compliance_certs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "logistics_nodes_inventory" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "logistics_nodes_needs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "logistics_nodes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "transports_special_capabilities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "transports" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "shipments_manifest" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "shipments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "pheromones" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "work_units" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_blocks_calendar_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_blocks_calendar" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_participants" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_products_v_blocks_calendar_events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_products_v_blocks_calendar" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_products_v_version_participants" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_social_providers" CASCADE;
  DROP TABLE "pages_blocks_calendar_events" CASCADE;
  DROP TABLE "pages_blocks_calendar" CASCADE;
  DROP TABLE "pages_blocks_featured_endeavors" CASCADE;
  DROP TABLE "_pages_v_blocks_calendar_events" CASCADE;
  DROP TABLE "_pages_v_blocks_calendar" CASCADE;
  DROP TABLE "_pages_v_blocks_featured_endeavors" CASCADE;
  DROP TABLE "posts_blocks_calendar_events" CASCADE;
  DROP TABLE "posts_blocks_calendar" CASCADE;
  DROP TABLE "_posts_v_blocks_calendar_events" CASCADE;
  DROP TABLE "_posts_v_blocks_calendar" CASCADE;
  DROP TABLE "endeavors_holon_types" CASCADE;
  DROP TABLE "endeavors_beneficiaries" CASCADE;
  DROP TABLE "connectors" CASCADE;
  DROP TABLE "federation_audit_log" CASCADE;
  DROP TABLE "agent_transactions" CASCADE;
  DROP TABLE "media_meta" CASCADE;
  DROP TABLE "street_signs_tags" CASCADE;
  DROP TABLE "street_signs_holon_types" CASCADE;
  DROP TABLE "street_signs" CASCADE;
  DROP TABLE "quests_objectives" CASCADE;
  DROP TABLE "quests_evidence_requirements" CASCADE;
  DROP TABLE "quests" CASCADE;
  DROP TABLE "quests_rels" CASCADE;
  DROP TABLE "quest_participations_evidence" CASCADE;
  DROP TABLE "quest_participations" CASCADE;
  DROP TABLE "quest_participations_rels" CASCADE;
  DROP TABLE "board_members_permissions" CASCADE;
  DROP TABLE "board_members" CASCADE;
  DROP TABLE "logistics_nodes_compliance_certs" CASCADE;
  DROP TABLE "logistics_nodes_inventory" CASCADE;
  DROP TABLE "logistics_nodes_needs" CASCADE;
  DROP TABLE "logistics_nodes" CASCADE;
  DROP TABLE "transports_special_capabilities" CASCADE;
  DROP TABLE "transports" CASCADE;
  DROP TABLE "shipments_manifest" CASCADE;
  DROP TABLE "shipments" CASCADE;
  DROP TABLE "pheromones" CASCADE;
  DROP TABLE "work_units" CASCADE;
  DROP TABLE "products_blocks_calendar_events" CASCADE;
  DROP TABLE "products_blocks_calendar" CASCADE;
  DROP TABLE "products_participants" CASCADE;
  DROP TABLE "_products_v_blocks_calendar_events" CASCADE;
  DROP TABLE "_products_v_blocks_calendar" CASCADE;
  DROP TABLE "_products_v_version_participants" CASCADE;
  ALTER TABLE "pages_rels" DROP CONSTRAINT "pages_rels_endeavors_fk";
  
  ALTER TABLE "_pages_v_rels" DROP CONSTRAINT "_pages_v_rels_endeavors_fk";
  
  ALTER TABLE "reviews" DROP CONSTRAINT "reviews_tenant_id_tenants_id_fk";
  
  ALTER TABLE "endeavors" DROP CONSTRAINT "endeavors_tenant_id_tenants_id_fk";
  
  ALTER TABLE "products_rels" DROP CONSTRAINT "products_rels_users_fk";
  
  ALTER TABLE "products_rels" DROP CONSTRAINT "products_rels_tenants_fk";
  
  ALTER TABLE "_products_v_rels" DROP CONSTRAINT "_products_v_rels_users_fk";
  
  ALTER TABLE "_products_v_rels" DROP CONSTRAINT "_products_v_rels_tenants_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_connectors_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_federation_audit_log_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_agent_transactions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_media_meta_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_street_signs_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_quests_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_quest_participations_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_board_members_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_logistics_nodes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_transports_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_shipments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_pheromones_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_work_units_fk";
  
  ALTER TABLE "tenants" ALTER COLUMN "business_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_tenants_business_type";
  CREATE TYPE "public"."enum_tenants_business_type" AS ENUM('retail', 'service', 'content_creator', 'nonprofit', 'professional_services', 'custom');
  ALTER TABLE "tenants" ALTER COLUMN "business_type" SET DATA TYPE "public"."enum_tenants_business_type" USING "business_type"::"public"."enum_tenants_business_type";
  ALTER TABLE "channels" ALTER COLUMN "type" SET DATA TYPE text;
  ALTER TABLE "channels" ALTER COLUMN "type" SET DEFAULT 'general'::text;
  DROP TYPE "public"."enum_channels_type";
  CREATE TYPE "public"."enum_channels_type" AS ENUM('general', 'announcements', 'support', 'sales', 'inventory', 'pdf', 'video', 'team', 'social', 'dm');
  ALTER TABLE "channels" ALTER COLUMN "type" SET DEFAULT 'general'::"public"."enum_channels_type";
  ALTER TABLE "channels" ALTER COLUMN "type" SET DATA TYPE "public"."enum_channels_type" USING "type"::"public"."enum_channels_type";
  ALTER TABLE "channels" ALTER COLUMN "source" SET DATA TYPE text;
  ALTER TABLE "channels" ALTER COLUMN "source" SET DEFAULT 'native'::text;
  DROP TYPE "public"."enum_channels_source";
  CREATE TYPE "public"."enum_channels_source" AS ENUM('native', 'whatsapp', 'email', 'google_chat', 'sms');
  ALTER TABLE "channels" ALTER COLUMN "source" SET DEFAULT 'native'::"public"."enum_channels_source";
  ALTER TABLE "channels" ALTER COLUMN "source" SET DATA TYPE "public"."enum_channels_source" USING "source"::"public"."enum_channels_source";
  ALTER TABLE "messages" ALTER COLUMN "message_type" SET DATA TYPE text;
  ALTER TABLE "messages" ALTER COLUMN "message_type" SET DEFAULT 'user'::text;
  DROP TYPE "public"."enum_messages_message_type";
  CREATE TYPE "public"."enum_messages_message_type" AS ENUM('user', 'system', 'announcement', 'ai_agent', 'inventory', 'pdf', 'video', 'booking', 'form_submission', 'transaction', 'widget', 'ethical_assessment');
  ALTER TABLE "messages" ALTER COLUMN "message_type" SET DEFAULT 'user'::"public"."enum_messages_message_type";
  ALTER TABLE "messages" ALTER COLUMN "message_type" SET DATA TYPE "public"."enum_messages_message_type" USING "message_type"::"public"."enum_messages_message_type";
  ALTER TABLE "orders_fulfillment" ALTER COLUMN "fulfillment_status" SET DATA TYPE text;
  ALTER TABLE "orders_fulfillment" ALTER COLUMN "fulfillment_status" SET DEFAULT 'pending_match'::text;
  DROP TYPE "public"."enum_orders_fulfillment_fulfillment_status";
  CREATE TYPE "public"."enum_orders_fulfillment_fulfillment_status" AS ENUM('pending_match', 'matched', 'accepted', 'in_production', 'shipped', 'delivered', 'rejected');
  ALTER TABLE "orders_fulfillment" ALTER COLUMN "fulfillment_status" SET DEFAULT 'pending_match'::"public"."enum_orders_fulfillment_fulfillment_status";
  ALTER TABLE "orders_fulfillment" ALTER COLUMN "fulfillment_status" SET DATA TYPE "public"."enum_orders_fulfillment_fulfillment_status" USING "fulfillment_status"::"public"."enum_orders_fulfillment_fulfillment_status";
  DROP INDEX "tenants_type_idx";
  DROP INDEX "tenants_domain_idx";
  DROP INDEX "tenants_status_idx";
  DROP INDEX "users_is_system_user_idx";
  DROP INDEX "tenant_memberships_status_idx";
  DROP INDEX "space_memberships_status_idx";
  DROP INDEX "channels_type_idx";
  DROP INDEX "messages_channel_idx";
  DROP INDEX "messages_message_type_idx";
  DROP INDEX "messages_status_idx";
  DROP INDEX "bookings_status_idx";
  DROP INDEX "events_status_idx";
  DROP INDEX "event_registrations_email_idx";
  DROP INDEX "event_registrations_status_idx";
  DROP INDEX "pages_rels_endeavors_id_idx";
  DROP INDEX "_pages_v_rels_endeavors_id_idx";
  DROP INDEX "posts_source_url_idx";
  DROP INDEX "_posts_v_version_version_source_url_idx";
  DROP INDEX "comments_is_approved_idx";
  DROP INDEX "holon_capabilities_node_type_idx";
  DROP INDEX "holon_capabilities_accepting_orders_idx";
  DROP INDEX "justice_fund_transactions_type_idx";
  DROP INDEX "justice_fund_transactions_status_idx";
  DROP INDEX "reviews_tenant_idx";
  DROP INDEX "reviews_source_idx";
  DROP INDEX "endeavors_tenant_idx";
  DROP INDEX "endeavors_status_idx";
  DROP INDEX "products_rels_users_id_idx";
  DROP INDEX "products_rels_tenants_id_idx";
  DROP INDEX "_products_v_rels_users_id_idx";
  DROP INDEX "_products_v_rels_tenants_id_idx";
  DROP INDEX "orders_fulfillment_angel_token_id_idx";
  DROP INDEX "payload_locked_documents_rels_connectors_id_idx";
  DROP INDEX "payload_locked_documents_rels_federation_audit_log_id_idx";
  DROP INDEX "payload_locked_documents_rels_agent_transactions_id_idx";
  DROP INDEX "payload_locked_documents_rels_media_meta_id_idx";
  DROP INDEX "payload_locked_documents_rels_street_signs_id_idx";
  DROP INDEX "payload_locked_documents_rels_quests_id_idx";
  DROP INDEX "payload_locked_documents_rels_quest_participations_id_idx";
  DROP INDEX "payload_locked_documents_rels_board_members_id_idx";
  DROP INDEX "payload_locked_documents_rels_logistics_nodes_id_idx";
  DROP INDEX "payload_locked_documents_rels_transports_id_idx";
  DROP INDEX "payload_locked_documents_rels_shipments_id_idx";
  DROP INDEX "payload_locked_documents_rels_pheromones_id_idx";
  DROP INDEX "payload_locked_documents_rels_work_units_id_idx";
  ALTER TABLE "tenants" DROP COLUMN "vapi_enabled";
  ALTER TABLE "tenants" DROP COLUMN "vapi_phone_number";
  ALTER TABLE "tenants" DROP COLUMN "vapi_assistant_id";
  ALTER TABLE "tenants" DROP COLUMN "vapi_voice_id";
  ALTER TABLE "tenants" DROP COLUMN "vapi_greeting";
  ALTER TABLE "tenants" DROP COLUMN "agent_wallet_enabled";
  ALTER TABLE "tenants" DROP COLUMN "agent_wallet_monthly_budget_cents";
  ALTER TABLE "tenants" DROP COLUMN "agent_wallet_spent_this_month_cents";
  ALTER TABLE "tenants" DROP COLUMN "agent_wallet_lifetime_spent_cents";
  ALTER TABLE "tenants" DROP COLUMN "agent_wallet_lifetime_earned_cents";
  ALTER TABLE "tenants" DROP COLUMN "agent_wallet_last_reset_at";
  ALTER TABLE "tenants" DROP COLUMN "agent_wallet_spending_rules";
  ALTER TABLE "tenants" DROP COLUMN "bootstrap_fees_tier";
  ALTER TABLE "tenants" DROP COLUMN "bootstrap_fees_free_transactions_used";
  ALTER TABLE "tenants" DROP COLUMN "bootstrap_fees_free_transaction_limit";
  ALTER TABLE "tenants" DROP COLUMN "bootstrap_fees_free_gmv_cents";
  ALTER TABLE "tenants" DROP COLUMN "bootstrap_fees_free_gmv_limit_cents";
  ALTER TABLE "tenants" DROP COLUMN "bootstrap_fees_bootstrap_fee_percent";
  ALTER TABLE "tenants" DROP COLUMN "bootstrap_fees_total_fees_collected_cents";
  ALTER TABLE "tenants" DROP COLUMN "bootstrap_fees_refund_promised";
  ALTER TABLE "tenants" DROP COLUMN "bootstrap_fees_refund_status";
  ALTER TABLE "tenants" DROP COLUMN "bootstrap_fees_bootstrap_started_at";
  ALTER TABLE "tenants" DROP COLUMN "bootstrap_fees_bootstrap_ended_at";
  ALTER TABLE "bookings" DROP COLUMN "cancellation_reason";
  ALTER TABLE "bookings" DROP COLUMN "cancellation_cancelled_by";
  ALTER TABLE "bookings" DROP COLUMN "cancellation_cancelled_at";
  ALTER TABLE "bookings" DROP COLUMN "rescheduling_rescheduled_from";
  ALTER TABLE "bookings" DROP COLUMN "rescheduling_reschedule_count";
  ALTER TABLE "header" DROP COLUMN "label";
  ALTER TABLE "footer" DROP COLUMN "label";
  ALTER TABLE "pages_rels" DROP COLUMN "endeavors_id";
  ALTER TABLE "_pages_v_rels" DROP COLUMN "endeavors_id";
  ALTER TABLE "posts" DROP COLUMN "source_url";
  ALTER TABLE "posts" DROP COLUMN "source_type";
  ALTER TABLE "_posts_v" DROP COLUMN "version_source_url";
  ALTER TABLE "_posts_v" DROP COLUMN "version_source_type";
  ALTER TABLE "reviews" DROP COLUMN "tenant_id";
  ALTER TABLE "endeavors" DROP COLUMN "tenant_id";
  ALTER TABLE "endeavors" DROP COLUMN "mission_statement";
  ALTER TABLE "products_required_capabilities" DROP COLUMN "equipment";
  ALTER TABLE "products" DROP COLUMN "low_stock_threshold";
  ALTER TABLE "products_rels" DROP COLUMN "users_id";
  ALTER TABLE "products_rels" DROP COLUMN "tenants_id";
  ALTER TABLE "_products_v_version_required_capabilities" DROP COLUMN "equipment";
  ALTER TABLE "_products_v" DROP COLUMN "version_low_stock_threshold";
  ALTER TABLE "_products_v_rels" DROP COLUMN "users_id";
  ALTER TABLE "_products_v_rels" DROP COLUMN "tenants_id";
  ALTER TABLE "orders_fulfillment" DROP COLUMN "angel_token_id";
  ALTER TABLE "orders_fulfillment" DROP COLUMN "token_status";
  ALTER TABLE "orders_fulfillment" DROP COLUMN "queued_at";
  ALTER TABLE "orders_fulfillment" DROP COLUMN "queue_reason";
  ALTER TABLE "orders_fulfillment" DROP COLUMN "customer_notified_at";
  ALTER TABLE "orders_fulfillment" DROP COLUMN "selected_configuration";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "connectors_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "federation_audit_log_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "agent_transactions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "media_meta_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "street_signs_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "quests_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "quest_participations_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "board_members_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "logistics_nodes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "transports_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "shipments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "pheromones_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "work_units_id";
  DROP TYPE "public"."enum_tenants_bootstrap_fees_tier";
  DROP TYPE "public"."enum_tenants_bootstrap_fees_refund_status";
  DROP TYPE "public"."enum_users_social_providers_provider";
  DROP TYPE "public"."enum_bookings_cancellation_cancelled_by";
  DROP TYPE "public"."enum_pages_blocks_calendar_source_type";
  DROP TYPE "public"."enum_pages_blocks_calendar_default_view";
  DROP TYPE "public"."enum_pages_blocks_featured_endeavors_source";
  DROP TYPE "public"."enum_pages_blocks_featured_endeavors_layout";
  DROP TYPE "public"."enum__pages_v_blocks_calendar_source_type";
  DROP TYPE "public"."enum__pages_v_blocks_calendar_default_view";
  DROP TYPE "public"."enum__pages_v_blocks_featured_endeavors_source";
  DROP TYPE "public"."enum__pages_v_blocks_featured_endeavors_layout";
  DROP TYPE "public"."enum_posts_blocks_calendar_source_type";
  DROP TYPE "public"."enum_posts_blocks_calendar_default_view";
  DROP TYPE "public"."enum_posts_source_type";
  DROP TYPE "public"."enum__posts_v_blocks_calendar_source_type";
  DROP TYPE "public"."enum__posts_v_blocks_calendar_default_view";
  DROP TYPE "public"."enum__posts_v_version_source_type";
  DROP TYPE "public"."enum_endeavors_holon_types";
  DROP TYPE "public"."enum_endeavors_beneficiaries_verification_status";
  DROP TYPE "public"."enum_connectors_type";
  DROP TYPE "public"."enum_connectors_status";
  DROP TYPE "public"."enum_federation_audit_log_action";
  DROP TYPE "public"."enum_federation_audit_log_direction";
  DROP TYPE "public"."enum_federation_audit_log_trust_level";
  DROP TYPE "public"."enum_agent_transactions_type";
  DROP TYPE "public"."enum_agent_transactions_skill_category";
  DROP TYPE "public"."enum_agent_transactions_status";
  DROP TYPE "public"."enum_media_meta_status";
  DROP TYPE "public"."enum_media_meta_extraction_type";
  DROP TYPE "public"."enum_street_signs_holon_types";
  DROP TYPE "public"."enum_street_signs_content_type";
  DROP TYPE "public"."enum_street_signs_status";
  DROP TYPE "public"."enum_quests_objectives_verification_method";
  DROP TYPE "public"."enum_quests_evidence_requirements_type";
  DROP TYPE "public"."enum_quests_status";
  DROP TYPE "public"."enum_quests_payout_type";
  DROP TYPE "public"."enum_quests_payout_payment_method";
  DROP TYPE "public"."enum_quests_difficulty";
  DROP TYPE "public"."enum_quest_participations_evidence_type";
  DROP TYPE "public"."enum_quest_participations_status";
  DROP TYPE "public"."enum_quest_participations_payout_status";
  DROP TYPE "public"."enum_board_members_permissions";
  DROP TYPE "public"."enum_board_members_role";
  DROP TYPE "public"."enum_board_members_term";
  DROP TYPE "public"."enum_board_members_status";
  DROP TYPE "public"."enum_logistics_nodes_inventory_category";
  DROP TYPE "public"."enum_logistics_nodes_needs_category";
  DROP TYPE "public"."enum_logistics_nodes_needs_urgency";
  DROP TYPE "public"."enum_logistics_nodes_type";
  DROP TYPE "public"."enum_logistics_nodes_governance_mode";
  DROP TYPE "public"."enum_logistics_nodes_status";
  DROP TYPE "public"."enum_transports_special_capabilities";
  DROP TYPE "public"."enum_transports_transport_type";
  DROP TYPE "public"."enum_transports_status";
  DROP TYPE "public"."enum_shipments_manifest_category";
  DROP TYPE "public"."enum_shipments_priority";
  DROP TYPE "public"."enum_shipments_status";
  DROP TYPE "public"."enum_shipments_match_type";
  DROP TYPE "public"."enum_work_units_type";
  DROP TYPE "public"."enum_work_units_status";
  DROP TYPE "public"."enum_work_units_priority";
  DROP TYPE "public"."enum_work_units_requirements_compute_class";
  DROP TYPE "public"."enum_work_units_requirements_min_trust_level";
  DROP TYPE "public"."enum_products_blocks_calendar_source_type";
  DROP TYPE "public"."enum_products_blocks_calendar_default_view";
  DROP TYPE "public"."enum_products_participants_role";
  DROP TYPE "public"."enum__products_v_blocks_calendar_source_type";
  DROP TYPE "public"."enum__products_v_blocks_calendar_default_view";
  DROP TYPE "public"."enum__products_v_version_participants_role";
  DROP TYPE "public"."enum_orders_fulfillment_token_status";`)
}
