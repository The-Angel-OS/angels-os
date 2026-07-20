import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds branding.defaultTheme (auto | light | dark) to tenants — a per-tenant site
 * theme default so a brand can pin its site light/dark while others follow the
 * visitor's OS. Hand-written + scoped. Idempotent.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        CREATE TYPE "enum_tenants_branding_default_theme" AS ENUM('auto', 'light', 'dark');
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      ALTER TABLE "tenants"
        ADD COLUMN IF NOT EXISTS "branding_default_theme" "enum_tenants_branding_default_theme" DEFAULT 'auto';
    `),
  )
  // Version table, if this install versions tenants.
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_tenants_v') THEN
          ALTER TABLE "_tenants_v"
            ADD COLUMN IF NOT EXISTS "version_branding_default_theme" "enum_tenants_branding_default_theme" DEFAULT 'auto';
        END IF;
      END $$;
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "tenants" DROP COLUMN IF EXISTS "branding_default_theme";
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '_tenants_v') THEN
          ALTER TABLE "_tenants_v" DROP COLUMN IF EXISTS "version_branding_default_theme";
        END IF;
      END $$;
    `),
  )
}
