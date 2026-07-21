import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Tenant-scope the ecommerce-plugin collections. `carts`, `addresses`, and
 * `transactions` had no tenant column, so they were keyed to the customer only
 * and leaked across every portal an SSO'd user visited. Adds a nullable
 * `tenant_id` FK + index to each (populated on write by the collection override
 * in src/collections/ecommerce/tenantScope.ts). Existing rows stay NULL and drop
 * out of per-portal views — that IS the isolation (they were the leaking rows).
 * Idempotent; no backfill (transient/low-risk data).
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "carts" ADD COLUMN IF NOT EXISTS "tenant_id" integer;
      ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "tenant_id" integer;
      ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "tenant_id" integer;

      DO $$ BEGIN
        ALTER TABLE "carts" ADD CONSTRAINT "carts_tenant_id_tenants_id_fk"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN
        ALTER TABLE "addresses" ADD CONSTRAINT "addresses_tenant_id_tenants_id_fk"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN null; END $$;
      DO $$ BEGIN
        ALTER TABLE "transactions" ADD CONSTRAINT "transactions_tenant_id_tenants_id_fk"
          FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN null; END $$;

      CREATE INDEX IF NOT EXISTS "carts_tenant_idx" ON "carts" ("tenant_id");
      CREATE INDEX IF NOT EXISTS "addresses_tenant_idx" ON "addresses" ("tenant_id");
      CREATE INDEX IF NOT EXISTS "transactions_tenant_idx" ON "transactions" ("tenant_id");
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      ALTER TABLE "carts" DROP COLUMN IF EXISTS "tenant_id";
      ALTER TABLE "addresses" DROP COLUMN IF EXISTS "tenant_id";
      ALTER TABLE "transactions" DROP COLUMN IF EXISTS "tenant_id";
    `),
  )
}
