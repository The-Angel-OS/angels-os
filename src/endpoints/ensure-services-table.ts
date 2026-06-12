/**
 * DB setup: services table — GET /api/provision-ops/ensure-services-table
 *
 * Same rationale as ensure-token-tables: prod runs neither Payload push nor
 * deploy-time migrations, so a new collection's TABLE must be created explicitly.
 * Idempotently creates the `services` table + its booking_type enum via the
 * deployment's own pool, matching Payload's pg conventions. Pair with
 * db-repair-locks (adds services_id to the rels table).
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Idempotent.
 *
 * @see src/endpoints/ensure-token-tables.ts
 */
import type { PayloadHandler } from 'payload'

const STATEMENTS: string[] = [
  `DO $$ BEGIN CREATE TYPE enum_services_booking_type AS ENUM ('service','consultation','rental','class','event','custom'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE TABLE IF NOT EXISTS "services" (
     "id" serial PRIMARY KEY NOT NULL,
     "tenant_id" integer NOT NULL,
     "service_id" varchar NOT NULL,
     "label" varchar NOT NULL,
     "description" varchar,
     "image_id" integer,
     "booking_type" enum_services_booking_type DEFAULT 'service',
     "price_usd" numeric NOT NULL,
     "deposit_percent" numeric DEFAULT 20 NOT NULL,
     "duration_minutes" numeric DEFAULT 60 NOT NULL,
     "enabled" boolean DEFAULT true,
     "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
     "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
   );`,
  `CREATE INDEX IF NOT EXISTS "services_tenant_idx" ON "services" ("tenant_id");`,
  `CREATE INDEX IF NOT EXISTS "services_service_id_idx" ON "services" ("service_id");`,
  `CREATE INDEX IF NOT EXISTS "services_enabled_idx" ON "services" ("enabled");`,
]

export const ensureServicesTableHandler: PayloadHandler = async (req) => {
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
  try {
    const res = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'services'`)
    tableExists = res.rows.length > 0
  } catch { /* best-effort */ }

  return Response.json({ ok: errors.length === 0, ran: ran.length, tableExists, errors })
}
