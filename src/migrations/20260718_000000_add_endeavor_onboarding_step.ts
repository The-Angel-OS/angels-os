import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Endeavor onboarding step (reception flow position).
 *
 * The post-provision reception flow (/welcome) walks a flat step list
 * (welcome → identity → invite → first-act → done). Persist the owner's position
 * so the flow resumes where they left off and the dashboard can nudge unfinished
 * onboarding. See src/utilities/onboardingFlow.ts + src/collections/Endeavors.
 *
 * ADDITIVE ONLY — a nullable text column. Existing rows get NULL (never entered),
 * which the flow reads as "start at welcome". Nothing is backfilled.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "endeavors" ADD COLUMN IF NOT EXISTS "onboarding_step" varchar;
    CREATE INDEX IF NOT EXISTS "endeavors_onboarding_step_idx" ON "endeavors" ("onboarding_step");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP INDEX IF EXISTS "endeavors_onboarding_step_idx";
    ALTER TABLE "endeavors" DROP COLUMN IF EXISTS "onboarding_step";
  `)
}
