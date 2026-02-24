import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_contacts_source" AS ENUM('clerk-lms', 'manual', 'csv-import', 'json-import', 'signup', 'referral', 'api');
  CREATE TYPE "public"."enum_contacts_contact_status" AS ENUM('lead', 'invited', 'accepted', 'bounced', 'unsubscribed');
  CREATE TYPE "public"."enum_contacts_invite_status" AS ENUM('not-invited', 'pending', 'accepted', 'expired', 'failed');
  CREATE TABLE "contacts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tenant_id" integer,
  	"email" varchar NOT NULL,
  	"name" varchar,
  	"source" "enum_contacts_source" DEFAULT 'manual' NOT NULL,
  	"source_id" varchar,
  	"contact_status" "enum_contacts_contact_status" DEFAULT 'lead',
  	"invite_status" "enum_contacts_invite_status" DEFAULT 'not-invited',
  	"last_invited_at" timestamp(3) with time zone,
  	"invite_count" numeric DEFAULT 0,
  	"notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "contacts_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  ALTER TABLE "tenant_memberships" ADD COLUMN "invitation_details_invitation_email" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "contacts_id" integer;
  ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contacts_texts" ADD CONSTRAINT "contacts_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "contacts_tenant_idx" ON "contacts" USING btree ("tenant_id");
  CREATE INDEX "contacts_email_idx" ON "contacts" USING btree ("email");
  CREATE INDEX "contacts_source_idx" ON "contacts" USING btree ("source");
  CREATE INDEX "contacts_contact_status_idx" ON "contacts" USING btree ("contact_status");
  CREATE INDEX "contacts_invite_status_idx" ON "contacts" USING btree ("invite_status");
  CREATE INDEX "contacts_updated_at_idx" ON "contacts" USING btree ("updated_at");
  CREATE INDEX "contacts_created_at_idx" ON "contacts" USING btree ("created_at");
  CREATE INDEX "contacts_texts_order_parent" ON "contacts_texts" USING btree ("order","parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contacts_fk" FOREIGN KEY ("contacts_id") REFERENCES "public"."contacts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_contacts_id_idx" ON "payload_locked_documents_rels" USING btree ("contacts_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "contacts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contacts_texts" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "contacts" CASCADE;
  DROP TABLE "contacts_texts" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_contacts_fk";
  
  DROP INDEX "payload_locked_documents_rels_contacts_id_idx";
  ALTER TABLE "tenant_memberships" DROP COLUMN "invitation_details_invitation_email";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "contacts_id";
  DROP TYPE "public"."enum_contacts_source";
  DROP TYPE "public"."enum_contacts_contact_status";
  DROP TYPE "public"."enum_contacts_invite_status";`)
}
