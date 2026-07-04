import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Add the NVIDIA NIM key + model override to the tenants aiConfig group so the
 * key lives in configuration (the AI settings tab), not just .env. Additive +
 * idempotent (IF NOT EXISTS). Runs in the build's `payload migrate` step, so the
 * columns exist before any code queries them — no Sprint-44-style drift.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ai_config_nvidia_api_key" varchar;
    ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "ai_config_nvidia_model" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "ai_config_nvidia_api_key";
    ALTER TABLE "tenants" DROP COLUMN IF EXISTS "ai_config_nvidia_model";
  `)
}
