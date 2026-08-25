import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Read state: what each person has already seen, per channel.
 *
 * `users.read_state` — a `{ channelSlug: isoTimestamp }` map. One column instead
 * of a `channel-reads` collection: it rides along with `/api/users/me`, so read
 * state costs no extra request on page load, and it sits beside `dashboard_prefs`
 * which is the same idea. See `utilities/readState.ts` for what the shape cannot
 * do and what replaces it when that day comes.
 *
 * `messages (channel, created_at)` — the index the unread count is built on.
 * `channel` alone was already indexed, which finds a channel's whole history;
 * every unread query then wants "…and newer than this timestamp", and without
 * the second column that is a filter over every message the channel ever had.
 * The same index serves the "new since" divider scroll.
 *
 * Round-tripped against the live database before the config shipped — the
 * 260824 `events_rels` lesson: Payload builds its SELECT from the live config,
 * so a column the config expects and prod lacks makes the collection unreadable.
 *
 * @see project_schema_field_deploy_rule
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "read_state" jsonb;`)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "messages_channel_created_at_idx"
      ON "messages" ("channel", "created_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`DROP INDEX IF EXISTS "messages_channel_created_at_idx";`)
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "read_state";`)
}
