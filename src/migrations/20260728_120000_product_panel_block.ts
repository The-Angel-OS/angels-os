import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * The `productPanel` block — gallery with lightbox beside formatted copy.
 * Block table, its images array, and the `_pages_v_` twin of each.
 * @see src/blocks/ProductPanel/config.ts
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      CREATE TABLE IF NOT EXISTS "pages_blocks_product_panel" (
        "_order" integer NOT NULL, "_parent_id" integer NOT NULL, "_path" text NOT NULL,
        "id" varchar NOT NULL, "heading" varchar, "price" varchar, "body" jsonb,
        "cta_label" varchar DEFAULT 'Buy now', "cta_url" varchar, "footnote" varchar,
        "block_name" varchar,
        CONSTRAINT "pages_blocks_product_panel_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "pages_blocks_product_panel_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "pages_blocks_product_panel_order_idx" ON "pages_blocks_product_panel" ("_order");
      CREATE INDEX IF NOT EXISTS "pages_blocks_product_panel_parent_id_idx" ON "pages_blocks_product_panel" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "pages_blocks_product_panel_path_idx" ON "pages_blocks_product_panel" ("_path");

      CREATE TABLE IF NOT EXISTS "pages_blocks_product_panel_images" (
        "_order" integer NOT NULL, "_parent_id" varchar NOT NULL, "id" varchar NOT NULL,
        "image_id" integer,
        CONSTRAINT "pages_blocks_product_panel_images_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "pages_blocks_product_panel_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "pages_blocks_product_panel"("id") ON DELETE CASCADE,
        CONSTRAINT "pages_blocks_product_panel_images_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS "pages_blocks_product_panel_images_order_idx" ON "pages_blocks_product_panel_images" ("_order");
      CREATE INDEX IF NOT EXISTS "pages_blocks_product_panel_images_parent_id_idx" ON "pages_blocks_product_panel_images" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "pages_blocks_product_panel_images_image_idx" ON "pages_blocks_product_panel_images" ("image_id");

      CREATE TABLE IF NOT EXISTS "_pages_v_blocks_product_panel" (
        "_order" integer NOT NULL, "_parent_id" integer NOT NULL, "_path" text NOT NULL,
        "id" serial PRIMARY KEY, "heading" varchar, "price" varchar, "body" jsonb,
        "cta_label" varchar DEFAULT 'Buy now', "cta_url" varchar, "footnote" varchar,
        "_uuid" varchar, "block_name" varchar,
        CONSTRAINT "_pages_v_blocks_product_panel_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_product_panel_order_idx" ON "_pages_v_blocks_product_panel" ("_order");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_product_panel_parent_id_idx" ON "_pages_v_blocks_product_panel" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_product_panel_path_idx" ON "_pages_v_blocks_product_panel" ("_path");

      CREATE TABLE IF NOT EXISTS "_pages_v_blocks_product_panel_images" (
        "_order" integer NOT NULL, "_parent_id" integer NOT NULL, "id" serial PRIMARY KEY,
        "image_id" integer, "_uuid" varchar,
        CONSTRAINT "_pages_v_blocks_product_panel_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "_pages_v_blocks_product_panel"("id") ON DELETE CASCADE,
        CONSTRAINT "_pages_v_blocks_product_panel_images_image_id_fkey" FOREIGN KEY ("image_id") REFERENCES "media"("id") ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_product_panel_images_order_idx" ON "_pages_v_blocks_product_panel_images" ("_order");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_product_panel_images_parent_id_idx" ON "_pages_v_blocks_product_panel_images" ("_parent_id");
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DROP TABLE IF EXISTS "_pages_v_blocks_product_panel_images";
      DROP TABLE IF EXISTS "_pages_v_blocks_product_panel";
      DROP TABLE IF EXISTS "pages_blocks_product_panel_images";
      DROP TABLE IF EXISTS "pages_blocks_product_panel";
    `),
  )
}
