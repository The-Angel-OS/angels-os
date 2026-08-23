/**
 * DB setup: works table — GET /api/provision-ops/ensure-works-table
 *
 * Same rationale as ensure-services-table / ensure-token-tables: prod runs
 * neither Payload push nor deploy-time migrations, so a new collection's TABLE
 * must be created explicitly. Idempotently creates the `works` table + its type
 * enum AND adds `works_id` to payload_locked_documents_rels (without that column,
 * the lock-check query Payload generates for ANY write fails site-wide — the
 * documented drift incident). Pair with db-repair-locks as belt-and-suspenders.
 *
 * Works is json-heavy (tags/canonical/subscribers/storageRef = jsonb) so there
 * are NO array sub-tables to create.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Idempotent.
 *
 * @see src/endpoints/ensure-services-table.ts  @see src/collections/Works/index.ts
 */
import type { PayloadHandler } from 'payload'

const STATEMENTS: string[] = [
  `DO $$ BEGIN CREATE TYPE enum_works_type AS ENUM ('document','book'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE TABLE IF NOT EXISTS "works" (
     "id" serial PRIMARY KEY NOT NULL,
     "slug" varchar NOT NULL,
     "title" varchar NOT NULL,
     "subtitle" varchar,
     "description" varchar,
     "type" enum_works_type DEFAULT 'document',
     "status" varchar,
     "status_color" varchar,
     "tags" jsonb,
     "canonical" jsonb,
     "owner" varchar,
     "subscribers" jsonb,
     "published" boolean DEFAULT false,
     "available_globally" boolean DEFAULT false,
     "default_doc" varchar,
     "links" jsonb,
     "opt_outs" jsonb,
     "cover_id" integer,
     "storage_ref" jsonb,
     "checksum" varchar,
     "json_version" varchar DEFAULT 'work.v1',
     "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
     "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
   );`,
  // Pre-existing tables predate 20260824_100000_works_availability.
  `ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "published" boolean DEFAULT false;`,
  `ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "available_globally" boolean DEFAULT false;`,
  `ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "default_doc" varchar;`,
  `ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "links" jsonb;`,
  `ALTER TABLE "works" ADD COLUMN IF NOT EXISTS "opt_outs" jsonb;`,
  `CREATE INDEX IF NOT EXISTS "works_slug_idx" ON "works" ("slug");`,
  `CREATE INDEX IF NOT EXISTS "works_type_idx" ON "works" ("type");`,
  `CREATE INDEX IF NOT EXISTS "works_owner_idx" ON "works" ("owner");`,
  `CREATE INDEX IF NOT EXISTS "works_checksum_idx" ON "works" ("checksum");`,
  // CRITICAL: the lock-check query references this column for every write. Without
  // it, adding the Works collection to the config breaks ALL writes site-wide.
  `ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "works_id" integer;`,
]

export const ensureWorksTableHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')

  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(user && ((user as { roles?: string[] }).roles || []).includes('super_admin'))
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) {
    return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = (payload.db as any)?.pool
  if (!pool?.query) return Response.json({ error: 'no pg pool on payload.db' }, { status: 500 })

  const ran: number[] = []
  const errors: Array<{ i: number; error: string }> = []
  for (let i = 0; i < STATEMENTS.length; i++) {
    try { await pool.query(STATEMENTS[i]); ran.push(i) } catch (e) {
      errors.push({ i, error: e instanceof Error ? e.message : String(e) })
    }
  }

  let tableExists = false
  let locksColumn = false
  try {
    const t = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'works'`)
    tableExists = t.rows.length > 0
    const c = await pool.query(`SELECT 1 FROM information_schema.columns WHERE table_name = 'payload_locked_documents_rels' AND column_name = 'works_id'`)
    locksColumn = c.rows.length > 0
  } catch { /* best-effort */ }

  return Response.json({ ok: errors.length === 0, ran: ran.length, tableExists, locksColumn, errors })
}
