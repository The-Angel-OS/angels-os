/**
 * DB Repair: locked-documents rels — GET /api/provision-ops/db-repair-locks
 *
 * Prod uses dev-push (not formal migrations), which is unreliable for the
 * payload_locked_documents_rels join table: when a new collection is added to
 * the config, its `<collection>_id` column may never land in that table. Payload
 * then GENERATES a lock-check query referencing the missing column → EVERY write
 * that checks a document lock fails (bookings deposit, the seed, admin edits).
 *
 * This idempotently ensures every rels column exists (ADD COLUMN IF NOT EXISTS).
 * Safe to run repeatedly. Auth: super_admin OR ?key=<CRON_SECRET>.
 */
import type { PayloadHandler } from 'payload'

// Every `<collection>_id` column the current config expects on the rels table.
// Adding one that already exists is a no-op (IF NOT EXISTS), so the full list is
// fully idempotent and guarantees completeness in a single pass.
const REL_COLUMNS = [
  'tenants_id', 'users_id', 'tenant_memberships_id', 'spaces_id', 'space_memberships_id',
  'channels_id', 'messages_id', 'workflows_id', 'bookings_id', 'events_id',
  'event_registrations_id', 'availability_id', 'header_id', 'footer_id', 'site_settings_id',
  'pages_id', 'posts_id', 'projects_id', 'comments_id', 'presence_id', 'categories_id',
  'media_id', 'holon_capabilities_id', 'justice_fund_transactions_id', 'processed_stripe_events_id',
  'application_logs_id', 'cost_events_id', 'reviews_id', 'endeavors_id', 'federation_peers_id',
  'connectors_id', 'contacts_id', 'federation_audit_log_id', 'agent_transactions_id',
  'media_meta_id', 'street_signs_id', 'quests_id', 'quest_participations_id', 'board_members_id',
  'logistics_nodes_id', 'transports_id', 'shipments_id', 'pheromones_id', 'work_units_id',
  'crew_assignments_id', 'forms_id', 'form_submissions_id', 'addresses_id', 'variants_id',
  'variant_types_id', 'variant_options_id', 'products_id', 'carts_id', 'orders_id',
  'transactions_id', 'payload_mcp_api_keys_id', 'settings_id', 'permissions_id', 'vendors_id',
  'token_ledger_id', 'wallets_id', 'services_id',
]

const TABLE = 'payload_locked_documents_rels'

/**
 * Derive the full set of `<collection>_id` columns the LIVE config expects on the
 * rels table, by introspecting Payload's own drizzle schema. This is the exact
 * same source Payload uses to GENERATE the lock-check query — so whatever it will
 * query, we guarantee exists. Falls back to (and unions with) the static
 * REL_COLUMNS list so the repair is always a superset and can never regress, even
 * if introspection shape changes across Payload versions.
 */
function deriveRelColumns(payload: { db?: unknown }): string[] {
  const cols = new Set(REL_COLUMNS)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const relTable = (payload.db as any)?.tables?.[TABLE]
    if (relTable && typeof relTable === 'object') {
      for (const key of Object.keys(relTable)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const name = (relTable as any)[key]?.name
        // Only the FK relation columns (every one ends in _id); never parent_id,
        // which is the table's own self-reference, not a collection relation.
        if (typeof name === 'string' && name.endsWith('_id') && name !== 'parent_id') {
          cols.add(name)
        }
      }
    }
  } catch {
    /* introspection unavailable — static list still applies */
  }
  return [...cols]
}

export const dbRepairLocksHandler: PayloadHandler = async (req) => {
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

  // node-postgres Pool from the postgres adapter.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pool = (payload.db as any)?.pool
  if (!pool?.query) {
    return Response.json({ error: 'no pg pool on payload.db' }, { status: 500 })
  }

  const columns = deriveRelColumns(payload)

  // Which of those already exist? One catalog query, so we can report exactly
  // which columns this run actually had to create (the drift that was healed).
  const existing = new Set<string>()
  try {
    const res = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [TABLE],
    )
    for (const row of res.rows as Array<{ column_name: string }>) existing.add(row.column_name)
  } catch {
    /* if we can't introspect, fall through and just ADD IF NOT EXISTS everything */
  }

  const ensured: string[] = []
  const created: string[] = []
  const errors: Array<{ column: string; error: string }> = []
  for (const col of columns) {
    try {
      // IF NOT EXISTS → idempotent. Column names come from the config-derived/
      // static allow-list, never user input, so this interpolation is safe.
      await pool.query(`ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "${col}" integer;`)
      ensured.push(col)
      if (!existing.has(col)) created.push(col)
    } catch (e) {
      errors.push({ column: col, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return Response.json({
    ok: errors.length === 0,
    ensured: ensured.length,
    created, // columns that were actually missing and just got added
    derivedFromSchema: columns.length > REL_COLUMNS.length,
    errors,
  })
}
