import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Events get the products that were sold at them, and a comment thread.
 *
 * There was no association at all — an event and a product knew nothing about
 * each other, so "what did we sell at that market?" was not a question the data
 * could answer, and the market-stand QR could not carry a stand's actual stock.
 * A relationship rather than a block, deliberately: a block buries the link in
 * layout JSON where nothing can query it.
 *
 * `event_price` is in DOLLARS — matching `products.price_in_u_s_d`, the number it
 * stands in for — and is not a discount engine. A coupon is a checkout
 * concern — code, stacking, expiry, abuse — and belongs to the store. This is
 * the other thing people mean by event pricing: what it costs at this event.
 * NULL means the product's own price stands. Keeping them apart is what lets a
 * store-wide coupon and an event price coexist later without either knowing
 * about the other.
 *
 * Events do NOT use Payload drafts (they carry their own `status`), so unlike
 * pages there is no `_events_v` twin to mirror. One table.
 *
 * @see project_frozen_migration_rule — new file, never an edit to an applied one
 * @see project_schema_field_deploy_rule — the table lands before the config ships
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "events_products" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      "id" varchar PRIMARY KEY NOT NULL,
      "product_id" integer,
      "event_price" numeric,
      "note" varchar
    );
  `)

  // CASCADE from the event: a row here is meaningless without its parent, and
  // the alternative — SET NULL onto a NOT NULL column — is the contradiction
  // that has taken deletes down on this node before.
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "events_products"
        ADD CONSTRAINT "events_products_parent_id_fk"
        FOREIGN KEY ("_parent_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  // The product itself is SET NULL, and product_id is NULLABLE to match. A
  // deleted product must not silently delete the record that it was sold at an
  // event, and a nullable column is the only shape where SET NULL is honest.
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "events_products"
        ADD CONSTRAINT "events_products_product_id_fk"
        FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)

  await db.execute(sql`CREATE INDEX IF NOT EXISTS "events_products_order_idx" ON "events_products" ("_order");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "events_products_parent_id_idx" ON "events_products" ("_parent_id");`)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "events_products_product_idx" ON "events_products" ("product_id");`)

  /**
   * An event can carry a comment thread.
   *
   * `Comments.parent` is a POLYMORPHIC relationship, stored as one nullable id
   * column per target on comments_rels. Adding 'events' to relationTo without
   * this column means every event comment fails to save — the same footgun the
   * pages_comments_block migration documents.
   */
  await db.execute(sql`ALTER TABLE "comments_rels" ADD COLUMN IF NOT EXISTS "events_id" integer;`)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "comments_rels"
        ADD CONSTRAINT "comments_rels_events_fk"
        FOREIGN KEY ("events_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "comments_rels_events_id_idx" ON "comments_rels" ("events_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP TABLE IF EXISTS "events_products";`)
  await db.execute(sql`ALTER TABLE "comments_rels" DROP COLUMN IF EXISTS "events_id";`)
}
