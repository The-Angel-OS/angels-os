import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_events_event_type" AS ENUM('meetup', 'workshop', 'livestream', 'conference', 'screening', 'custom');
  CREATE TYPE "public"."enum_events_status" AS ENUM('draft', 'upcoming', 'live', 'completed', 'cancelled');
  CREATE TYPE "public"."enum_events_location_type" AS ENUM('in-person', 'virtual', 'hybrid');
  CREATE TYPE "public"."enum_events_location_remote_platform" AS ENUM('zoom', 'google-meet', 'angelos-live', 'youtube-live', 'twitch', 'custom');
  CREATE TYPE "public"."enum_events_pricing_currency" AS ENUM('usd', 'eur');
  CREATE TYPE "public"."enum_event_registrations_status" AS ENUM('registered', 'waitlisted', 'checked-in', 'cancelled', 'no-show');
  CREATE TYPE "public"."enum_event_registrations_registration_type" AS ENUM('pre-event', 'at-event', 'post-event');
  CREATE TYPE "public"."enum_event_registrations_attendance_mode" AS ENUM('in-person', 'virtual', 'replay');
  ALTER TYPE "public"."enum_users_agent_config_agent_type" ADD VALUE 'angelclaw' BEFORE 'custom';
  CREATE TABLE "events_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar NOT NULL
  );
  
  CREATE TABLE "events" (
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
  
  CREATE TABLE "event_registrations" (
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
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "events_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "event_registrations_id" integer;
  ALTER TABLE "events_tags" ADD CONSTRAINT "events_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "event_registrations" ADD CONSTRAINT "event_registrations_attendee_id_users_id_fk" FOREIGN KEY ("attendee_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "events_tags_order_idx" ON "events_tags" USING btree ("_order");
  CREATE INDEX "events_tags_parent_id_idx" ON "events_tags" USING btree ("_parent_id");
  CREATE INDEX "events_tenant_idx" ON "events" USING btree ("tenant_id");
  CREATE UNIQUE INDEX "events_slug_idx" ON "events" USING btree ("slug");
  CREATE INDEX "events_cover_image_idx" ON "events" USING btree ("cover_image_id");
  CREATE INDEX "events_host_idx" ON "events" USING btree ("host_id");
  CREATE INDEX "events_space_idx" ON "events" USING btree ("space_id");
  CREATE INDEX "events_updated_at_idx" ON "events" USING btree ("updated_at");
  CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");
  CREATE INDEX "event_registrations_tenant_idx" ON "event_registrations" USING btree ("tenant_id");
  CREATE INDEX "event_registrations_event_idx" ON "event_registrations" USING btree ("event_id");
  CREATE INDEX "event_registrations_attendee_idx" ON "event_registrations" USING btree ("attendee_id");
  CREATE INDEX "event_registrations_updated_at_idx" ON "event_registrations" USING btree ("updated_at");
  CREATE INDEX "event_registrations_created_at_idx" ON "event_registrations" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_event_registrations_fk" FOREIGN KEY ("event_registrations_id") REFERENCES "public"."event_registrations"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");
  CREATE INDEX "payload_locked_documents_rels_event_registrations_id_idx" ON "payload_locked_documents_rels" USING btree ("event_registrations_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "events_tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "event_registrations" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "events_tags" CASCADE;
  DROP TABLE "events" CASCADE;
  DROP TABLE "event_registrations" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_events_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_event_registrations_fk";
  
  ALTER TABLE "users" ALTER COLUMN "agent_config_agent_type" SET DATA TYPE text;
  ALTER TABLE "users" ALTER COLUMN "agent_config_agent_type" SET DEFAULT 'leo'::text;
  DROP TYPE "public"."enum_users_agent_config_agent_type";
  CREATE TYPE "public"."enum_users_agent_config_agent_type" AS ENUM('leo', 'support', 'sales', 'onboarding', 'integration', 'custom');
  ALTER TABLE "users" ALTER COLUMN "agent_config_agent_type" SET DEFAULT 'leo'::"public"."enum_users_agent_config_agent_type";
  ALTER TABLE "users" ALTER COLUMN "agent_config_agent_type" SET DATA TYPE "public"."enum_users_agent_config_agent_type" USING "agent_config_agent_type"::"public"."enum_users_agent_config_agent_type";
  DROP INDEX "payload_locked_documents_rels_events_id_idx";
  DROP INDEX "payload_locked_documents_rels_event_registrations_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "events_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "event_registrations_id";
  DROP TYPE "public"."enum_events_event_type";
  DROP TYPE "public"."enum_events_status";
  DROP TYPE "public"."enum_events_location_type";
  DROP TYPE "public"."enum_events_location_remote_platform";
  DROP TYPE "public"."enum_events_pricing_currency";
  DROP TYPE "public"."enum_event_registrations_status";
  DROP TYPE "public"."enum_event_registrations_registration_type";
  DROP TYPE "public"."enum_event_registrations_attendance_mode";`)
}
