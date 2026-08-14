import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * `posts.access` — the membership gate, extended from Pages to Posts.
 *
 * Gated PAGES already worked; gated POSTS are what a dues-funded endeavor
 * actually publishes (the weekly update from the road), so recurring billing had
 * nothing to unlock. Same column shape and same four values as `pages.access`, so
 * `isPageViewable` gates both without a second vocabulary.
 *
 * Versioned collection → the draft table needs it too, or a preview read comes
 * back with `access: undefined` and silently renders as public.
 *
 * @see src/utilities/pageAccess.ts
 * @see src/app/[locale]/(app)/posts/[slug]/page.tsx
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "posts" ADD COLUMN IF NOT EXISTS "access" varchar DEFAULT 'public';
    ALTER TABLE "_posts_v" ADD COLUMN IF NOT EXISTS "version_access" varchar DEFAULT 'public';
    UPDATE "posts" SET "access" = 'public' WHERE "access" IS NULL;
    UPDATE "_posts_v" SET "version_access" = 'public' WHERE "version_access" IS NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "posts" DROP COLUMN IF EXISTS "access";
    ALTER TABLE "_posts_v" DROP COLUMN IF EXISTS "version_access";
  `)
}
