/**
 * leoToolSelection — which of LEO's ~120 tools to expose, and which are safe to
 * run concurrently.
 *
 * Two concerns, both conservative-by-design:
 *
 * 1. SUBSETTING. Sending every tool schema on every call costs prompt tokens and
 *    adds decision noise (more wrong tools to pick from). We hide clearly-admin /
 *    destructive / financial tools from *confirmed* non-admin users — who can't
 *    successfully call them anyway (server-side access control rejects them). The
 *    direction is safe: we only ever REMOVE admin tools from confirmed non-admins.
 *    Unknown roles → keep everything (never strip a tool we're unsure about).
 *
 * 2. PARALLELISM. Pure-read tools in one agentic round can run concurrently. This
 *    is an explicit allow-list (default = sequential): under-listing only forgoes
 *    a speedup; it never risks reordering a side-effecting call.
 */

/** Tools that mutate sensitive state or require elevated privilege. */
export const ADMIN_ONLY_TOOLS = new Set<string>([
  // raw data escape hatches
  'payload_create', 'payload_update', 'payload_delete',
  // financial / billing
  'connect_stripe_account', 'disconnect_stripe_account', 'issue_refund', 'generate_invoice',
  'query_financial_reports',
  // platform / tenant config
  'configure_business', 'configure_endeavor', 'update_theme_settings', 'update_navigation',
  'research_and_provision', 'provision_tenant', 'onboard_vendor', 'manage_categories',
  // moderation / governance / incident
  'moderate_content', 'send_emergency_alert', 'document_incident', 'run_subsafe_check',
  'sign_constitution', 'request_endeavor_migration',
  // federation operator actions
  'broadcast_capability', 'broadcast_federation_message', 'route_federated_request',
  // observability
  'query_application_logs', 'connector_health_summary',
])

function isPrivileged(roles?: string[]): boolean {
  // Unknown roles → assume privileged so we never strip a tool someone might need.
  if (!roles || roles.length === 0) return true
  return roles.includes('admin') || roles.includes('super_admin') || roles.includes('platform_admin')
}

/** Filter the tool list for a user's roles. Privileged users get the full set. */
export function selectToolsForUser<T extends { name: string }>(tools: T[], roles?: string[]): T[] {
  if (isPrivileged(roles)) return tools
  return tools.filter((t) => !ADMIN_ONLY_TOOLS.has(t.name))
}

/** Pure-read tools — safe to execute concurrently within one agentic round. */
export const READ_ONLY_TOOLS = new Set<string>([
  'query_products', 'query_posts', 'query_bookings', 'query_spaces', 'query_projects',
  'query_events', 'query_event_registrations', 'query_availability', 'query_orders',
  'query_media', 'query_knowledge', 'query_inventory_history', 'query_federation',
  'query_peer_catalog', 'query_navigation', 'query_form_submissions', 'query_board_members',
  'view_cart', 'check_fees', 'check_available_slots', 'check_enterprise_health',
  'get_theme_settings', 'get_page_hero', 'get_enterprise_stage',
  'find_producers', 'find_synchronicities', 'browse_network', 'browse_federation_peers',
  'search_federation_wide', 'discover_federation_products',
  'fetch_reviews', 'suggest_products', 'recommend_products', 'analyze_trends',
  'extract_pdf_pages', 'federation_pulse', 'my_place', 'payload_find',
])

/** True only if every tool in the round is a pure read (→ safe to parallelize). */
export function allReadOnly(names: string[]): boolean {
  return names.length > 0 && names.every((n) => READ_ONLY_TOOLS.has(n))
}
