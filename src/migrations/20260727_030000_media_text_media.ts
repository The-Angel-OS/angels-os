import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds `media_id` to every Media+Text block table so the block can take an
 * UPLOAD (image or video) instead of only an external YouTube/Vimeo URL.
 *
 * The block lives on pages, posts and products, and each has a `_v` versions
 * twin — six tables. Derived from information_schema rather than enumerated by
 * hand: a hand-written list of *_rels tables is exactly how the 42703 outage
 * happened, because the list was incomplete by construction.
 * @see docs/FOOTGUNS.md §2.4
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  const rows = await db.execute(
    sql.raw(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE '%blocks_media_text%';
    `),
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (rows as any).rows ?? []) {
    await db.execute(
      sql.raw(`
        ALTER TABLE "${row.table_name}" ADD COLUMN IF NOT EXISTS "media_id" integer
          REFERENCES "media"("id") ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS "${row.table_name}_media_idx"
          ON "${row.table_name}" ("media_id");
      `),
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  const rows = await db.execute(
    sql.raw(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE '%blocks_media_text%';
    `),
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const row of (rows as any).rows ?? []) {
    await db.execute(sql.raw(`ALTER TABLE "${row.table_name}" DROP COLUMN IF EXISTS "media_id";`))
  }
}
