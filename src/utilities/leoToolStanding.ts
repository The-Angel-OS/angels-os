/**
 * What standing a LEO tool requires — the authorization the system prompt used
 * to ask for politely.
 *
 * Before this, ~11 of 174 tools checked who was asking; the rest ran with
 * `overrideAccess: true` and relied on a paragraph telling the model to respect
 * access levels. A model choosing the wrong argument was the only thing between
 * a signed-in visitor and a portal's orders. Prompts are not a security boundary.
 *
 * Four rungs, each containing the ones below it:
 *   anonymous — a public read any visitor could do by browsing the site
 *   member    — signed in, acting on their OWN records
 *   manager   — runs this portal (tenant_admin, or a manage_* permission)
 *   platform  — super_admin: provisioning, fees, other portals, raw SQL
 *
 * Anything not listed is `manager` on purpose: for a new tool, "only the people
 * who run this portal" is the safe default, and `leoToolStanding.test.ts` fails
 * on any tool whose standing was never considered.
 */

export type Standing = 'anonymous' | 'member' | 'manager' | 'platform'

const RANK: Record<Standing, number> = { anonymous: 0, member: 1, manager: 2, platform: 3 }

/** Is `held` enough for `required`? */
export function standingMeets(held: Standing, required: Standing): boolean {
  return RANK[held] >= RANK[required]
}

/** Public reads — the same facts the website shows a visitor who never logs in. */
const ANONYMOUS: string[] = [
  'query_products', 'query_posts', 'query_events', 'query_site_content', 'query_navigation',
  'query_knowledge', 'recommend_products', 'suggest_products',
  'check_available_slots', 'query_availability', 'list_availability',
  'list_membership_plans', 'get_theme_settings', 'get_page_hero',
  'lookup_scripture', 'get_daily_bread', 'open_passage',
  'add_to_cart', 'view_cart',
  'web_search', 'find_google_place', 'verify_address',
  'browse_network', 'browse_federation_peers', 'discover_federation_products',
  'query_peer_catalog', 'search_federation_wide', 'query_federation',
  'find_producers', 'find_synchronicities',
  // Inbound actions a visitor legitimately performs on a public site: the /book
  // page and the contact form already accept both from anyone, and each writes
  // only the visitor's own data. Slot validity is BookingEngine's job, not this
  // gate's. Reading or changing an EXISTING booking stays at member.
  'create_booking', 'capture_lead',
  // "What's on here?" is the question a visitor asks BEFORE signing up.
  'whats_on',
]

/**
 * Signed in, acting on their own records. Every tool here MUST scope to
 * `ctx.userId` internally — standing says who may call it, not what it returns.
 */
const MEMBER: string[] = [
  'my_place', 'get_agenda', 'sign_constitution',
  'list_contacts', 'save_contact', 'message_contact', 'send_direct_message',
  'cancel_booking', 'reschedule_booking', 'query_bookings',
  'query_orders', 'query_spaces',
  'escalate_issue', 'leo_handoff',
  // Self-serve: making your OWN Angel is a thing a signed-in person does, with a
  // runaway cap inside the tool rather than a role in front of it.
  'commission_endeavor',
  // Member surfaces — a person's own view of the portal they belong to.
  'register_for_event', 'my_threads', 'ask_the_room',
]

/** super_admin: provisioning, money at the platform level, other portals, raw SQL. */
const PLATFORM: string[] = [
  'provision_tenant', 'clone_portal', 'decommission_tenant', 'research_and_provision',
  'request_endeavor_migration', 'classify_endeavor',
  'check_endeavor_onboarding', 'intake_prospect', 'get_portal_invites',
  'set_platform_fee', 'platform_solvency', 'check_solvency', 'check_fees',
  'query_sql', 'query_application_logs', 'check_node_health', 'get_node_stats',
  'list_node_files', 'check_enterprise_health', 'get_enterprise_stage',
  'federation_pulse', 'ping_federation', 'broadcast_federation_message',
  'send_federation_message', 'route_federated_request', 'broadcast_capability',
  'set_holon_profile', 'run_subsafe_check', 'set_work_attribution',
  'send_emergency_alert',
]

/**
 * Runs this portal. The bulk of the registry: content, commerce, configuration,
 * outbound messaging — everything that acts AS the business rather than as a
 * person. Listed explicitly rather than left to the default so the completeness
 * test can tell "decided" from "forgotten".
 */
const MANAGER: string[] = [
  'accept_order', 'add_calendar_to_page', 'add_gallery_to_page', 'analyze_image',
  'analyze_trends', 'apply_inventory_count', 'apply_site_template', 'attach_image_to_product',
  'combine_images', 'complete_enlistment', 'configure_availability',
  'configure_business', 'configure_endeavor', 'configure_payment_method', 'configure_service',
  'connect_stripe_account', 'connector_health_summary', 'create_announcement',
  'create_customer_profile', 'create_event', 'create_form', 'create_membership_plan',
  'create_page', 'create_post', 'create_post_from_media', 'create_product', 'create_quest',
  'create_space', 'create_work_from_url', 'delegate_task', 'delete_membership_plan',
  'disconnect_stripe_account', 'dispatch_to_channel', 'document_incident',
  'draft_review_response', 'edit_image_text', 'extract_pdf_pages', 'fetch_reviews',
  'generate_cad_instructions', 'generate_image', 'generate_invoice',
  'generate_theme_aware_image', 'import_google_contacts', 'improve_image',
  'ingest_youtube_channel', 'ingest_youtube_url', 'invite_member', 'issue_refund',
  'list_channel_media', 'log_interaction', 'log_maintenance_note', 'manage_categories',
  'moderate_content', 'negotiate_deal', 'onboard_vendor', 'payload_create', 'payload_delete',
  'payload_find', 'payload_update', 'post_card_directive', 'query_board_members',
  'query_booking_revenue', 'query_event_registrations', 'query_financial_reports',
  'query_form_submissions', 'query_inventory_history', 'query_media', 'query_projects',
  'replace_image', 'route_order', 'segment_customers', 'send_email', 'send_follow_up',
  'send_gotify', 'send_inline_form', 'send_message', 'send_slack', 'send_sms', 'send_telegram',
  'send_whatsapp', 'set_availability', 'set_endeavor_image', 'set_low_stock_alert',
  'set_page_hero', 'set_portal_branding', 'track_inventory_movement', 'track_soul',
  'update_booking_status', 'update_fulfillment', 'update_inventory', 'update_navigation',
  'update_page', 'update_post', 'update_product', 'update_theme_settings',
]

const EXPLICIT: Record<string, Standing> = {}
for (const t of ANONYMOUS) EXPLICIT[t] = 'anonymous'
for (const t of MEMBER) EXPLICIT[t] = 'member'
for (const t of MANAGER) EXPLICIT[t] = 'manager'
for (const t of PLATFORM) EXPLICIT[t] = 'platform'

/** The standing a tool requires. Unlisted ⇒ manager (the safe default). */
export function standingFor(toolName: string): Standing {
  return EXPLICIT[toolName] ?? 'manager'
}

/** Only for the completeness test — not a runtime surface. */
export const DECLARED_TOOLS = EXPLICIT

/* ────────────────────────────────────────────────────────────────────────── */

import type { Payload } from 'payload'

/** Portal-manager roles on a tenant membership. Mirrors connectorAccess. */
const MANAGER_MEMBERSHIP_ROLES = ['tenant_admin', 'tenant_manager']
/** Membership permissions that amount to running the portal. */
const MANAGER_PERMISSIONS = ['manage_content', 'manage_products', 'manage_orders', 'manage_settings']
/** Platform roles. `archangel` and `admin` see across portals by design. */
const PLATFORM_ROLES = ['super_admin', 'admin', 'archangel']

/**
 * What standing the caller actually holds.
 *
 * Deliberately ONE query, and only when it can change the answer: a platform
 * role short-circuits, and an anonymous caller has nothing to look up.
 */
export async function resolveStanding(args: {
  payload: Payload
  userId?: number | string | null
  tenantId?: number | string | null
  roles?: string[]
}): Promise<Standing> {
  const { payload, userId, tenantId, roles } = args
  if ((roles ?? []).some((r) => PLATFORM_ROLES.includes(r))) return 'platform'
  if (!userId) return 'anonymous'
  if (!tenantId) return 'member'

  try {
    const res = await payload.find({
      collection: 'tenant-memberships',
      where: {
        and: [
          { user: { equals: userId } },
          { tenant: { equals: tenantId } },
          { status: { equals: 'active' } },
        ],
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const m = res.docs?.[0] as { role?: string; permissions?: unknown } | undefined
    if (!m) return 'member'
    if (MANAGER_MEMBERSHIP_ROLES.includes(String(m.role))) return 'manager'
    const perms = Array.isArray(m.permissions) ? (m.permissions as string[]) : []
    if (perms.some((p) => MANAGER_PERMISSIONS.includes(p))) return 'manager'
    return 'member'
  } catch {
    // A membership lookup that fails must not promote anyone.
    return 'member'
  }
}

/** The refusal handed back to the model — plain, and never a hint to retry. */
export function standingRefusal(toolName: string, required: Standing): string {
  const who: Record<Standing, string> = {
    anonymous: 'anyone',
    member: 'a signed-in member',
    manager: 'someone who runs this portal',
    platform: 'a platform administrator',
  }
  return `Error: ${toolName} is available to ${who[required]}. You are not able to do this for the current user — say so plainly and offer what you CAN do instead. Do not retry this tool.`
}
