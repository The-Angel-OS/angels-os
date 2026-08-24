import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * `events_rels` was one column short: an internal link can point at an EVENT.
 *
 * `20260824_170000_events_layout` created the rels table with pages / posts /
 * products, reasoning from the Pages equivalent. But `src/fields/link.ts` sets
 * `relationTo: ['pages', 'posts', 'products', 'events']`, and Payload builds the
 * SELECT from the live config — so every read of an event asked for
 * `events__rels.events_id` and the whole query failed. Not the block tables:
 * the collection itself became unreadable.
 *
 * Caught by round-tripping the field against the live database before the config
 * shipped, which is the only reason this is a follow-up file instead of an
 * outage. A new column is a NEW migration, never an edit to an applied one —
 * Payload keys on the name, so an edit would never run where it already has.
 *
 * @see project_frozen_migration_rule
 * @see project_schema_field_deploy_rule
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "events_rels" ADD COLUMN IF NOT EXISTS "events_id" integer;`)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "events_rels" ADD CONSTRAINT "events_rels_events_id_fk"
        FOREIGN KEY ("events_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "events_rels_events_id_idx" ON "events_rels" ("events_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "events_rels" DROP COLUMN IF EXISTS "events_id";`)
}
