import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds tenants.vapi.fallbackNumber — the human line Vapi forwards to when the AI
 * can't be reached. Previously the fallback lived only on the Vapi phone-number
 * object (pointing at one hardcoded mobile), so it couldn't vary per portal.
 * Storing it per tenant makes "each portal gets its own bot AND its own failover"
 * a config value rather than a manual API poke. Hand-written + idempotent.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "vapi_fallback_number" varchar;
    `),
  )
  // Version table, if this install versions tenants.
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_tenants_v') THEN
          ALTER TABLE "_tenants_v"
            ADD COLUMN IF NOT EXISTS "version_vapi_fallback_number" varchar;
        END IF;
      END $$;
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "tenants" DROP COLUMN IF EXISTS "vapi_fallback_number";
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_tenants_v') THEN
          ALTER TABLE "_tenants_v" DROP COLUMN IF EXISTS "version_vapi_fallback_number";
        END IF;
      END $$;
    `),
  )
}
