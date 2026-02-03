import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_tenant_memberships_permissions" AS ENUM('manage_users', 'manage_spaces', 'manage_content', 'manage_products', 'manage_orders', 'view_analytics', 'manage_settings', 'manage_billing', 'export_data');
  CREATE TYPE "public"."enum_tenant_memberships_role" AS ENUM('tenant_admin', 'tenant_manager', 'tenant_member');
  CREATE TYPE "public"."enum_tenant_memberships_status" AS ENUM('active', 'pending', 'suspended', 'revoked');
  ALTER TYPE "public"."enum_users_roles" ADD VALUE 'super_admin' BEFORE 'admin';
  CREATE TABLE "tenant_memberships_permissions" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_tenant_memberships_permissions",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "tenant_memberships" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"tenant_id" integer NOT NULL,
  	"role" "enum_tenant_memberships_role" NOT NULL,
  	"status" "enum_tenant_memberships_status" DEFAULT 'active',
  	"invited_by_id" integer,
  	"joined_at" timestamp(3) with time zone,
  	"invitation_details_invitation_token" varchar,
  	"invitation_details_invitation_expires_at" timestamp(3) with time zone,
  	"invitation_details_invitation_message" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tenant_memberships_id" integer;
  ALTER TABLE "tenant_memberships_permissions" ADD CONSTRAINT "tenant_memberships_permissions_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."tenant_memberships"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tenant_memberships" ADD CONSTRAINT "tenant_memberships_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "tenant_memberships_permissions_order_idx" ON "tenant_memberships_permissions" USING btree ("order");
  CREATE INDEX "tenant_memberships_permissions_parent_idx" ON "tenant_memberships_permissions" USING btree ("parent_id");
  CREATE INDEX "tenant_memberships_user_idx" ON "tenant_memberships" USING btree ("user_id");
  CREATE INDEX "tenant_memberships_tenant_idx" ON "tenant_memberships" USING btree ("tenant_id");
  CREATE INDEX "tenant_memberships_invited_by_idx" ON "tenant_memberships" USING btree ("invited_by_id");
  CREATE INDEX "tenant_memberships_updated_at_idx" ON "tenant_memberships" USING btree ("updated_at");
  CREATE INDEX "tenant_memberships_created_at_idx" ON "tenant_memberships" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tenant_memberships_fk" FOREIGN KEY ("tenant_memberships_id") REFERENCES "public"."tenant_memberships"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_tenant_memberships_id_idx" ON "payload_locked_documents_rels" USING btree ("tenant_memberships_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "tenant_memberships_permissions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tenant_memberships" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "tenant_memberships_permissions" CASCADE;
  DROP TABLE "tenant_memberships" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tenant_memberships_fk";
  
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE text;
  DROP TYPE "public"."enum_users_roles";
  CREATE TYPE "public"."enum_users_roles" AS ENUM('admin', 'customer');
  ALTER TABLE "users_roles" ALTER COLUMN "value" SET DATA TYPE "public"."enum_users_roles" USING "value"::"public"."enum_users_roles";
  DROP INDEX "payload_locked_documents_rels_tenant_memberships_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tenant_memberships_id";
  DROP TYPE "public"."enum_tenant_memberships_permissions";
  DROP TYPE "public"."enum_tenant_memberships_role";
  DROP TYPE "public"."enum_tenant_memberships_status";`)
}
