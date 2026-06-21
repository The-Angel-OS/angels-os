/**
 * DB self-heal: payload_locked_documents_rels columns —
 * GET /api/provision-ops/ensure-locked-docs-rels
 *
 * Payload's document-LOCK feature keeps one polymorphic rel table,
 * `payload_locked_documents_rels`, with a `<collection>_id` column PER collection.
 * Every collection added grows this table by a column. Prod runs no push/migrations,
 * so when a new collection ships without that column being added on a given DB, the
 * lock query (`select ... from payload_locked_documents left join
 * payload_locked_documents_rels ... where <col> = $n`) throws on EVERY admin save of
 * ANY locked collection → "Failed query" 500 (e.g. pages/save on the angels DB,
 * 2026-06-20). The kendev DB had all columns; the older angels DB had drifted.
 *
 * This idempotently adds every expected `<collection>_id` column as integer
 * (IF NOT EXISTS). The lock query only needs column existence; locks are ephemeral
 * and low-volume, so FK/index are unnecessary for correctness. Re-runnable after any
 * new collection ships → self-heals future drift. Column list is taken verbatim from
 * the failing query so it matches Payload's generated table names exactly.
 *
 * Durable alternative (Answer 53): disable document locking (`lockDocuments: false`)
 * to remove this fragile per-collection mega-table entirely.
 *
 * Auth: super_admin OR ?key=<CRON_SECRET>. Idempotent.
 */
import type { PayloadHandler } from 'payload'

// Exact rel table names from the failing lock query (NOT collection slugs — Payload's
// generated names: globals header/footer/site_settings are singular, availability and
// presence are not pluralized, etc.).
const REL_TARGETS = [
  'tenants', 'users', 'tenant_memberships', 'spaces', 'space_memberships', 'channels',
  'messages', 'workflows', 'bookings', 'events', 'event_registrations', 'availability',
  'header', 'footer', 'site_settings', 'pages', 'posts', 'projects', 'comments',
  'presence', 'settings', 'permissions', 'vendors', 'categories', 'media',
  'holon_capabilities', 'justice_fund_transactions', 'processed_stripe_events',
  'application_logs', 'cost_events', 'reviews', 'endeavors', 'federation_peers',
  'connectors', 'contacts', 'federation_audit_log', 'agent_transactions', 'media_meta',
  'street_signs', 'quests', 'quest_participations', 'token_ledger', 'wallets',
  'signatures', 'memberships', 'services', 'works', 'board_members', 'logistics_nodes',
  'transports', 'shipments', 'pheromones', 'work_units', 'crew_assignments', 'forms',
  'form_submissions', 'addresses', 'variants', 'variant_types', 'variant_options',
  'products', 'carts', 'orders', 'transactions', 'payload_mcp_api_keys',
]

export const ensureLockedDocsRelsHandler: PayloadHandler = async (req) => {
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

  const added: string[] = []
  const errors: Array<{ col: string; error: string }> = []

  // discover what's already there so we report exactly what we added
  let existing = new Set<string>()
  try {
    const r = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'payload_locked_documents_rels'`,
    )
    existing = new Set(r.rows.map((x: { column_name: string }) => x.column_name))
  } catch { /* best-effort */ }

  for (const t of REL_TARGETS) {
    const col = `${t}_id`
    if (existing.has(col)) continue
    try {
      await pool.query(`ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "${col}" integer;`)
      added.push(col)
    } catch (e) {
      errors.push({ col, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return Response.json({ ok: errors.length === 0, added, addedCount: added.length, errors })
}
