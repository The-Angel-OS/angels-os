import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add the `presence` table — live online-presence (MMORPG-hub Slice 1).
 * One row per user (unique), upserted by a client ping; online derived from
 * last_seen_at. Global (not tenant-scoped); optional space relation.
 *
 * Hand-written + idempotent (live DBs are dev-pushed; this is the safety net).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_presence_status" AS ENUM('online', 'away', 'offline');
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE TABLE IF NOT EXISTS "presence" (
      "id" serial PRIMARY KEY NOT NULL,
      "user_id" integer NOT NULL,
      "status" "enum_presence_status" DEFAULT 'online',
      "last_seen_at" timestamp(3) with time zone NOT NULL,
      "space_id" integer,
      "path" varchar,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    DO $$ BEGIN
      ALTER TABLE "presence" ADD CONSTRAINT "presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    DO $$ BEGIN
      ALTER TABLE "presence" ADD CONSTRAINT "presence_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;

    CREATE UNIQUE INDEX IF NOT EXISTS "presence_user_idx" ON "presence" USING btree ("user_id");
    CREATE INDEX IF NOT EXISTS "presence_status_idx" ON "presence" USING btree ("status");
    CREATE INDEX IF NOT EXISTS "presence_last_seen_at_idx" ON "presence" USING btree ("last_seen_at");
    CREATE INDEX IF NOT EXISTS "presence_space_idx" ON "presence" USING btree ("space_id");
    CREATE INDEX IF NOT EXISTS "presence_updated_at_idx" ON "presence" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "presence_created_at_idx" ON "presence" USING btree ("created_at");

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "presence_id" integer;
    DO $$ BEGIN
      ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_presence_fk" FOREIGN KEY ("presence_id") REFERENCES "public"."presence"("id") ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null; END $$;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "presence_id";
    DROP TABLE IF EXISTS "presence" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_presence_status";
  `)
}
