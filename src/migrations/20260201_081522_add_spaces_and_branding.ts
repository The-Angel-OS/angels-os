import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tenants_branding_heading_font" AS ENUM('inter', 'playfair-display', 'montserrat', 'raleway', 'poppins');
  CREATE TYPE "public"."enum_tenants_branding_body_font" AS ENUM('inter', 'open-sans', 'lato', 'roboto', 'source-sans-3');
  CREATE TYPE "public"."enum_spaces_visibility" AS ENUM('public', 'invite_only', 'private');
  CREATE TYPE "public"."enum_space_memberships_role" AS ENUM('space_admin', 'moderator', 'member', 'guest');
  CREATE TYPE "public"."enum_space_memberships_status" AS ENUM('active', 'pending', 'suspended', 'left', 'banned');
  CREATE TABLE "spaces" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"tenant_id" integer NOT NULL,
  	"visibility" "enum_spaces_visibility" DEFAULT 'invite_only',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "space_memberships" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"space_id" integer NOT NULL,
  	"role" "enum_space_memberships_role" NOT NULL,
  	"status" "enum_space_memberships_status" DEFAULT 'active',
  	"joined_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "tenants" ADD COLUMN "branding_tagline" varchar;
  ALTER TABLE "tenants" ADD COLUMN "branding_secondary_color" varchar;
  ALTER TABLE "tenants" ADD COLUMN "branding_accent_color" varchar;
  ALTER TABLE "tenants" ADD COLUMN "branding_background_color" varchar;
  ALTER TABLE "tenants" ADD COLUMN "branding_foreground_color" varchar;
  ALTER TABLE "tenants" ADD COLUMN "branding_border_color" varchar;
  ALTER TABLE "tenants" ADD COLUMN "branding_heading_font" "enum_tenants_branding_heading_font" DEFAULT 'inter';
  ALTER TABLE "tenants" ADD COLUMN "branding_body_font" "enum_tenants_branding_body_font" DEFAULT 'inter';
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "spaces_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "space_memberships_id" integer;
  ALTER TABLE "spaces" ADD CONSTRAINT "spaces_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_memberships" ADD CONSTRAINT "space_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_memberships" ADD CONSTRAINT "space_memberships_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  CREATE UNIQUE INDEX "spaces_slug_idx" ON "spaces" USING btree ("slug");
  CREATE INDEX "spaces_tenant_idx" ON "spaces" USING btree ("tenant_id");
  CREATE INDEX "spaces_updated_at_idx" ON "spaces" USING btree ("updated_at");
  CREATE INDEX "spaces_created_at_idx" ON "spaces" USING btree ("created_at");
  CREATE INDEX "space_memberships_user_idx" ON "space_memberships" USING btree ("user_id");
  CREATE INDEX "space_memberships_space_idx" ON "space_memberships" USING btree ("space_id");
  CREATE INDEX "space_memberships_updated_at_idx" ON "space_memberships" USING btree ("updated_at");
  CREATE INDEX "space_memberships_created_at_idx" ON "space_memberships" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_spaces_fk" FOREIGN KEY ("spaces_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_space_memberships_fk" FOREIGN KEY ("space_memberships_id") REFERENCES "public"."space_memberships"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_spaces_id_idx" ON "payload_locked_documents_rels" USING btree ("spaces_id");
  CREATE INDEX "payload_locked_documents_rels_space_memberships_id_idx" ON "payload_locked_documents_rels" USING btree ("space_memberships_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "spaces" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "space_memberships" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "spaces" CASCADE;
  DROP TABLE "space_memberships" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_spaces_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_space_memberships_fk";
  
  DROP INDEX "payload_locked_documents_rels_spaces_id_idx";
  DROP INDEX "payload_locked_documents_rels_space_memberships_id_idx";
  ALTER TABLE "tenants" DROP COLUMN "branding_tagline";
  ALTER TABLE "tenants" DROP COLUMN "branding_secondary_color";
  ALTER TABLE "tenants" DROP COLUMN "branding_accent_color";
  ALTER TABLE "tenants" DROP COLUMN "branding_background_color";
  ALTER TABLE "tenants" DROP COLUMN "branding_foreground_color";
  ALTER TABLE "tenants" DROP COLUMN "branding_border_color";
  ALTER TABLE "tenants" DROP COLUMN "branding_heading_font";
  ALTER TABLE "tenants" DROP COLUMN "branding_body_font";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "spaces_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "space_memberships_id";
  DROP TYPE "public"."enum_tenants_branding_heading_font";
  DROP TYPE "public"."enum_tenants_branding_body_font";
  DROP TYPE "public"."enum_spaces_visibility";
  DROP TYPE "public"."enum_space_memberships_role";
  DROP TYPE "public"."enum_space_memberships_status";`)
}
