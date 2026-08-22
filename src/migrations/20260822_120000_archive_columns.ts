import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * archive.columns — three across or four.
 *
 * CollectionArchive has always accepted a `columns` prop, but the Archive block
 * never passed one, so it defaulted to 4: three featured posts sat in a
 * four-column grid and hung left instead of filling the row. This is the field
 * that lets an owner say "featured row" rather than "listing".
 *
 * The Archive block is available on pages, posts AND products, and each of
 * those is versioned — so the column lands on SIX tables, not two. Getting the
 * `_v` half wrong is what blanked the admin on 260821: the create view autosaves
 * a draft on open, and that insert names every column the config knows about.
 *
 * @see project_frozen_migration_rule — new file, never an edit to an applied one
 */
const PARENTS = ['pages', 'posts', 'products'] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const p of PARENTS) {
    for (const table of [`${p}_blocks_archive`, `_${p}_v_blocks_archive`]) {
      const enumName = `enum_${table}_columns`
      await db.execute(sql.raw(`
        DO $$ BEGIN
          CREATE TYPE "${enumName}" AS ENUM ('3', '4');
        EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      `))
      await db.execute(sql.raw(`
        ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "columns" "${enumName}" DEFAULT '4';
      `))
    }
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const p of PARENTS) {
    for (const table of [`${p}_blocks_archive`, `_${p}_v_blocks_archive`]) {
      await db.execute(sql.raw(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "columns";`))
      await db.execute(sql.raw(`DROP TYPE IF EXISTS "enum_${table}_columns";`))
    }
  }
}
