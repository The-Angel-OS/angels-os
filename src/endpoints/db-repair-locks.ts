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
]

const TABLE = 'payload_locked_documents_rels'

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

  const added: string[] = []
  const errors: Array<{ column: string; error: string }> = []
  for (const col of REL_COLUMNS) {
    try {
      // IF NOT EXISTS → idempotent. Column name is from a fixed allow-list above,
      // never user input, so this static interpolation is safe.
      await pool.query(`ALTER TABLE "${TABLE}" ADD COLUMN IF NOT EXISTS "${col}" integer;`)
      added.push(col)
    } catch (e) {
      errors.push({ column: col, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return Response.json({ ok: errors.length === 0, ensured: added.length, errors })
}
