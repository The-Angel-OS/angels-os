import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Drop UNIQUE constraint from slug indexes on tenant-scoped collections.
 *
 * In a multi-tenant system, different tenants can have channels, spaces,
 * pages, categories, and products with the same slug (e.g. "general",
 * "welcome"). URL routing disambiguates by tenant/domain.
 *
 * Tenants slug stays unique — tenant slugs ARE globally unique identifiers.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  // Drop unique indexes and recreate as non-unique
  await db.execute(sql`
    DROP INDEX IF EXISTS "channels_slug_idx";
    CREATE INDEX "channels_slug_idx" ON "channels" USING btree ("slug");

    DROP INDEX IF EXISTS "spaces_slug_idx";
    CREATE INDEX "spaces_slug_idx" ON "spaces" USING btree ("slug");

    DROP INDEX IF EXISTS "pages_slug_idx";
    CREATE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");

    DROP INDEX IF EXISTS "categories_slug_idx";
    CREATE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");

    DROP INDEX IF EXISTS "products_slug_idx";
    CREATE INDEX "products_slug_idx" ON "products" USING btree ("slug");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // Restore unique indexes (will fail if duplicate slugs exist)
  await db.execute(sql`
    DROP INDEX IF EXISTS "channels_slug_idx";
    CREATE UNIQUE INDEX "channels_slug_idx" ON "channels" USING btree ("slug");

    DROP INDEX IF EXISTS "spaces_slug_idx";
    CREATE UNIQUE INDEX "spaces_slug_idx" ON "spaces" USING btree ("slug");

    DROP INDEX IF EXISTS "pages_slug_idx";
    CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");

    DROP INDEX IF EXISTS "categories_slug_idx";
    CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");

    DROP INDEX IF EXISTS "products_slug_idx";
    CREATE UNIQUE INDEX "products_slug_idx" ON "products" USING btree ("slug");
  `)
}
