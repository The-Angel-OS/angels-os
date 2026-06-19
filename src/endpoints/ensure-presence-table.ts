/**
 * DB setup: presence table — GET /api/provision-ops/ensure-presence-table
 *
 * Same rationale as ensure-token-tables / ensure-services-table: prod runs
 * neither Payload push nor deploy-time migrations, so a new collection's TABLE
 * must be created explicitly. The presence collection (MMORPG-hub Slice 1a)
 * shipped its migration but never landed on the live DBs, so /presence-ops/online
 * and /ping fail-soft every poll. This idempotently creates the `presence` table
 * (+ enum, FKs, indexes, locked-docs rel column) via the deployment's own pool,
 * mirroring src/migrations/20260607_220000_add_presence.ts. Reports the live
 * column set so column-drift (not just a missing table) is visible too.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Idempotent.
 *
 * @see src/endpoints/ensure-services-table.ts
 * @see src/migrations/20260607_220000_add_presence.ts
 */
import type { PayloadHandler } from 'payload'

const STATEMENTS: string[] = [
  `DO $$ BEGIN CREATE TYPE "public"."enum_presence_status" AS ENUM('online', 'away', 'offline'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE TABLE IF NOT EXISTS "presence" (
     "id" serial PRIMARY KEY NOT NULL,
     "user_id" integer NOT NULL,
     "status" "enum_presence_status" DEFAULT 'online',
     "last_seen_at" timestamp(3) with time zone NOT NULL,
     "space_id" integer,
     "path" varchar,
     "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
     "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
   );`,
  // Column-drift safety: re-assert each column on a table that may predate a field.
  `ALTER TABLE "presence" ADD COLUMN IF NOT EXISTS "status" "enum_presence_status" DEFAULT 'online';`,
  `ALTER TABLE "presence" ADD COLUMN IF NOT EXISTS "last_seen_at" timestamp(3) with time zone;`,
  `ALTER TABLE "presence" ADD COLUMN IF NOT EXISTS "space_id" integer;`,
  `ALTER TABLE "presence" ADD COLUMN IF NOT EXISTS "path" varchar;`,
  `ALTER TABLE "presence" ADD COLUMN IF NOT EXISTS "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL;`,
  `ALTER TABLE "presence" ADD COLUMN IF NOT EXISTS "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL;`,
  `DO $$ BEGIN ALTER TABLE "presence" ADD CONSTRAINT "presence_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN ALTER TABLE "presence" ADD CONSTRAINT "presence_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "presence_user_idx" ON "presence" USING btree ("user_id");`,
  `CREATE INDEX IF NOT EXISTS "presence_status_idx" ON "presence" USING btree ("status");`,
  `CREATE INDEX IF NOT EXISTS "presence_last_seen_at_idx" ON "presence" USING btree ("last_seen_at");`,
  `CREATE INDEX IF NOT EXISTS "presence_space_idx" ON "presence" USING btree ("space_id");`,
  `CREATE INDEX IF NOT EXISTS "presence_updated_at_idx" ON "presence" USING btree ("updated_at");`,
  `CREATE INDEX IF NOT EXISTS "presence_created_at_idx" ON "presence" USING btree ("created_at");`,
  `ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "presence_id" integer;`,
  `DO $$ BEGIN ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_presence_fk" FOREIGN KEY ("presence_id") REFERENCES "public"."presence"("id") ON DELETE cascade ON UPDATE no action; EXCEPTION WHEN duplicate_object THEN null; END $$;`,
]

export const ensurePresenceTableHandler: PayloadHandler = async (req) => {
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
  let columns: string[] = []
  try {
    const res = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'presence' ORDER BY ordinal_position`,
    )
    columns = res.rows.map((r: { column_name: string }) => r.column_name)
    tableExists = columns.length > 0
  } catch { /* best-effort */ }

  return Response.json({ ok: errors.length === 0, ran: ran.length, tableExists, columns, errors })
}
