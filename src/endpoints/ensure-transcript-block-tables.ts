/**
 * DB setup: Transcript block tables + RAG index — GET/POST /api/provision-ops/ensure-transcript-block-tables
 *
 * Provisions:
 *   1. Payload block tables for `transcript` on BOTH `posts` and `pages`
 *      (live `*_blocks_transcript` and versioned `_*_v_blocks_transcript`).
 *   2. The `post_transcript_chunks` table with a Postgres `tsvector` GIN full-text
 *      search index (`search_tsv`), JSONB embedding storage (`embedding_json`), and
 *      optional `pgvector` `vector(768)` HNSW index if the `vector` extension is available.
 *
 * ⚠️ 2-DEPLOY RULE: Deploy and execute this endpoint on prod BEFORE registering
 * `Transcript` in `src/collections/Posts/index.ts` or `src/collections/Pages/index.ts`.
 *
 * Query: ?collection=posts|pages|all (default all). Auth: super_admin OR ?key=<CRON_SECRET>.
 * Idempotent.
 */
import type { PayloadHandler } from 'payload'

export const TRANSCRIPT_COLLECTIONS = ['posts', 'pages'] as const
export type TranscriptCollection = (typeof TRANSCRIPT_COLLECTIONS)[number]

/**
 * Generate the full DDL for one collection's Transcript block tables (live + versioned).
 */
export function transcriptBlockStatements(base: TranscriptCollection): string[] {
  const v = `_${base}_v`
  return [
    // ── live: block wrapper (id = varchar PK, has _path + block_name) ────────────
    `CREATE TABLE IF NOT EXISTS "${base}_blocks_transcript" (
       "_order" integer NOT NULL,
       "_parent_id" integer NOT NULL,
       "_path" text NOT NULL,
       "id" varchar PRIMARY KEY NOT NULL,
       "heading" varchar DEFAULT 'Full Video Transcript',
       "video_url" varchar,
       "source_label" varchar,
       "language" varchar DEFAULT 'en',
       "default_collapsed" boolean DEFAULT true,
       "enable_search" boolean DEFAULT true,
       "word_count" numeric,
       "duration_label" varchar,
       "full_text" varchar,
       "segments" jsonb,
       "block_name" varchar
     );`,
    `CREATE INDEX IF NOT EXISTS "${base}_blocks_transcript_order_idx" ON "${base}_blocks_transcript" ("_order");`,
    `CREATE INDEX IF NOT EXISTS "${base}_blocks_transcript_parent_id_idx" ON "${base}_blocks_transcript" ("_parent_id");`,
    `CREATE INDEX IF NOT EXISTS "${base}_blocks_transcript_path_idx" ON "${base}_blocks_transcript" ("_path");`,
    `DO $$ BEGIN
       ALTER TABLE "${base}_blocks_transcript" ADD CONSTRAINT "${base}_blocks_transcript_parent_id_fk"
         FOREIGN KEY ("_parent_id") REFERENCES "${base}"("id") ON DELETE CASCADE;
     EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    // ── versioned: block wrapper (id = serial PK, + _uuid; _parent_id → _<coll>_v) ──
    `CREATE SEQUENCE IF NOT EXISTS "${v}_blocks_transcript_id_seq";`,
    `CREATE TABLE IF NOT EXISTS "${v}_blocks_transcript" (
       "_order" integer NOT NULL,
       "_parent_id" integer NOT NULL,
       "_path" text NOT NULL,
       "id" integer PRIMARY KEY DEFAULT nextval('${v}_blocks_transcript_id_seq') NOT NULL,
       "heading" varchar DEFAULT 'Full Video Transcript',
       "video_url" varchar,
       "source_label" varchar,
       "language" varchar DEFAULT 'en',
       "default_collapsed" boolean DEFAULT true,
       "enable_search" boolean DEFAULT true,
       "word_count" numeric,
       "duration_label" varchar,
       "full_text" varchar,
       "segments" jsonb,
       "_uuid" varchar,
       "block_name" varchar
     );`,
    `ALTER SEQUENCE "${v}_blocks_transcript_id_seq" OWNED BY "${v}_blocks_transcript"."id";`,
    `CREATE INDEX IF NOT EXISTS "${v}_blocks_transcript_order_idx" ON "${v}_blocks_transcript" ("_order");`,
    `CREATE INDEX IF NOT EXISTS "${v}_blocks_transcript_parent_id_idx" ON "${v}_blocks_transcript" ("_parent_id");`,
    `CREATE INDEX IF NOT EXISTS "${v}_blocks_transcript_path_idx" ON "${v}_blocks_transcript" ("_path");`,
    `DO $$ BEGIN
       ALTER TABLE "${v}_blocks_transcript" ADD CONSTRAINT "${v}_blocks_transcript_parent_id_fk"
         FOREIGN KEY ("_parent_id") REFERENCES "${v}"("id") ON DELETE CASCADE;
     EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  ]
}

const RAG_CHUNK_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "post_transcript_chunks" (
     "id" serial PRIMARY KEY,
     "post_id" integer NOT NULL,
     "tenant_id" integer,
     "post_slug" varchar NOT NULL,
     "post_title" varchar NOT NULL,
     "block_id" varchar,
     "chunk_index" integer NOT NULL,
     "start_sec" integer,
     "end_sec" integer,
     "video_url" varchar,
     "content" text NOT NULL,
     "search_tsv" tsvector GENERATED ALWAYS AS (
       setweight(to_tsvector('english', coalesce("post_title", '')), 'B') ||
       setweight(to_tsvector('english', coalesce("content", '')), 'A')
     ) STORED,
     "embedding_json" jsonb,
     "updated_at" timestamptz NOT NULL DEFAULT now()
   );`,
  `DO $$ BEGIN
     ALTER TABLE "post_transcript_chunks" ADD CONSTRAINT "post_transcript_chunks_post_id_fk"
       FOREIGN KEY ("post_id") REFERENCES "posts"("id") ON DELETE CASCADE;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE INDEX IF NOT EXISTS "post_transcript_chunks_post_id_idx" ON "post_transcript_chunks" ("post_id");`,
  `CREATE INDEX IF NOT EXISTS "post_transcript_chunks_tenant_id_idx" ON "post_transcript_chunks" ("tenant_id");`,
  `CREATE INDEX IF NOT EXISTS "post_transcript_chunks_tsv_idx" ON "post_transcript_chunks" USING GIN ("search_tsv");`,
]

function requiredTablesFor(collections: TranscriptCollection[]): string[] {
  const tables: string[] = ['post_transcript_chunks']
  for (const base of collections) {
    tables.push(`${base}_blocks_transcript`, `_${base}_v_blocks_transcript`)
  }
  return tables
}

export const ensureTranscriptBlockTablesHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')
  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(
    user && ((user as { roles?: string[] }).roles || []).includes('super_admin'),
  )
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  const requested = (url.searchParams.get('collection') || 'all').toLowerCase()
  const collections: TranscriptCollection[] =
    requested === 'all'
      ? [...TRANSCRIPT_COLLECTIONS]
      : TRANSCRIPT_COLLECTIONS.filter((c) => c === requested)
  if (collections.length === 0) {
    return Response.json(
      { error: `collection must be one of: all, ${TRANSCRIPT_COLLECTIONS.join(', ')}` },
      { status: 400 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = (payload.db as any)?.pool
  if (!pool?.query) {
    return Response.json({ error: 'no pg pool on payload.db' }, { status: 500 })
  }

  const statements: string[] = []
  for (const base of collections) {
    statements.push(...transcriptBlockStatements(base))
  }
  statements.push(...RAG_CHUNK_STATEMENTS)

  let ran = 0
  const errors: Array<{ i: number; statement: string; error: string }> = []
  for (let i = 0; i < statements.length; i++) {
    try {
      await pool.query(statements[i])
      ran++
    } catch (e) {
      errors.push({
        i,
        statement: statements[i].trim().slice(0, 80),
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  // Optional graceful pgvector probe (never fails provisioning if unavailable)
  let pgvectorAvailable = false
  let pgvectorNote = 'not checked'
  try {
    await pool.query(`CREATE EXTENSION IF NOT EXISTS vector;`)
    await pool.query(
      `ALTER TABLE "post_transcript_chunks" ADD COLUMN IF NOT EXISTS "embedding" vector(768);`,
    )
    await pool.query(
      `CREATE INDEX IF NOT EXISTS "post_transcript_chunks_embedding_idx" ON "post_transcript_chunks" USING hnsw ("embedding" vector_cosine_ops);`,
    )
    pgvectorAvailable = true
    pgvectorNote = 'pgvector enabled with vector(768) HNSW index'
  } catch (e) {
    pgvectorAvailable = false
    pgvectorNote = `pgvector unavailable (${e instanceof Error ? e.message : String(e)}); using GIN tsvector + embedding_json fallback`
  }

  const expected = requiredTablesFor(collections)
  let existingTables: string[] = []
  let tablesExist = false
  try {
    const res = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1) ORDER BY table_name`,
      [expected],
    )
    existingTables = (res.rows || []).map((r: { table_name: string }) => r.table_name)
    tablesExist = existingTables.length === expected.length
  } catch {
    tablesExist = false
  }

  return Response.json({
    ok: errors.length === 0 && tablesExist,
    collections,
    tablesExist,
    existingTables,
    expectedTables: expected,
    pgvectorAvailable,
    pgvectorNote,
    ran,
    total: statements.length,
    errors,
  })
}
