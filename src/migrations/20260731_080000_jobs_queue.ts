import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * Payload's jobs queue — `payload_jobs`, its `log` array, and the
 * `payload-jobs-stats` global the scheduler uses to remember what it last
 * queued. @see src/jobs/cronTasks.ts
 *
 * DDL taken from Payload 3.86's own dev-mode schema push against an empty
 * database, not hand-derived — the column names are drizzle's (`task_i_d`, not
 * `task_id`) and guessing them would have been a deploy-night surprise.
 *
 * ⚠️ `enum_payload_jobs_task_slug` lists every task slug. Adding a task to
 * `cronTasks` means an `ALTER TYPE … ADD VALUE` in a new migration, or the first
 * run of the new task fails on an invalid enum value.
 */
const TASK_SLUGS = [
  'inline',
  'heal-stalled-messages',
  'sequence-tick',
  'federation-heartbeat',
  'notifications-poll',
  'connector-health',
  'youtube-poll',
  'verify-onboarding',
  'log-consolidate',
  'solvency-briefing',
]
  .map((s) => `'${s}'`)
  .join(',')

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DO $$ BEGIN
        CREATE TYPE "enum_payload_jobs_task_slug" AS ENUM (${TASK_SLUGS});
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE "enum_payload_jobs_log_task_slug" AS ENUM (${TASK_SLUGS});
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
      DO $$ BEGIN
        CREATE TYPE "enum_payload_jobs_log_state" AS ENUM ('failed','succeeded');
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;

      CREATE TABLE IF NOT EXISTS "payload_jobs" (
        "id" serial PRIMARY KEY,
        "input" jsonb,
        "completed_at" timestamp(3) with time zone,
        "total_tried" numeric DEFAULT 0,
        "has_error" boolean DEFAULT false,
        "error" jsonb,
        "task_slug" "enum_payload_jobs_task_slug",
        "queue" varchar DEFAULT 'default',
        "wait_until" timestamp(3) with time zone,
        "processing" boolean DEFAULT false,
        "meta" jsonb,
        "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
        "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
      );
      CREATE INDEX IF NOT EXISTS "payload_jobs_completed_at_idx" ON "payload_jobs" ("completed_at");
      CREATE INDEX IF NOT EXISTS "payload_jobs_created_at_idx" ON "payload_jobs" ("created_at");
      CREATE INDEX IF NOT EXISTS "payload_jobs_has_error_idx" ON "payload_jobs" ("has_error");
      CREATE INDEX IF NOT EXISTS "payload_jobs_processing_idx" ON "payload_jobs" ("processing");
      CREATE INDEX IF NOT EXISTS "payload_jobs_queue_idx" ON "payload_jobs" ("queue");
      CREATE INDEX IF NOT EXISTS "payload_jobs_task_slug_idx" ON "payload_jobs" ("task_slug");
      CREATE INDEX IF NOT EXISTS "payload_jobs_total_tried_idx" ON "payload_jobs" ("total_tried");
      CREATE INDEX IF NOT EXISTS "payload_jobs_updated_at_idx" ON "payload_jobs" ("updated_at");
      CREATE INDEX IF NOT EXISTS "payload_jobs_wait_until_idx" ON "payload_jobs" ("wait_until");

      CREATE TABLE IF NOT EXISTS "payload_jobs_log" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "id" varchar NOT NULL,
        "executed_at" timestamp(3) with time zone NOT NULL,
        "completed_at" timestamp(3) with time zone NOT NULL,
        "task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
        "task_i_d" varchar NOT NULL,
        "input" jsonb,
        "output" jsonb,
        "state" "enum_payload_jobs_log_state" NOT NULL,
        "error" jsonb,
        CONSTRAINT "payload_jobs_log_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "payload_jobs"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "payload_jobs_log_order_idx" ON "payload_jobs_log" ("_order");
      CREATE INDEX IF NOT EXISTS "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" ("_parent_id");

      CREATE TABLE IF NOT EXISTS "payload_jobs_stats" (
        "id" serial PRIMARY KEY,
        "stats" jsonb,
        "updated_at" timestamp(3) with time zone,
        "created_at" timestamp(3) with time zone
      );
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DROP TABLE IF EXISTS "payload_jobs_log";
      DROP TABLE IF EXISTS "payload_jobs";
      DROP TABLE IF EXISTS "payload_jobs_stats";
      DROP TYPE IF EXISTS "enum_payload_jobs_log_state";
      DROP TYPE IF EXISTS "enum_payload_jobs_log_task_slug";
      DROP TYPE IF EXISTS "enum_payload_jobs_task_slug";
    `),
  )
}
