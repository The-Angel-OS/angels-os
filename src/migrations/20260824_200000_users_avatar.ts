import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Two columns on `users`, both in service of the same thing: a chat that can
 * show you who is talking.
 *
 * `avatar_id` — an uploadable profile picture, overriding the Gravatar.
 * `gravatar_hash` — md5 of the lowercased email, maintained on save.
 *
 * The hash is stored rather than derived at read time because `email` is now
 * redacted for everyone but the account's owner and an admin (260824: users.read
 * widened to any signed-in person so author names resolve, with field gates
 * carrying the protection). A fallback avatar only its owner can see is not a
 * fallback.
 *
 * Backfills the hash for every existing row with an email, so nobody has to
 * re-save to get a face.
 *
 * `avatar_id` is nullable with ON DELETE SET NULL — deleting the image should
 * clear the avatar, not refuse. That is the SAFE half of the 260820 pattern;
 * the outage there was NOT NULL columns carrying SET NULL.
 *
 * @see project_schema_field_deploy_rule
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_id" integer;`)
  await db.execute(sql`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "gravatar_hash" varchar;`)
  await db.execute(sql`
    DO $$ BEGIN
      ALTER TABLE "users" ADD CONSTRAINT "users_avatar_id_media_id_fk"
        FOREIGN KEY ("avatar_id") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
  `)
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "users_avatar_idx" ON "users" ("avatar_id");`)
  await db.execute(sql`
    UPDATE "users"
       SET "gravatar_hash" = md5(lower(trim("email")))
     WHERE "email" IS NOT NULL AND trim("email") <> '' AND "gravatar_hash" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "avatar_id";`)
  await db.execute(sql`ALTER TABLE "users" DROP COLUMN IF EXISTS "gravatar_hash";`)
}
