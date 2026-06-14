/**
 * DB setup: forms_blocks_signature — GET /api/provision-ops/ensure-form-signature-block
 *
 * Adding the custom `signature` field to the Form Builder plugin means Payload's
 * `forms.fields` blocks array gains a new block type, which drizzle expects to back
 * with a `forms_blocks_signature` table. Prod runs no push/migrations, so that table
 * must be created explicitly BEFORE the config deploys — otherwise EVERY forms read
 * (the contact form is on every tenant) would reference a missing table and fail.
 *
 * Shape mirrors the existing sibling block tables (forms_blocks_text/textarea)
 * exactly — same column conventions, PK on id, FK _parent_id → forms(id) CASCADE,
 * and the _order/_parent_id/_path indexes — plus this block's own field columns
 * (name, label, agreement_text, required, width).
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Idempotent.
 *
 * @see src/endpoints/ensure-services-table.ts
 */
import type { PayloadHandler } from 'payload'

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "forms_blocks_signature" (
     "_order" integer NOT NULL,
     "_parent_id" integer NOT NULL,
     "_path" text NOT NULL,
     "id" varchar PRIMARY KEY NOT NULL,
     "name" varchar NOT NULL,
     "label" varchar,
     "agreement_text" varchar,
     "required" boolean,
     "width" numeric,
     "block_name" varchar
   );`,
  `CREATE INDEX IF NOT EXISTS "forms_blocks_signature_order_idx" ON "forms_blocks_signature" ("_order");`,
  `CREATE INDEX IF NOT EXISTS "forms_blocks_signature_parent_id_idx" ON "forms_blocks_signature" ("_parent_id");`,
  `CREATE INDEX IF NOT EXISTS "forms_blocks_signature_path_idx" ON "forms_blocks_signature" ("_path");`,
  `DO $$ BEGIN
     ALTER TABLE "forms_blocks_signature"
       ADD CONSTRAINT "forms_blocks_signature_parent_id_fk"
       FOREIGN KEY ("_parent_id") REFERENCES "forms"("id") ON DELETE cascade;
   EXCEPTION WHEN duplicate_object THEN null; END $$;`,
]

export const ensureFormSignatureBlockHandler: PayloadHandler = async (req) => {
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
    const res = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_name = 'forms_blocks_signature'`)
    tableExists = res.rows.length > 0
  } catch { /* best-effort */ }

  return Response.json({ ok: errors.length === 0, ran: ran.length, tableExists, errors })
}
