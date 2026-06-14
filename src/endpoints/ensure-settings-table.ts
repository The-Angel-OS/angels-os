/**
 * DB setup: settings table — GET /api/provision-ops/ensure-settings-table
 *
 * ⚠️ The Settings collection (the Oqtane key/value bag behind SettingService:
 * feature flags, federation election persistence, membership plans, …) had NO table
 * on prod — prod runs no push/migrations, and this collection's table was never
 * provisioned, so EVERY settings read/write 500'd silently. This creates it
 * idempotently (+ the payload_locked_documents_rels.settings_id lock column).
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Idempotent.
 * @see src/services/SettingService.ts  @see src/collections/Settings
 */
import type { PayloadHandler } from 'payload'

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS "settings" (
     "id" serial PRIMARY KEY NOT NULL,
     "entity_name" varchar NOT NULL,
     "entity_id" varchar NOT NULL,
     "setting_name" varchar NOT NULL,
     "setting_value" varchar,
     "is_private" boolean DEFAULT false,
     "tenant_id" integer,
     "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
     "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
   );`,
  `CREATE INDEX IF NOT EXISTS "settings_entity_name_idx" ON "settings" ("entity_name");`,
  `CREATE INDEX IF NOT EXISTS "settings_entity_id_idx" ON "settings" ("entity_id");`,
  `CREATE INDEX IF NOT EXISTS "settings_setting_name_idx" ON "settings" ("setting_name");`,
  `CREATE INDEX IF NOT EXISTS "settings_tenant_idx" ON "settings" ("tenant_id");`,
  `ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "settings_id" integer;`,
]

export const ensureSettingsTableHandler: PayloadHandler = async (req) => {
  const { payload, user } = req
  const url = new URL(req.url || '', 'http://localhost')
  const secret = process.env.CRON_SECRET
  const key = url.searchParams.get('key')
  const authHeader = req.headers?.get('authorization') || ''
  const isSuperAdmin = Boolean(user && ((user as { roles?: string[] }).roles || []).includes('super_admin'))
  const keyOk = Boolean(secret && (key === secret || authHeader === `Bearer ${secret}`))
  if (!isSuperAdmin && !keyOk) return Response.json({ error: 'super_admin or valid key required' }, { status: 403 })

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
  let cols = 0
  try { const r = await pool.query(`SELECT count(*)::int n FROM information_schema.columns WHERE table_name='settings'`); cols = r.rows[0]?.n ?? 0 } catch { /* best-effort */ }
  return Response.json({ ok: errors.length === 0, ran: ran.length, settingsColumns: cols, errors })
}
