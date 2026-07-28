import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Add `aspect` to EVERY mediaText block table — derived, not enumerated.
 *
 * The previous migration hand-listed `pages_blocks_media_text` and its versions
 * twin. MediaText is also on POSTS, so `posts_blocks_media_text` and
 * `_posts_v_blocks_media_text` were missed and every post read — including the
 * header's nav query — died with Postgres 42703 the moment the new column was
 * selected. The site came back 502 on any page whose nav touched posts.
 *
 * This is FOOTGUNS §2.4 exactly: "derive the target list, never enumerate it. A
 * hand-written list is incomplete by construction." Written after walking into it.
 *
 * So: find every table that already has this block's `video_on_right` column —
 * i.e. every table Payload generated for mediaText, whatever it is called and
 * wherever a future collection puts it — and add `aspect` there.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
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
            'ALTER TABLE %I ADD COLUMN IF NOT EXISTS aspect varchar DEFAULT ''16/9''',
            t.table_name
          );
        END LOOP;
      END $$;
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DO $$
      DECLARE t record;
      BEGIN
        FOR t IN
          SELECT c.table_name
          FROM information_schema.columns c
          WHERE c.column_name = 'aspect'
            AND c.table_schema = 'public'
            AND c.table_name LIKE '%blocks_media_text%'
        LOOP
          EXECUTE format('ALTER TABLE %I DROP COLUMN IF EXISTS aspect', t.table_name);
        END LOOP;
      END $$;
    `),
  )
}
