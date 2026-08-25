import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * The `coursePlayer` and `courseStudio` blocks on Pages — one text field each,
 * plus the `_pages_v_` draft twins. @see src/blocks/CoursePlayer/config.ts
 */
const table = (name: string) => `
  CREATE TABLE IF NOT EXISTS "pages_blocks_${name}" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" varchar NOT NULL,
    "work" varchar,
    "block_name" varchar,
    CONSTRAINT "pages_blocks_${name}_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "pages_blocks_${name}_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "pages"("id") ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS "pages_blocks_${name}_order_idx" ON "pages_blocks_${name}" ("_order");
  CREATE INDEX IF NOT EXISTS "pages_blocks_${name}_parent_id_idx" ON "pages_blocks_${name}" ("_parent_id");
  CREATE INDEX IF NOT EXISTS "pages_blocks_${name}_path_idx" ON "pages_blocks_${name}" ("_path");

  CREATE TABLE IF NOT EXISTS "_pages_v_blocks_${name}" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "_path" text NOT NULL,
    "id" serial PRIMARY KEY,
    "work" varchar,
    "_uuid" varchar,
    "block_name" varchar,
    CONSTRAINT "_pages_v_blocks_${name}_parent_id_fk"
      FOREIGN KEY ("_parent_id") REFERENCES "_pages_v"("id") ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_${name}_order_idx" ON "_pages_v_blocks_${name}" ("_order");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_${name}_parent_id_idx" ON "_pages_v_blocks_${name}" ("_parent_id");
  CREATE INDEX IF NOT EXISTS "_pages_v_blocks_${name}_path_idx" ON "_pages_v_blocks_${name}" ("_path");
`

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql.raw(table('course_player') + table('course_studio')))
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(
    sql.raw(`
      DROP TABLE IF EXISTS "_pages_v_blocks_course_player";
      DROP TABLE IF EXISTS "pages_blocks_course_player";
      DROP TABLE IF EXISTS "_pages_v_blocks_course_studio";
      DROP TABLE IF EXISTS "pages_blocks_course_studio";
    `),
  )
}
