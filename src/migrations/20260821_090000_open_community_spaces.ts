import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Every portal's Community space is open. Ken's 260821 call.
 *
 * `community` is the one visibility tier buildSpaceVisibilityFilter grants to
 * any authenticated user, node-wide. Combined with ensureTenantMembership
 * running on portal arrival, walking into a portal means you can read its town
 * square and are enrolled to take part in it — which is what a town square is.
 *
 * Anything a portal wants kept in is a `private` space; this tier never touches
 * those, and DMs are membership-grained regardless.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "spaces" SET "visibility" = 'community'
    WHERE "slug" = 'community' AND "visibility" <> 'private';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "spaces" SET "visibility" = 'invite_only'
    WHERE "slug" = 'community' AND "visibility" = 'community';
  `)
}
