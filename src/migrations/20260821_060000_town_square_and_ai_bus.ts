import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Two fixes to what an ordinary member sees in their Spaces picker.
 *
 * 1. The town square was a dead code path. `buildSpaceVisibilityFilter` rule 2b
 *    makes any space with visibility 'community' readable by every authenticated
 *    user — and NO space on the node had that value. The platform tenant's
 *    Community becomes the one town square. Per-tenant Communities stay
 *    invite_only on purpose: their members already reach them via the
 *    non-private rule, and promoting them would publish 20-odd customers'
 *    community spaces to every user on the node.
 *
 * 2. AI Bus is system plumbing, seeded `private`, and was never meant to hold
 *    member rows — but the Users auto-join hook joined ALL of a tenant's spaces,
 *    so "AI Bus" was the first thing a visiting user saw. Both hooks now skip
 *    it; these are the rows they already minted.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "spaces" SET "visibility" = 'community'
    WHERE "slug" = 'community'
      AND "tenant_id" = (SELECT "id" FROM "tenants" WHERE "slug" = 'platform');
  `)
  await db.execute(sql`
    DELETE FROM "space_memberships"
    WHERE "space_id" IN (SELECT "id" FROM "spaces" WHERE "slug" = 'ai-bus');
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  // The deleted rows are not restorable, and should not be — both hooks now
  // refuse to mint them. Only the visibility flip reverses.
  await db.execute(sql`
    UPDATE "spaces" SET "visibility" = 'invite_only' WHERE "visibility" = 'community';
  `)
}
