import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Adds the 'fullScreen' value to the hero `type` enum on pages/posts (+ their
 * version tables). The hero.type select is stored as a pg enum, so a new option in
 * the config throws on save without this. Hand-written + scoped (dodges unrelated
 * payload_mcp_* auto-gen drift). Idempotent via ADD VALUE IF NOT EXISTS.
 *
 * Postgres has no ALTER TYPE ... DROP VALUE, so `down` is a no-op (leaving an unused
 * enum value is harmless).
 */
const ENUMS = [
  'enum_pages_hero_type',
  'enum_posts_hero_type',
  'enum__pages_v_version_hero_type',
  'enum__posts_v_version_hero_type',
]

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const e of ENUMS) {
    await db.execute(sql.raw(`ALTER TYPE "${e}" ADD VALUE IF NOT EXISTS 'fullScreen';`))
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Postgres cannot drop an enum value; no-op.
}
