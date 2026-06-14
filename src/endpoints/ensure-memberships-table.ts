/**
 * DB setup: memberships table — GET /api/provision-ops/ensure-memberships-table
 *
 * Same rationale as ensure-signatures-table: prod runs no push/migrations, so a new
 * collection's TABLE must be created explicitly BEFORE the config referencing it
 * deploys. Idempotently creates `memberships` + its two enums + the
 * payload_locked_documents_rels.memberships_id lock column. All scalars + two single
 * relationships (tenant, member), no versions → no junction/_v table.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Idempotent.
 * @see src/endpoints/ensure-signatures-table.ts
 */
import type { PayloadHandler } from 'payload'

const STATEMENTS: string[] = [
  `DO $$ BEGIN CREATE TYPE enum_memberships_interval AS ENUM ('month','year'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE enum_memberships_status AS ENUM ('active','trialing','past_due','canceled','incomplete'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE TABLE IF NOT EXISTS "memberships" (
     "id" serial PRIMARY KEY NOT NULL,
     "tenant_id" integer NOT NULL,
     "member_id" integer,
     "member_email" varchar,
     "member_name" varchar,
     "plan_id" varchar,
     "plan_name" varchar,
     "amount_cents" numeric,
     "interval" enum_memberships_interval DEFAULT 'month',
     "status" enum_memberships_status DEFAULT 'incomplete',
     "stripe_subscription_id" varchar,
     "stripe_customer_id" varchar,
     "current_period_end" timestamp(3) with time zone,
     "started_at" timestamp(3) with time zone,
     "metadata" jsonb,
     "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
     "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
   );`,
  `CREATE INDEX IF NOT EXISTS "memberships_tenant_idx" ON "memberships" ("tenant_id");`,
  `CREATE INDEX IF NOT EXISTS "memberships_member_idx" ON "memberships" ("member_id");`,
  `CREATE INDEX IF NOT EXISTS "memberships_member_email_idx" ON "memberships" ("member_email");`,
  `CREATE INDEX IF NOT EXISTS "memberships_plan_id_idx" ON "memberships" ("plan_id");`,
  `CREATE INDEX IF NOT EXISTS "memberships_status_idx" ON "memberships" ("status");`,
  `CREATE INDEX IF NOT EXISTS "memberships_sub_id_idx" ON "memberships" ("stripe_subscription_id");`,
  `ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "memberships_id" integer;`,
]

export const ensureMembershipsTableHandler: PayloadHandler = async (req) => {
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
    const res = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'memberships'`)
    tableExists = res.rows.length > 0
  } catch { /* best-effort */ }

  return Response.json({ ok: errors.length === 0, ran: ran.length, tableExists, errors })
}
