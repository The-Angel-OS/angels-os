import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" ADD COLUMN "is_system_user" boolean DEFAULT false;
  ALTER TABLE "users" ADD COLUMN "serves_tenant_id" integer;
  ALTER TABLE "space_memberships" ADD COLUMN "invited_by_id" integer;
  ALTER TABLE "space_memberships" ADD COLUMN "invitation_details_invitation_token" varchar;
  ALTER TABLE "space_memberships" ADD COLUMN "invitation_details_invitation_expires_at" timestamp(3) with time zone;
  ALTER TABLE "space_memberships" ADD COLUMN "invitation_details_invitation_message" varchar;
  ALTER TABLE "space_memberships" ADD COLUMN "invitation_details_invitation_email" varchar;
  ALTER TABLE "users" ADD CONSTRAINT "users_serves_tenant_id_tenants_id_fk" FOREIGN KEY ("serves_tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_memberships" ADD CONSTRAINT "space_memberships_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "users_serves_tenant_idx" ON "users" USING btree ("serves_tenant_id");
  CREATE INDEX "space_memberships_invited_by_idx" ON "space_memberships" USING btree ("invited_by_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users" DROP CONSTRAINT "users_serves_tenant_id_tenants_id_fk";
  
  ALTER TABLE "space_memberships" DROP CONSTRAINT "space_memberships_invited_by_id_users_id_fk";
  
  DROP INDEX "users_serves_tenant_idx";
  DROP INDEX "space_memberships_invited_by_idx";
  ALTER TABLE "users" DROP COLUMN "is_system_user";
  ALTER TABLE "users" DROP COLUMN "serves_tenant_id";
  ALTER TABLE "space_memberships" DROP COLUMN "invited_by_id";
  ALTER TABLE "space_memberships" DROP COLUMN "invitation_details_invitation_token";
  ALTER TABLE "space_memberships" DROP COLUMN "invitation_details_invitation_expires_at";
  ALTER TABLE "space_memberships" DROP COLUMN "invitation_details_invitation_message";
  ALTER TABLE "space_memberships" DROP COLUMN "invitation_details_invitation_email";`)
}
