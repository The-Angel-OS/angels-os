import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Widening the shared link field's `relationTo` from ['pages'] to
 * ['pages','posts','products','events'] is a SCHEMA change, not a config one.
 *
 * A polymorphic relationship stores its targets in the owning document's
 * `_rels` table with one `<collection>_id` column per allowed target. Deploying
 * the wider list without those columns made Payload SELECT
 * `header_rels.posts_id` and friends, which do not exist — Postgres 42703
 * (undefined_column) on every page, header, footer and post read. The nav
 * collapsed to hardcoded defaults and page queries fell back to static data.
 *
 * The table list is DERIVED, not hand-written: any `*_rels` table that already
 * has a `pages_id` column is, by definition, one that stores link references —
 * documents, their draft-version twins, header and footer alike. Enumerating
 * them by hand is how the first version of this migration missed posts__rels
 * and left the site half-broken. Idempotent.
 */
const TARGETS: Array<{ col: string; table: string }> = [
  { col: 'posts_id', table: 'posts' },
  { col: 'products_id', table: 'products' },
  { col: 'events_id', table: 'events' },
]

const forEachLinkRelsTable = (body: (col: string, table: string) => string) =>
  TARGETS.map(
    (t) => `
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN
        SELECT table_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name = 'pages_id' AND table_name LIKE '%rels'
      LOOP
        ${body(t.col, t.table)}
      END LOOP;
    END $$;`,
  ).join('\n')

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(
      forEachLinkRelsTable(
        (col, table) => `
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS %I integer', r.table_name, '${col}');
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (%I)', r.table_name || '_${col}_idx', r.table_name, '${col}');
        BEGIN
          EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(id) ON DELETE CASCADE',
            r.table_name, r.table_name || '_${col}_fk', '${col}', '${table}'
          );
        EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
        END;`,
      ),
    ),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(
      forEachLinkRelsTable(
        (col) => `EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS %I', r.table_name, '${col}');`,
      ),
    ),
  )
}
