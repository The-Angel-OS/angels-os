import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_endeavors_endeavor_type" AS ENUM('service-provider', 'retail-commerce', 'creator-content', 'booking-based', 'custom');
  CREATE TYPE "public"."enum_endeavors_status" AS ENUM('forming', 'active', 'suspended', 'retired');
  CREATE TYPE "public"."enum_endeavors_federation_ministry_status" AS ENUM('applicant', 'probation', 'active', 'suspended');
  CREATE TABLE "endeavors_capabilities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"skill" varchar NOT NULL,
  	"description" varchar
  );
  
  CREATE TABLE "endeavors" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"tagline" varchar,
  	"description" varchar,
  	"endeavor_type" "enum_endeavors_endeavor_type" NOT NULL,
  	"status" "enum_endeavors_status" DEFAULT 'forming' NOT NULL,
  	"primary_space_id" integer,
  	"operator_name" varchar,
  	"operator_email" varchar,
  	"operator_role" varchar,
  	"federation_network_visible" boolean DEFAULT false,
  	"federation_ministry_status" "enum_endeavors_federation_ministry_status" DEFAULT 'applicant',
  	"federation_constitution_version" varchar DEFAULT '1.1',
  	"federation_constitution_signed_at" timestamp(3) with time zone,
  	"federation_constitution_signature" varchar,
  	"federation_federation_id" varchar,
  	"federation_last_ping_at" timestamp(3) with time zone,
  	"logo_id" integer,
  	"cover_image_id" integer,
  	"region_city" varchar,
  	"region_state" varchar,
  	"region_country" varchar DEFAULT 'US',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "tenants" ADD COLUMN "setup_wizard_complete" boolean DEFAULT false;
  ALTER TABLE "tenants" ADD COLUMN "setup_wizard_progress" jsonb;
  ALTER TABLE "tenants" ADD COLUMN "setup_constitution_signed_at" timestamp(3) with time zone;
  ALTER TABLE "tenants" ADD COLUMN "setup_constitution_signature" varchar;
  ALTER TABLE "tenants" ADD COLUMN "setup_federation_id" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "endeavors_id" integer;
  ALTER TABLE "endeavors_capabilities" ADD CONSTRAINT "endeavors_capabilities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."endeavors"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "endeavors" ADD CONSTRAINT "endeavors_primary_space_id_spaces_id_fk" FOREIGN KEY ("primary_space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "endeavors" ADD CONSTRAINT "endeavors_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "endeavors" ADD CONSTRAINT "endeavors_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "endeavors_capabilities_order_idx" ON "endeavors_capabilities" USING btree ("_order");
  CREATE INDEX "endeavors_capabilities_parent_id_idx" ON "endeavors_capabilities" USING btree ("_parent_id");
  CREATE INDEX "endeavors_primary_space_idx" ON "endeavors" USING btree ("primary_space_id");
  CREATE INDEX "endeavors_logo_idx" ON "endeavors" USING btree ("logo_id");
  CREATE INDEX "endeavors_cover_image_idx" ON "endeavors" USING btree ("cover_image_id");
  CREATE INDEX "endeavors_updated_at_idx" ON "endeavors" USING btree ("updated_at");
  CREATE INDEX "endeavors_created_at_idx" ON "endeavors" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_endeavors_fk" FOREIGN KEY ("endeavors_id") REFERENCES "public"."endeavors"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_endeavors_id_idx" ON "payload_locked_documents_rels" USING btree ("endeavors_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "endeavors_capabilities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "endeavors" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "endeavors_capabilities" CASCADE;
  DROP TABLE "endeavors" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_endeavors_fk";
  
  DROP INDEX "payload_locked_documents_rels_endeavors_id_idx";
  ALTER TABLE "tenants" DROP COLUMN "setup_wizard_complete";
  ALTER TABLE "tenants" DROP COLUMN "setup_wizard_progress";
  ALTER TABLE "tenants" DROP COLUMN "setup_constitution_signed_at";
  ALTER TABLE "tenants" DROP COLUMN "setup_constitution_signature";
  ALTER TABLE "tenants" DROP COLUMN "setup_federation_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "endeavors_id";
  DROP TYPE "public"."enum_endeavors_endeavor_type";
  DROP TYPE "public"."enum_endeavors_status";
  DROP TYPE "public"."enum_endeavors_federation_ministry_status";`)
}
