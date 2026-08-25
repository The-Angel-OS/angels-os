import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * The `workQuiz` block on Pages — block table plus its `_pages_v_` draft twin.
 * Two text fields; the quiz itself lives in the Work's chapter markdown.
 * @see src/blocks/WorkQuiz/config.ts
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      CREATE TABLE IF NOT EXISTS "pages_blocks_work_quiz" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "_path" text NOT NULL,
        "id" varchar NOT NULL,
        "work" varchar,
        "chapter" varchar,
        "block_name" varchar,
        CONSTRAINT "pages_blocks_work_quiz_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "pages_blocks_work_quiz_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "pages_blocks_work_quiz_order_idx" ON "pages_blocks_work_quiz" ("_order");
      CREATE INDEX IF NOT EXISTS "pages_blocks_work_quiz_parent_id_idx" ON "pages_blocks_work_quiz" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "pages_blocks_work_quiz_path_idx" ON "pages_blocks_work_quiz" ("_path");

      CREATE TABLE IF NOT EXISTS "_pages_v_blocks_work_quiz" (
        "_order" integer NOT NULL,
        "_parent_id" integer NOT NULL,
        "_path" text NOT NULL,
        "id" serial PRIMARY KEY,
        "work" varchar,
        "chapter" varchar,
        "_uuid" varchar,
        "block_name" varchar,
        CONSTRAINT "_pages_v_blocks_work_quiz_parent_id_fk"
          FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_work_quiz_order_idx" ON "_pages_v_blocks_work_quiz" ("_order");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_work_quiz_parent_id_idx" ON "_pages_v_blocks_work_quiz" ("_parent_id");
      CREATE INDEX IF NOT EXISTS "_pages_v_blocks_work_quiz_path_idx" ON "_pages_v_blocks_work_quiz" ("_path");
    `),
  )
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DROP TABLE IF EXISTS "_pages_v_blocks_work_quiz";
      DROP TABLE IF EXISTS "pages_blocks_work_quiz";
    `),
  )
}
