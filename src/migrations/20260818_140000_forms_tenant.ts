import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds forms.tenant_id.
 *
 * The form-builder plugin ships no tenant field, so every portal on the platform
 * shared a single "Contact Form" doc. Two consequences, both live:
 *
 *  1. Nobody could design their own lead capture — editing the form for one
 *     business edited it for all of them.
 *  2. That one doc carried the only `emails` row, which was the untouched
 *     Payload demo template: it mailed `{{email}}` (the person who submitted)
 *     from `demo@payloadcms.com`. The business owner was never notified at all.
 *
 * Nullable on purpose. A null tenant means "platform-shared", which is exactly
 * the old behaviour, so existing forms keep working while new ones are scoped.
 * Hand-written + idempotent.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "forms" ADD COLUMN IF NOT EXISTS "tenant_id" integer;

      DO $$ BEGIN
        ALTER TABLE "forms"
          ADD CONSTRAINT "forms_tenant_id_tenants_id_fk"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
          ON DELETE SET NULL ON UPDATE NO ACTION;
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;

      CREATE INDEX IF NOT EXISTS "forms_tenant_idx" ON "forms" ("tenant_id");
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DROP INDEX IF EXISTS "forms_tenant_idx";
      ALTER TABLE "forms" DROP COLUMN IF EXISTS "tenant_id";
    `),
  )
}
