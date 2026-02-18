-- Migration: Add Events + EventRegistrations tables
-- Run directly against production Postgres

-- Create enum types (IF NOT EXISTS pattern via DO blocks)
DO $$ BEGIN
  CREATE TYPE "public"."enum_events_event_type" AS ENUM('meetup', 'workshop', 'livestream', 'conference', 'screening', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."enum_events_status" AS ENUM('draft', 'upcoming', 'live', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."enum_events_location_type" AS ENUM('in-person', 'virtual', 'hybrid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."enum_events_location_remote_platform" AS ENUM('zoom', 'google-meet', 'angelos-live', 'youtube-live', 'twitch', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."enum_events_pricing_currency" AS ENUM('usd', 'eur');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."enum_event_registrations_status" AS ENUM('registered', 'waitlisted', 'checked-in', 'cancelled', 'no-show');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."enum_event_registrations_registration_type" AS ENUM('pre-event', 'at-event', 'post-event');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."enum_event_registrations_attendance_mode" AS ENUM('in-person', 'virtual', 'replay');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- events_tags table
CREATE TABLE IF NOT EXISTS "events_tags" (
  "_order" integer NOT NULL,
  "_parent_id" integer NOT NULL,
  "id" varchar PRIMARY KEY NOT NULL,
  "tag" varchar NOT NULL
);

-- events table
CREATE TABLE IF NOT EXISTS "events" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer,
  "title" varchar NOT NULL,
  "slug" varchar,
  "description" jsonb,
  "event_type" "enum_events_event_type" DEFAULT 'meetup' NOT NULL,
  "status" "enum_events_status" DEFAULT 'draft' NOT NULL,
  "cover_image_id" integer,
  "host_id" integer NOT NULL,
  "start_date_time" timestamp(3) with time zone NOT NULL,
  "end_date_time" timestamp(3) with time zone,
  "duration" numeric DEFAULT 60,
  "timezone" varchar,
  "location_type" "enum_events_location_type" DEFAULT 'in-person' NOT NULL,
  "location_venue_name" varchar,
  "location_address" varchar,
  "location_remote_link" varchar,
  "location_remote_platform" "enum_events_location_remote_platform",
  "capacity_max_attendees" numeric DEFAULT 0,
  "capacity_waitlist_enabled" boolean DEFAULT false,
  "registration_is_open" boolean DEFAULT true,
  "registration_requires_approval" boolean DEFAULT false,
  "registration_registration_deadline" timestamp(3) with time zone,
  "registration_allow_late_registration" boolean DEFAULT true,
  "pricing_is_free" boolean DEFAULT true,
  "pricing_amount" numeric,
  "pricing_currency" "enum_events_pricing_currency" DEFAULT 'usd',
  "pricing_split_configuration_provider_share" numeric DEFAULT 60,
  "pricing_split_configuration_platform_share" numeric DEFAULT 20,
  "pricing_split_configuration_operations_share" numeric DEFAULT 15,
  "pricing_split_configuration_justice_share" numeric DEFAULT 5,
  "announce_to_a_i_bus" boolean DEFAULT true,
  "space_id" integer,
  "metadata" jsonb,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

-- event_registrations table
CREATE TABLE IF NOT EXISTS "event_registrations" (
  "id" serial PRIMARY KEY NOT NULL,
  "tenant_id" integer,
  "event_id" integer NOT NULL,
  "attendee_id" integer,
  "name" varchar,
  "email" varchar,
  "status" "enum_event_registrations_status" DEFAULT 'registered' NOT NULL,
  "registration_type" "enum_event_registrations_registration_type" DEFAULT 'pre-event' NOT NULL,
  "attendance_mode" "enum_event_registrations_attendance_mode" DEFAULT 'in-person' NOT NULL,
  "checked_in_at" timestamp(3) with time zone,
  "notes" varchar,
  "metadata" jsonb,
  "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);

-- Add columns to payload_locked_documents_rels (if not already there)
DO $$ BEGIN
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "events_id" integer;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "event_registrations_id" integer;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Foreign keys (idempotent via IF NOT EXISTS pattern)
DO $$ BEGIN
  ALTER TABLE "events_tags" ADD CONSTRAINT "events_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "events" ADD CONSTRAINT "events_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "events" ADD CONSTRAINT "events_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "events" ADD CONSTRAINT "events_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_attendee_id_users_id_fk" FOREIGN KEY ("attendee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_event_registrations_fk" FOREIGN KEY ("event_registrations_id") REFERENCES "public"."event_registrations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS "events_tags_order_idx" ON "events_tags" USING btree ("_order");
CREATE INDEX IF NOT EXISTS "events_tags_parent_id_idx" ON "events_tags" USING btree ("_parent_id");
CREATE INDEX IF NOT EXISTS "events_tenant_idx" ON "events" USING btree ("tenant_id");
CREATE UNIQUE INDEX IF NOT EXISTS "events_slug_idx" ON "events" USING btree ("slug");
CREATE INDEX IF NOT EXISTS "events_cover_image_idx" ON "events" USING btree ("cover_image_id");
CREATE INDEX IF NOT EXISTS "events_host_idx" ON "events" USING btree ("host_id");
CREATE INDEX IF NOT EXISTS "events_space_idx" ON "events" USING btree ("space_id");
CREATE INDEX IF NOT EXISTS "events_updated_at_idx" ON "events" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "events_created_at_idx" ON "events" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "event_registrations_tenant_idx" ON "event_registrations" USING btree ("tenant_id");
CREATE INDEX IF NOT EXISTS "event_registrations_event_idx" ON "event_registrations" USING btree ("event_id");
CREATE INDEX IF NOT EXISTS "event_registrations_attendee_idx" ON "event_registrations" USING btree ("attendee_id");
CREATE INDEX IF NOT EXISTS "event_registrations_updated_at_idx" ON "event_registrations" USING btree ("updated_at");
CREATE INDEX IF NOT EXISTS "event_registrations_created_at_idx" ON "event_registrations" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");
CREATE INDEX IF NOT EXISTS "payload_locked_documents_rels_event_registrations_id_idx" ON "payload_locked_documents_rels" USING btree ("event_registrations_id");
