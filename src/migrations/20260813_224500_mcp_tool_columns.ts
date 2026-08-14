import { sql } from '@payloadcms/db-postgres'
import type { MigrateUpArgs, MigrateDownArgs } from '@payloadcms/db-postgres'

/**
 * `payload_mcp_api_keys` — 169 tool columns the config has and the database
 * never got.
 *
 * The MCP plugin renders ONE BOOLEAN PER TOOL as a per-key permission checkbox,
 * and this project generates its MCP tool list from LEO_TOOLS — so every LEO tool
 * added since the table was created is a column that exists in the config and not
 * in Postgres. The table had 3 tool columns against ~170 tools. Two of the three
 * are dead names (`run_subsafe`, `query_errors`, since auto-generated as
 * `run_subsafe_check` and `query_application_logs`).
 *
 * Symptom: `payload migrate:create` stops and asks whether each new column is a
 * create or a rename of one of the strays, which is unanswerable in a script and
 * is what blocked generating the partners migration.
 *
 * ⚠️ This closes today's gap but does not stop it reopening: a column per LEO tool
 * means EVERY new LEO tool is a schema migration. The durable fix is for the MCP
 * key to hold a list of allowed tool names instead of a column each — a change to
 * how the plugin is configured, not a data fix, and out of scope here.
 *
 * @see src/plugins/mcp.ts — `get tools()` builds the list from LEO_TOOLS
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_accept_order" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_add_calendar_to_page" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_add_gallery_to_page" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_add_to_cart" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_analyze_image" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_analyze_trends" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_apply_inventory_count" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_apply_site_template" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_attach_image_to_product" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_broadcast_capability" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_broadcast_federation_message" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_browse_federation_peers" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_browse_network" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_cancel_booking" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_capture_lead" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_check_available_slots" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_check_endeavor_onboarding" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_check_enterprise_health" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_check_fees" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_check_node_health" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_check_solvency" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_classify_endeavor" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_clone_portal" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_combine_images" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_commission_endeavor" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_complete_enlistment" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_configure_availability" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_configure_business" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_configure_endeavor" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_configure_payment_method" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_configure_service" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_connect_stripe_account" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_connector_health_summary" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_create_announcement" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_create_booking" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_create_customer_profile" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_create_event" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_create_form" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_create_membership_plan" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_create_page" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_create_post" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_create_post_from_media" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_create_product" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_create_quest" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_create_space" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_create_work_from_url" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_decommission_tenant" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_delegate_task" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_delete_membership_plan" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_disconnect_stripe_account" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_discover_federation_products" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_dispatch_to_channel" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_document_incident" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_draft_review_response" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_edit_image_text" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_escalate_issue" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_extract_pdf_pages" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_federation_pulse" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_fetch_reviews" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_find_producers" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_find_synchronicities" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_generate_cad_instructions" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_generate_image" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_generate_invoice" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_generate_theme_aware_image" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_get_agenda" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_get_daily_bread" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_get_enterprise_stage" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_get_node_stats" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_get_page_hero" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_get_theme_settings" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_import_google_contacts" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_improve_image" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_ingest_youtube_channel" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_ingest_youtube_url" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_invite_member" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_issue_refund" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_leo_handoff" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_list_availability" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_list_channel_media" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_list_contacts" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_list_membership_plans" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_list_node_files" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_log_interaction" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_log_maintenance_note" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_lookup_scripture" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_manage_categories" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_message_contact" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_moderate_content" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_my_place" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_negotiate_deal" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_onboard_vendor" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_open_passage" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_payload_create" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_payload_delete" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_payload_find" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_payload_update" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_ping_federation" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_platform_solvency" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_post_card_directive" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_provision_tenant" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_application_logs" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_availability" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_board_members" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_booking_revenue" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_bookings" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_event_registrations" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_events" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_federation" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_financial_reports" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_form_submissions" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_inventory_history" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_knowledge" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_media" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_navigation" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_orders" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_peer_catalog" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_posts" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_products" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_projects" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_site_content" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_spaces" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_sql" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_recommend_products" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_replace_image" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_request_endeavor_migration" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_reschedule_booking" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_research_and_provision" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_route_federated_request" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_route_order" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_run_subsafe_check" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_save_contact" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_search_federation_wide" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_segment_customers" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_send_direct_message" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_send_email" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_send_emergency_alert" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_send_federation_message" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_send_follow_up" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_send_gotify" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_send_inline_form" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_send_message" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_send_slack" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_send_sms" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_send_telegram" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_send_whatsapp" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_set_availability" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_set_endeavor_image" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_set_holon_profile" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_set_low_stock_alert" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_set_page_hero" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_set_platform_fee" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_set_portal_branding" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_set_work_attribution" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_sign_constitution" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_suggest_products" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_track_inventory_movement" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_track_soul" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_update_booking_status" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_update_fulfillment" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_update_inventory" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_update_navigation" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_update_page" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_update_post" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_update_product" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_update_theme_settings" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_verify_address" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_view_cart" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_web_search" boolean;

    -- Renamed upstream; the new names are among the columns added above.
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_errors";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_run_subsafe";
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_query_errors" boolean;
    ALTER TABLE "payload_mcp_api_keys" ADD COLUMN IF NOT EXISTS "payload_mcp_tool_run_subsafe" boolean;

    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_accept_order";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_add_calendar_to_page";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_add_gallery_to_page";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_add_to_cart";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_analyze_image";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_analyze_trends";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_apply_inventory_count";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_apply_site_template";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_attach_image_to_product";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_broadcast_capability";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_broadcast_federation_message";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_browse_federation_peers";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_browse_network";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_cancel_booking";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_capture_lead";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_check_available_slots";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_check_endeavor_onboarding";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_check_enterprise_health";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_check_fees";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_check_node_health";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_check_solvency";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_classify_endeavor";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_clone_portal";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_combine_images";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_commission_endeavor";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_complete_enlistment";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_configure_availability";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_configure_business";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_configure_endeavor";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_configure_payment_method";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_configure_service";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_connect_stripe_account";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_connector_health_summary";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_create_announcement";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_create_booking";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_create_customer_profile";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_create_event";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_create_form";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_create_membership_plan";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_create_page";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_create_post";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_create_post_from_media";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_create_product";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_create_quest";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_create_space";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_create_work_from_url";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_decommission_tenant";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_delegate_task";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_delete_membership_plan";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_disconnect_stripe_account";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_discover_federation_products";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_dispatch_to_channel";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_document_incident";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_draft_review_response";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_edit_image_text";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_escalate_issue";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_extract_pdf_pages";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_federation_pulse";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_fetch_reviews";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_find_producers";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_find_synchronicities";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_generate_cad_instructions";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_generate_image";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_generate_invoice";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_generate_theme_aware_image";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_get_agenda";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_get_daily_bread";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_get_enterprise_stage";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_get_node_stats";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_get_page_hero";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_get_theme_settings";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_import_google_contacts";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_improve_image";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_ingest_youtube_channel";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_ingest_youtube_url";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_invite_member";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_issue_refund";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_leo_handoff";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_list_availability";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_list_channel_media";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_list_contacts";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_list_membership_plans";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_list_node_files";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_log_interaction";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_log_maintenance_note";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_lookup_scripture";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_manage_categories";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_message_contact";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_moderate_content";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_my_place";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_negotiate_deal";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_onboard_vendor";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_open_passage";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_payload_create";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_payload_delete";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_payload_find";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_payload_update";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_ping_federation";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_platform_solvency";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_post_card_directive";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_provision_tenant";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_application_logs";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_availability";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_board_members";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_booking_revenue";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_bookings";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_event_registrations";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_events";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_federation";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_financial_reports";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_form_submissions";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_inventory_history";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_knowledge";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_media";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_navigation";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_orders";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_peer_catalog";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_posts";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_products";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_projects";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_site_content";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_spaces";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_query_sql";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_recommend_products";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_replace_image";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_request_endeavor_migration";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_reschedule_booking";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_research_and_provision";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_route_federated_request";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_route_order";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_run_subsafe_check";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_save_contact";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_search_federation_wide";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_segment_customers";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_send_direct_message";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_send_email";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_send_emergency_alert";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_send_federation_message";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_send_follow_up";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_send_gotify";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_send_inline_form";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_send_message";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_send_slack";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_send_sms";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_send_telegram";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_send_whatsapp";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_set_availability";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_set_endeavor_image";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_set_holon_profile";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_set_low_stock_alert";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_set_page_hero";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_set_platform_fee";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_set_portal_branding";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_set_work_attribution";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_sign_constitution";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_suggest_products";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_track_inventory_movement";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_track_soul";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_update_booking_status";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_update_fulfillment";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_update_inventory";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_update_navigation";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_update_page";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_update_post";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_update_product";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_update_theme_settings";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_verify_address";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_view_cart";
    ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "payload_mcp_tool_web_search";
  `)
}
