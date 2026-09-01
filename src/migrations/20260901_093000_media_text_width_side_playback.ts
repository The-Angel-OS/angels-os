import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * `width`, `side` and `playback` on every mediaText block table.
 *
 * These three fields were added to `src/blocks/MediaText/config.ts` and no
 * migration ever created their columns. Payload selects every field of a block
 * on every read, so any Page, Post or Product carrying a Media + Text block
 * dies with Postgres 42703 (`column ..._blocks_media_text.width does not
 * exist`) — which surfaces as a 404 or a 500 on the page, not as an obvious
 * schema error. Found on 260901 when a post page 404'd on a database that had
 * only ever been built from the committed migrations, which is exactly what
 * production is.
 *
 * This is the same footgun as `20260728_093000_media_text_aspect_all_tables`,
 * and it takes the same shape of fix — FOOTGUNS §2.4: DERIVE the target list,
 * never enumerate it. A hand-written list of tables is incomplete by
 * construction, and it was a hand-written list that broke the site last time.
 * So: every table that already carries this block's `video_on_right` column is
 * a mediaText table, whatever it is named and whichever collection grew it.
 *
 * Plain `varchar` with a default rather than a pg enum, matching what the aspect
 * migration did: Payload reads and writes these as strings, an enum buys nothing
 * here, and adding an option later would then need its own ALTER TYPE.
 *
 * Defaults mirror the block config, so existing rows render exactly as they did
 * before the fields existed: split layout, media right, ordinary player.
 */
const DEFAULTS: Array<[column: string, value: string]> = [
  ['width', 'split'],
  ['side', 'right'],
  ['playback', 'player'],
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [column, value] of DEFAULTS) {
    await db.execute(
      sql.raw(`
        DO $$
        DECLARE t record;
        BEGIN
          FOR t IN
            SELECT c.table_name
            FROM information_schema.columns c
            WHERE c.column_name = 'video_on_right'
              AND c.table_schema = 'public'
              AND c.table_name LIKE '%blocks_media_text%'
          LOOP
            EXECUTE format(
              'ALTER TABLE %I ADD COLUMN IF NOT EXISTS ${column} varchar DEFAULT ''${value}''',
              t.table_name
            );
          END LOOP;
        END $$;
      `),
    )
  }
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  for (const [column] of DEFAULTS) {
    await db.execute(
      sql.raw(`
        DO $$
        DECLARE t record;
        BEGIN
          FOR t IN
            SELECT c.table_name
            FROM information_schema.columns c
            WHERE c.column_name = '${column}'
              AND c.table_schema = 'public'
              AND c.table_name LIKE '%blocks_media_text%'
          LOOP
            EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS ${column}', t.table_name);
          END LOOP;
        END $$;
      `),
    )
  }
}
