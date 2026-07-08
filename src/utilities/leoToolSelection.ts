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
  'configure_business', 'configure_endeavor', 'set_endeavor_image', 'set_work_attribution', 'update_theme_settings', 'update_navigation',
  'create_membership_plan', 'delete_membership_plan', 'apply_site_template',
  'configure_availability', 'configure_service', 'configure_payment_method',
  'research_and_provision', 'provision_tenant', 'clone_portal', 'onboard_vendor', 'manage_categories',
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
  'list_contacts',
])

/** True only if every tool in the round is a pure read (→ safe to parallelize). */
export function allReadOnly(names: string[]): boolean {
  return names.length > 0 && names.every((n) => READ_ONLY_TOOLS.has(n))
}

/**
 * Lean core toolset for SMALL / FREE providers (Groq free tier, local 8GB).
 *
 * Why: LEO's full ~95-122 tool schemas are ~10k+ tokens. Groq's free tier caps
 * at 8000 tokens/minute, so a full-payload request 413s ("request too large for
 * model gpt-oss-20b … Limit 8000, Requested 12234"). These ~18 tools cover the
 * bulk of conversational turns (queries + content + booking + messaging) and
 * keep the request well under budget. Power tools (admin, financial, CRM,
 * federation ops) are dropped on the small tier — those turns escalate to the
 * gateway (full tools) on the deep-think rounds anyway.
 */
export const CORE_TOOL_NAMES = new Set<string>([
  // Querying (read)
  'query_products', 'query_posts', 'query_spaces', 'query_bookings',
  'query_events', 'query_orders', 'query_knowledge', 'query_navigation',
  'query_federation', 'lookup_scripture',
  // Booking
  'check_available_slots', 'create_booking',
  // Content
  'create_post', 'create_post_from_media', 'create_page', 'update_page', 'update_post',
  // Comms + media
  'send_message', 'list_contacts', 'message_contact', 'generate_image',
  // Context
  'get_enterprise_stage', 'my_place',
])

/**
 * Subset tools by the resolved model. Small/free providers (groq/*, ollama/*)
 * get only CORE_TOOL_NAMES so the request fits their tight token budget; every
 * other provider (the cloud gateway) gets the full list it was given.
 */
export function selectToolsForModel<T extends { name: string }>(tools: T[], modelId: string): T[] {
  const isSmallProvider = modelId.startsWith('groq/') || modelId.startsWith('ollama/')
  if (!isSmallProvider) return tools
  return tools.filter((t) => CORE_TOOL_NAMES.has(t.name))
}
