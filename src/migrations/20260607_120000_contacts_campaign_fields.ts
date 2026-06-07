import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add campaign / email-metering columns to contacts:
 *   - unsubscribe_token (varchar, indexed) — one-click unsubscribe links
 *   - last_emailed_at (timestamptz) — last campaign send, for resumable/idempotent runs
 *   - email_count (numeric) — number of campaign emails sent
 *
 * Hand-written + idempotent (live DBs are dev-pushed; this is the safety net).
 * Scoped to contacts only — deliberately avoids the unrelated payload_mcp_*
 * schema drift that `migrate:create` surfaces interactively.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "unsubscribe_token" varchar;
    ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "last_emailed_at" timestamp(3) with time zone;
    ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "email_count" numeric DEFAULT 0;
    CREATE INDEX IF NOT EXISTS "contacts_unsubscribe_token_idx" ON "contacts" USING btree ("unsubscribe_token");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "contacts_unsubscribe_token_idx";
    ALTER TABLE "contacts" DROP COLUMN IF EXISTS "unsubscribe_token";
    ALTER TABLE "contacts" DROP COLUMN IF EXISTS "last_emailed_at";
    ALTER TABLE "contacts" DROP COLUMN IF EXISTS "email_count";
  `)
}
