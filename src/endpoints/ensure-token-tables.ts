/**
 * DB setup: token economy tables — GET /api/provision-ops/ensure-token-tables
 *
 * Prod does NOT run Payload push (tables for new collections never auto-create) and
 * has no formal migrations on deploy, so a freshly-added collection's TABLE must be
 * created explicitly — same situation the hero-columns endpoint handled for columns.
 * This idempotently creates the `token_ledger` + `wallets` tables (and their enum
 * types) matching Payload's postgres conventions (serial id, tenant_id integer,
 * select→enum_<table>_<field>, text→varchar, number→numeric, timestamptz). Runs
 * against the deployment's own pool, so each prod DB heals by URL — no shared creds.
 *
 * Pair with db-repair-locks (adds token_ledger_id/wallets_id to the rels table).
 * Auth: super_admin OR ?key=<CRON_SECRET>. Idempotent — safe to re-run.
 *
 * @see src/endpoints/ensure-tenant-hero-columns.ts  @see src/endpoints/db-repair-locks.ts
 */
import type { PayloadHandler } from 'payload'

// Each statement is idempotent (IF NOT EXISTS / guarded CREATE TYPE).
const STATEMENTS: string[] = [
  // ── enum types ───────────────────────────────────────────────
  `DO $$ BEGIN CREATE TYPE enum_token_ledger_token_kind AS ENUM ('AT','KC','LT'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE enum_token_ledger_direction AS ENUM ('credit','debit'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE enum_wallets_token_kind AS ENUM ('AT','KC','LT'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  // ── token_ledger ─────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "token_ledger" (
     "id" serial PRIMARY KEY NOT NULL,
     "tenant_id" integer NOT NULL,
     "account" varchar NOT NULL,
     "token_kind" enum_token_ledger_token_kind NOT NULL,
     "direction" enum_token_ledger_direction NOT NULL,
     "amount" numeric NOT NULL,
     "reason" varchar NOT NULL,
     "ref" varchar,
     "seq" numeric NOT NULL,
     "balance_after" numeric NOT NULL,
     "prev_hash" varchar NOT NULL,
     "hash" varchar NOT NULL,
     "at" varchar NOT NULL,
     "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
     "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
   );`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "token_ledger_hash_idx" ON "token_ledger" ("hash");`,
  `CREATE INDEX IF NOT EXISTS "token_ledger_tenant_idx" ON "token_ledger" ("tenant_id");`,
  `CREATE INDEX IF NOT EXISTS "token_ledger_account_idx" ON "token_ledger" ("account");`,
  `CREATE INDEX IF NOT EXISTS "token_ledger_ref_idx" ON "token_ledger" ("ref");`,
  `CREATE INDEX IF NOT EXISTS "token_ledger_seq_idx" ON "token_ledger" ("seq");`,
  // ── wallets ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "wallets" (
     "id" serial PRIMARY KEY NOT NULL,
     "tenant_id" integer NOT NULL,
     "account" varchar NOT NULL,
     "token_kind" enum_wallets_token_kind NOT NULL,
     "balance" numeric DEFAULT 0 NOT NULL,
     "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
     "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
   );`,
  `CREATE INDEX IF NOT EXISTS "wallets_tenant_idx" ON "wallets" ("tenant_id");`,
  `CREATE INDEX IF NOT EXISTS "wallets_account_idx" ON "wallets" ("account");`,
]

export const ensureTokenTablesHandler: PayloadHandler = async (req) => {
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
    try {
      await pool.query(STATEMENTS[i])
      ran.push(i)
    } catch (e) {
      errors.push({ i, error: e instanceof Error ? e.message : String(e) })
    }
  }

  // Report which tables now exist.
  let tables: string[] = []
  try {
    const res = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_name IN ('token_ledger','wallets')`,
    )
    tables = res.rows.map((r: { table_name: string }) => r.table_name)
  } catch {
    /* best-effort */
  }

  return Response.json({ ok: errors.length === 0, ran: ran.length, tables, errors })
}
