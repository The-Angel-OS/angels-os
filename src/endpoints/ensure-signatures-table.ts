/**
 * DB setup: signatures table — GET /api/provision-ops/ensure-signatures-table
 *
 * Same rationale as ensure-token-tables / ensure-services-table: prod runs neither
 * Payload push nor deploy-time migrations, so a new collection's TABLE must be
 * created explicitly. Idempotently creates the `signatures` table + its two enums,
 * matching Payload's pg conventions (enum_<table>_<field>, <rel>_id columns).
 * Pair with db-repair-locks (adds signatures_id to payload_locked_documents_rels).
 *
 * The Signatures collection is all scalars + two SINGLE relationships (tenant,
 * signer) with no drafts/versions — so there is no array/relationship junction
 * table and no _signatures_v table to author (the hand-rolled-rel-table footgun
 * is avoided). Run on BOTH prod DBs BEFORE the config that references it deploys.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Idempotent.
 *
 * @see src/endpoints/ensure-token-tables.ts
 * @see src/endpoints/db-repair-locks.ts
 */
import type { PayloadHandler } from 'payload'

const STATEMENTS: string[] = [
  `DO $$ BEGIN CREATE TYPE enum_signatures_document_type AS ENUM ('agreement','waiver','booking','tos','constitution','form','other'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `DO $$ BEGIN CREATE TYPE enum_signatures_signature_type AS ENUM ('typed','drawn'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  `CREATE TABLE IF NOT EXISTS "signatures" (
     "id" serial PRIMARY KEY NOT NULL,
     "tenant_id" integer NOT NULL,
     "signer_name" varchar NOT NULL,
     "signer_id" integer,
     "document_type" enum_signatures_document_type DEFAULT 'agreement',
     "document_ref" varchar NOT NULL,
     "document_title" varchar,
     "document_checksum" varchar NOT NULL,
     "signature_type" enum_signatures_signature_type DEFAULT 'typed' NOT NULL,
     "signature_data" varchar NOT NULL,
     "content_hash" varchar,
     "signed_at" timestamp(3) with time zone NOT NULL,
     "ip_address" varchar,
     "user_agent" varchar,
     "metadata" jsonb,
     "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
     "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
   );`,
  `CREATE INDEX IF NOT EXISTS "signatures_tenant_idx" ON "signatures" ("tenant_id");`,
  `CREATE INDEX IF NOT EXISTS "signatures_signer_idx" ON "signatures" ("signer_id");`,
  `CREATE INDEX IF NOT EXISTS "signatures_document_type_idx" ON "signatures" ("document_type");`,
  `CREATE INDEX IF NOT EXISTS "signatures_document_ref_idx" ON "signatures" ("document_ref");`,
  `CREATE INDEX IF NOT EXISTS "signatures_content_hash_idx" ON "signatures" ("content_hash");`,
  // Lock-check column so writes that pass a `req` don't fail on the missing rel col.
  `ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "signatures_id" integer;`,
]

export const ensureSignaturesTableHandler: PayloadHandler = async (req) => {
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
    const res = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'signatures'`)
    tableExists = res.rows.length > 0
  } catch { /* best-effort */ }

  return Response.json({ ok: errors.length === 0, ran: ran.length, tableExists, errors })
}
