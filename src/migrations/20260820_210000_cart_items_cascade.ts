import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * A cart line whose product was deleted must GO, not linger as a null.
 *
 * `carts_items.product_id` was ON DELETE SET NULL, so deleting a product left the
 * line behind pointing at nothing. The ecommerce plugin's add-item walks the
 * existing items and reads `item.product.id` to find a match — on a null row that
 * throws, and the throw takes down BOTH add-item and remove-item for that cart.
 *
 * The result, found 260820: 27 carts across the platform were bricked. Their
 * owners could not add anything, and could not even click the ✕ to remove the bad
 * line. Nobody knew, because a cart that silently refuses to accept an item
 * generates no complaint — the customer just leaves.
 *
 * CASCADE is the honest rule here, the same reasoning as the membership join
 * tables earlier the same day: a cart line without its product is not an orphan
 * worth keeping, it is a row that can never be read again.
 *
 * Existing nulls are deleted first (a CASCADE only governs future deletes), and
 * every affected cart's subtotal is recomputed from what is actually still in it —
 * those were left reading the old, higher total.
 *
 * No defensive hook to go with it: Carts comes from the ecommerce plugin, and once
 * the database itself refuses to leave a dangling line there is no path left that
 * creates one.
 */

const TARGETS: Array<{ column: string; ref: string }> = [
  { column: 'product_id', ref: 'products' },
  { column: 'variant_id', ref: 'variants' },
]

const constraintName = (t: { column: string; ref: string }) =>
  `carts_items_${t.column}_${t.ref}_id_fk`

function rebuild(onDelete: 'CASCADE' | 'SET NULL'): string {
  return TARGETS.map(
    (t) => `
      ALTER TABLE "carts_items" DROP CONSTRAINT IF EXISTS "${constraintName(t)}";
      ALTER TABLE "carts_items"
        ADD CONSTRAINT "${constraintName(t)}"
        FOREIGN KEY ("${t.column}") REFERENCES "${t.ref}"("id")
        ON DELETE ${onDelete} ON UPDATE NO ACTION;`,
  ).join('\n')
}

/** Drop dangling lines, then make every affected cart's total honest again. */
const CLEAN_UP = `
  DELETE FROM "carts_items" WHERE "product_id" IS NULL;

  UPDATE "carts" c SET "subtotal" = COALESCE((
    SELECT SUM(p."price_in_u_s_d" * ci."quantity")
    FROM "carts_items" ci JOIN "products" p ON p."id" = ci."product_id"
    WHERE ci."_parent_id" = c."id"), 0)
  WHERE c."subtotal" IS DISTINCT FROM COALESCE((
    SELECT SUM(p."price_in_u_s_d" * ci."quantity")
    FROM "carts_items" ci JOIN "products" p ON p."id" = ci."product_id"
    WHERE ci."_parent_id" = c."id"), 0);
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(CLEAN_UP))
  await db.execute(sql.raw(rebuild('CASCADE')))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql.raw(rebuild('SET NULL')))
}
