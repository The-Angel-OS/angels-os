import * as migration_20260720_000000_add_fullscreen_hero_type from './20260720_000000_add_fullscreen_hero_type';
import * as migration_20260720_010000_add_media_text_block from './20260720_010000_add_media_text_block';
import * as migration_20260720_020000_add_tenant_default_theme from './20260720_020000_add_tenant_default_theme';
import * as migration_20260720_030000_tenant_scope_ecommerce from './20260720_030000_tenant_scope_ecommerce';
import * as migration_20260721_010000_add_vapi_fallback_number from './20260721_010000_add_vapi_fallback_number';
import * as migration_20260722_010000_contacts_phone_voice_source from './20260722_010000_contacts_phone_voice_source';
import * as migration_20260722_020000_users_phone from './20260722_020000_users_phone';
import * as migration_20260722_030000_add_redirects from './20260722_030000_add_redirects';
import * as migration_20260722_040000_invitation_phone from './20260722_040000_invitation_phone';
import * as migration_20260722_050000_invitation_name from './20260722_050000_invitation_name'
import * as migration_20260725_180000_service_deposit_flat from './20260725_180000_service_deposit_flat'
import * as migration_20260725_210000_link_field_collections from './20260725_210000_link_field_collections';
import * as migration_20260726_120000_users_google_calendar from './20260726_120000_users_google_calendar';
import * as migration_20260726_200000_contacts_attribution from './20260726_200000_contacts_attribution';
import * as migration_20260726_210000_sequences from './20260726_210000_sequences';
import * as migration_20260726_233000_tenant_hide_powered_by from './20260726_233000_tenant_hide_powered_by';
import * as migration_20260727_000500_hero_split_panel from './20260727_000500_hero_split_panel';
import * as migration_20260727_030000_media_text_media from './20260727_030000_media_text_media';
import * as migration_20260727_234500_tickets from './20260727_234500_tickets'
import * as migration_20260727_190000_media_created_by from './20260727_190000_media_created_by'
import * as migration_20260727_191500_ticket_form_block from './20260727_191500_ticket_form_block'
import * as migration_20260727_201500_trust_row_block from './20260727_201500_trust_row_block'
import * as migration_20260727_204500_faq_block from './20260727_204500_faq_block'
import * as migration_20260727_212000_tenant_trust_badges from './20260727_212000_tenant_trust_badges'
import * as migration_20260728_091500_video_block_and_aspect from './20260728_091500_video_block_and_aspect'
import * as migration_20260728_093000_media_text_aspect_all_tables from './20260728_093000_media_text_aspect_all_tables'
import * as migration_20260728_113000_showcase_block from './20260728_113000_showcase_block'
import * as migration_20260728_120000_product_panel_block from './20260728_120000_product_panel_block';
import * as migration_20260728_151500_products_marketing_blocks from './20260728_151500_products_marketing_blocks';
import * as migration_20260731_080000_jobs_queue from './20260731_080000_jobs_queue';
import * as migration_20260201_025229 from './20260201_025229';
import * as migration_20260201_025611 from './20260201_025611';
import * as migration_20260201_065943_add_header_footer_collections from './20260201_065943_add_header_footer_collections';
import * as migration_20260201_081109_add_tenant_memberships from './20260201_081109_add_tenant_memberships';
import * as migration_20260201_081522_add_spaces_and_branding from './20260201_081522_add_spaces_and_branding';
import * as migration_20260202_003913_add_channels_messages from './20260202_003913_add_channels_messages';
import * as migration_20260202_022727_add_leo_system_user_fields from './20260202_022727_add_leo_system_user_fields';
import * as migration_20260216_085909_add_ums_and_channel_extensions from './20260216_085909_add_ums_and_channel_extensions';
import * as migration_20260218_061453_add_events_and_registrations from './20260218_061453_add_events_and_registrations';
import * as migration_20260220_051631_add_tenant_to_soul_collections from './20260220_051631_add_tenant_to_soul_collections';
import * as migration_20260223_013326 from './20260223_013326';
import * as migration_20260223_232507_sprint17 from './20260223_232507_sprint17';
import * as migration_20260224_031440_contacts_crm from './20260224_031440_contacts_crm';
import * as migration_20260304_152233 from './20260304_152233';
import * as migration_20260308_191006_sprint42_propagation from './20260308_191006_sprint42_propagation';
import * as migration_20260321_143829 from './20260321_143829';
import * as migration_20260604_000000_tenant_branding_favicon from './20260604_000000_tenant_branding_favicon';
import * as migration_20260605_000000_membership_user_nullable from './20260605_000000_membership_user_nullable';
import * as migration_20260605_045919_add_federation_peers from './20260605_045919_add_federation_peers';
import * as migration_20260605_060000_user_dashboard_prefs from './20260605_060000_user_dashboard_prefs';
import * as migration_20260607_120000_contacts_campaign_fields from './20260607_120000_contacts_campaign_fields';
import * as migration_20260607_220000_add_presence from './20260607_220000_add_presence';
import * as migration_20260626_190000_add_cost_events from './20260626_190000_add_cost_events';
import * as migration_20260704_060000_add_nvidia_ai_config from './20260704_060000_add_nvidia_ai_config';
import * as migration_20260708_000000_add_message_channel_ref from './20260708_000000_add_message_channel_ref';
import * as migration_20260713_000000_add_community_visibility from './20260713_000000_add_community_visibility';
import * as migration_20260715_000000_add_tenant_flavors from './20260715_000000_add_tenant_flavors';
import * as migration_20260715_010000_backfill_guardian_angel_flavor from './20260715_010000_backfill_guardian_angel_flavor';
import * as migration_20260719_000000_add_google_reviews_block from './20260719_000000_add_google_reviews_block';
import * as migration_20260719_010000_add_booking_hold_expiry from './20260719_010000_add_booking_hold_expiry';

import * as migration_20260813_030000_spaces_is_system from './20260813_030000_spaces_is_system';
import * as migration_20260813_223000_partners_referral from './20260813_223000_partners_referral';
import * as migration_20260813_224500_mcp_tool_columns from './20260813_224500_mcp_tool_columns';
import * as migration_20260814_030000_mcp_tool_list from './20260814_030000_mcp_tool_list';
import * as migration_20260814_120000_posts_access from './20260814_120000_posts_access'
import * as migration_20260818_140000_forms_tenant from './20260818_140000_forms_tenant'
import * as migration_20260820_150000_membership_fk_cascade from './20260820_150000_membership_fk_cascade';
import * as migration_20260820_180000_site_visits from './20260820_180000_site_visits';
import * as migration_20260820_210000_cart_items_cascade from './20260820_210000_cart_items_cascade';
import * as migration_20260812_220000_space_invite_phone from './20260812_220000_space_invite_phone';
import * as migration_20260821_120000_hero_scrim from './20260821_120000_hero_scrim'
import * as migration_20260821_170000_hero_scrim_versions from './20260821_170000_hero_scrim_versions'
import * as migration_20260822_120000_archive_columns from './20260822_120000_archive_columns'
import * as migration_20260823_120000_pages_comments_block from './20260823_120000_pages_comments_block'
import * as migration_20260824_100000_works_availability from './20260824_100000_works_availability'
import * as migration_20260824_140000_event_products from './20260824_140000_event_products'
import * as migration_20260824_170000_events_layout from './20260824_170000_events_layout'
import * as migration_20260824_180000_events_rels_events_id from './20260824_180000_events_rels_events_id'
import * as migration_20260824_200000_users_avatar from './20260824_200000_users_avatar'
import * as migration_20260824_210000_read_state from './20260824_210000_read_state'
import * as migration_20260821_110000_availability_house_hours from './20260821_110000_availability_house_hours'
import * as migration_20260821_100000_portal_plan_demo from './20260821_100000_portal_plan_demo'
import * as migration_20260821_090000_open_community_spaces from './20260821_090000_open_community_spaces'
import * as migration_20260821_080000_tenant_features_page_comments from './20260821_080000_tenant_features_page_comments'
import * as migration_20260821_070000_sync_user_tenants_backfill from './20260821_070000_sync_user_tenants_backfill'
import * as migration_20260821_060000_town_square_and_ai_bus from './20260821_060000_town_square_and_ai_bus'
import * as migration_20260821_050000_tenant_features from './20260821_050000_tenant_features'
import * as migration_20260820_223000_tenant_portal_plan from './20260820_223000_tenant_portal_plan'

export const migrations = [
  {
    up: migration_20260201_025229.up,
    down: migration_20260201_025229.down,
    name: '20260201_025229',
  },
  {
    up: migration_20260201_025611.up,
    down: migration_20260201_025611.down,
    name: '20260201_025611',
  },
  {
    up: migration_20260201_065943_add_header_footer_collections.up,
    down: migration_20260201_065943_add_header_footer_collections.down,
    name: '20260201_065943_add_header_footer_collections',
  },
  {
    up: migration_20260201_081109_add_tenant_memberships.up,
    down: migration_20260201_081109_add_tenant_memberships.down,
    name: '20260201_081109_add_tenant_memberships',
  },
  {
    up: migration_20260201_081522_add_spaces_and_branding.up,
    down: migration_20260201_081522_add_spaces_and_branding.down,
    name: '20260201_081522_add_spaces_and_branding',
  },
  {
    up: migration_20260202_003913_add_channels_messages.up,
    down: migration_20260202_003913_add_channels_messages.down,
    name: '20260202_003913_add_channels_messages',
  },
  {
    up: migration_20260202_022727_add_leo_system_user_fields.up,
    down: migration_20260202_022727_add_leo_system_user_fields.down,
    name: '20260202_022727_add_leo_system_user_fields',
  },
  {
    up: migration_20260216_085909_add_ums_and_channel_extensions.up,
    down: migration_20260216_085909_add_ums_and_channel_extensions.down,
    name: '20260216_085909_add_ums_and_channel_extensions',
  },
  {
    up: migration_20260218_061453_add_events_and_registrations.up,
    down: migration_20260218_061453_add_events_and_registrations.down,
    name: '20260218_061453_add_events_and_registrations',
  },
  {
    up: migration_20260220_051631_add_tenant_to_soul_collections.up,
    down: migration_20260220_051631_add_tenant_to_soul_collections.down,
    name: '20260220_051631_add_tenant_to_soul_collections',
  },
  {
    up: migration_20260223_013326.up,
    down: migration_20260223_013326.down,
    name: '20260223_013326',
  },
  {
    up: migration_20260223_232507_sprint17.up,
    down: migration_20260223_232507_sprint17.down,
    name: '20260223_232507_sprint17',
  },
  {
    up: migration_20260224_031440_contacts_crm.up,
    down: migration_20260224_031440_contacts_crm.down,
    name: '20260224_031440_contacts_crm',
  },
  {
    up: migration_20260304_152233.up,
    down: migration_20260304_152233.down,
    name: '20260304_152233',
  },
  {
    up: migration_20260308_191006_sprint42_propagation.up,
    down: migration_20260308_191006_sprint42_propagation.down,
    name: '20260308_191006_sprint42_propagation',
  },
  {
    up: migration_20260321_143829.up,
    down: migration_20260321_143829.down,
    name: '20260321_143829',
  },
  {
    up: migration_20260604_000000_tenant_branding_favicon.up,
    down: migration_20260604_000000_tenant_branding_favicon.down,
    name: '20260604_000000_tenant_branding_favicon',
  },
  {
    up: migration_20260605_000000_membership_user_nullable.up,
    down: migration_20260605_000000_membership_user_nullable.down,
    name: '20260605_000000_membership_user_nullable',
  },
  {
    up: migration_20260605_045919_add_federation_peers.up,
    down: migration_20260605_045919_add_federation_peers.down,
    name: '20260605_045919_add_federation_peers'
  },
  {
    up: migration_20260605_060000_user_dashboard_prefs.up,
    down: migration_20260605_060000_user_dashboard_prefs.down,
    name: '20260605_060000_user_dashboard_prefs',
  },
  {
    up: migration_20260607_120000_contacts_campaign_fields.up,
    down: migration_20260607_120000_contacts_campaign_fields.down,
    name: '20260607_120000_contacts_campaign_fields',
  },
  {
    up: migration_20260607_220000_add_presence.up,
    down: migration_20260607_220000_add_presence.down,
    name: '20260607_220000_add_presence',
  },
  {
    up: migration_20260626_190000_add_cost_events.up,
    down: migration_20260626_190000_add_cost_events.down,
    name: '20260626_190000_add_cost_events',
  },
  {
    up: migration_20260704_060000_add_nvidia_ai_config.up,
    down: migration_20260704_060000_add_nvidia_ai_config.down,
    name: '20260704_060000_add_nvidia_ai_config',
  },
  {
    up: migration_20260708_000000_add_message_channel_ref.up,
    down: migration_20260708_000000_add_message_channel_ref.down,
    name: '20260708_000000_add_message_channel_ref',
  },
  {
    up: migration_20260713_000000_add_community_visibility.up,
    down: migration_20260713_000000_add_community_visibility.down,
    name: '20260713_000000_add_community_visibility',
  },
  {
    up: migration_20260715_000000_add_tenant_flavors.up,
    down: migration_20260715_000000_add_tenant_flavors.down,
    name: '20260715_000000_add_tenant_flavors',
  },
  {
    up: migration_20260715_010000_backfill_guardian_angel_flavor.up,
    down: migration_20260715_010000_backfill_guardian_angel_flavor.down,
    name: '20260715_010000_backfill_guardian_angel_flavor',
  },
  {
    up: migration_20260719_000000_add_google_reviews_block.up,
    down: migration_20260719_000000_add_google_reviews_block.down,
    name: '20260719_000000_add_google_reviews_block',
  },
  {
    up: migration_20260719_010000_add_booking_hold_expiry.up,
    down: migration_20260719_010000_add_booking_hold_expiry.down,
    name: '20260719_010000_add_booking_hold_expiry',
  },
  {
    up: migration_20260720_000000_add_fullscreen_hero_type.up,
    down: migration_20260720_000000_add_fullscreen_hero_type.down,
    name: '20260720_000000_add_fullscreen_hero_type',
  },
  {
    up: migration_20260720_010000_add_media_text_block.up,
    down: migration_20260720_010000_add_media_text_block.down,
    name: '20260720_010000_add_media_text_block',
  },
  {
    up: migration_20260720_020000_add_tenant_default_theme.up,
    down: migration_20260720_020000_add_tenant_default_theme.down,
    name: '20260720_020000_add_tenant_default_theme',
  },
  {
    up: migration_20260720_030000_tenant_scope_ecommerce.up,
    down: migration_20260720_030000_tenant_scope_ecommerce.down,
    name: '20260720_030000_tenant_scope_ecommerce',
  },
  {
    up: migration_20260721_010000_add_vapi_fallback_number.up,
    down: migration_20260721_010000_add_vapi_fallback_number.down,
    name: '20260721_010000_add_vapi_fallback_number',
  },
  {
    up: migration_20260722_010000_contacts_phone_voice_source.up,
    down: migration_20260722_010000_contacts_phone_voice_source.down,
    name: '20260722_010000_contacts_phone_voice_source',
  },
  {
    up: migration_20260722_020000_users_phone.up,
    down: migration_20260722_020000_users_phone.down,
    name: '20260722_020000_users_phone',
  },
  {
    up: migration_20260722_030000_add_redirects.up,
    down: migration_20260722_030000_add_redirects.down,
    name: '20260722_030000_add_redirects',
  },
  {
    up: migration_20260722_040000_invitation_phone.up,
    down: migration_20260722_040000_invitation_phone.down,
    name: '20260722_040000_invitation_phone',
  },
  {
    up: migration_20260722_050000_invitation_name.up,
    down: migration_20260722_050000_invitation_name.down,
    name: '20260722_050000_invitation_name',
  },
  {
    up: migration_20260725_180000_service_deposit_flat.up,
    down: migration_20260725_180000_service_deposit_flat.down,
    name: '20260725_180000_service_deposit_flat',
  },
  {
    up: migration_20260725_210000_link_field_collections.up,
    down: migration_20260725_210000_link_field_collections.down,
    name: '20260725_210000_link_field_collections',
  },
  {
    up: migration_20260726_120000_users_google_calendar.up,
    down: migration_20260726_120000_users_google_calendar.down,
    name: '20260726_120000_users_google_calendar',
  },
  {
    up: migration_20260726_200000_contacts_attribution.up,
    down: migration_20260726_200000_contacts_attribution.down,
    name: '20260726_200000_contacts_attribution',
  },
  {
    up: migration_20260726_210000_sequences.up,
    down: migration_20260726_210000_sequences.down,
    name: '20260726_210000_sequences',
  },
  {
    up: migration_20260726_233000_tenant_hide_powered_by.up,
    down: migration_20260726_233000_tenant_hide_powered_by.down,
    name: '20260726_233000_tenant_hide_powered_by',
  },
  {
    up: migration_20260727_000500_hero_split_panel.up,
    down: migration_20260727_000500_hero_split_panel.down,
    name: '20260727_000500_hero_split_panel',
  },
  {
    up: migration_20260727_030000_media_text_media.up,
    down: migration_20260727_030000_media_text_media.down,
    name: '20260727_030000_media_text_media',
  },
  {
    up: migration_20260727_234500_tickets.up,
    down: migration_20260727_234500_tickets.down,
    name: '20260727_234500_tickets',
  },
  {
    up: migration_20260727_190000_media_created_by.up,
    down: migration_20260727_190000_media_created_by.down,
    name: '20260727_190000_media_created_by',
  },
  {
    up: migration_20260727_191500_ticket_form_block.up,
    down: migration_20260727_191500_ticket_form_block.down,
    name: '20260727_191500_ticket_form_block',
  },
  {
    up: migration_20260727_201500_trust_row_block.up,
    down: migration_20260727_201500_trust_row_block.down,
    name: '20260727_201500_trust_row_block',
  },
  {
    up: migration_20260727_204500_faq_block.up,
    down: migration_20260727_204500_faq_block.down,
    name: '20260727_204500_faq_block',
  },
  {
    up: migration_20260727_212000_tenant_trust_badges.up,
    down: migration_20260727_212000_tenant_trust_badges.down,
    name: '20260727_212000_tenant_trust_badges',
  },
  {
    up: migration_20260728_091500_video_block_and_aspect.up,
    down: migration_20260728_091500_video_block_and_aspect.down,
    name: '20260728_091500_video_block_and_aspect',
  },
  {
    up: migration_20260728_093000_media_text_aspect_all_tables.up,
    down: migration_20260728_093000_media_text_aspect_all_tables.down,
    name: '20260728_093000_media_text_aspect_all_tables',
  },
  {
    up: migration_20260728_113000_showcase_block.up,
    down: migration_20260728_113000_showcase_block.down,
    name: '20260728_113000_showcase_block',
  },
  {
    up: migration_20260728_120000_product_panel_block.up,
    down: migration_20260728_120000_product_panel_block.down,
    name: '20260728_120000_product_panel_block',
  },
  {
    up: migration_20260728_151500_products_marketing_blocks.up,
    down: migration_20260728_151500_products_marketing_blocks.down,
    name: '20260728_151500_products_marketing_blocks',
  },
  {
    up: migration_20260731_080000_jobs_queue.up,
    down: migration_20260731_080000_jobs_queue.down,
    name: '20260731_080000_jobs_queue',
  },
  {
    up: migration_20260812_220000_space_invite_phone.up,
    down: migration_20260812_220000_space_invite_phone.down,
    name: '20260812_220000_space_invite_phone',
  },
  {
    up: migration_20260813_030000_spaces_is_system.up,
    down: migration_20260813_030000_spaces_is_system.down,
    name: '20260813_030000_spaces_is_system',
  },
  {
    up: migration_20260813_223000_partners_referral.up,
    down: migration_20260813_223000_partners_referral.down,
    name: '20260813_223000_partners_referral',
  },
  {
    up: migration_20260813_224500_mcp_tool_columns.up,
    down: migration_20260813_224500_mcp_tool_columns.down,
    name: '20260813_224500_mcp_tool_columns',
  },
  {
    up: migration_20260814_030000_mcp_tool_list.up,
    down: migration_20260814_030000_mcp_tool_list.down,
    name: '20260814_030000_mcp_tool_list',
  },
  {
    up: migration_20260814_120000_posts_access.up,
    down: migration_20260814_120000_posts_access.down,
    name: '20260814_120000_posts_access',
  },
  {
    up: migration_20260818_140000_forms_tenant.up,
    down: migration_20260818_140000_forms_tenant.down,
    name: '20260818_140000_forms_tenant',
  },
  {
    up: migration_20260820_150000_membership_fk_cascade.up,
    down: migration_20260820_150000_membership_fk_cascade.down,
    name: '20260820_150000_membership_fk_cascade',
  },
  {
    up: migration_20260820_180000_site_visits.up,
    down: migration_20260820_180000_site_visits.down,
    name: '20260820_180000_site_visits',
  },
  {
    up: migration_20260820_210000_cart_items_cascade.up,
    down: migration_20260820_210000_cart_items_cascade.down,
    name: '20260820_210000_cart_items_cascade',
  },
  {
    up: migration_20260820_223000_tenant_portal_plan.up,
    down: migration_20260820_223000_tenant_portal_plan.down,
    name: '20260820_223000_tenant_portal_plan',
  },
  {
    up: migration_20260821_050000_tenant_features.up,
    down: migration_20260821_050000_tenant_features.down,
    name: '20260821_050000_tenant_features',
  },
  {
    up: migration_20260821_060000_town_square_and_ai_bus.up,
    down: migration_20260821_060000_town_square_and_ai_bus.down,
    name: '20260821_060000_town_square_and_ai_bus',
  },
  {
    up: migration_20260821_070000_sync_user_tenants_backfill.up,
    down: migration_20260821_070000_sync_user_tenants_backfill.down,
    name: '20260821_070000_sync_user_tenants_backfill',
  },
  {
    up: migration_20260821_080000_tenant_features_page_comments.up,
    down: migration_20260821_080000_tenant_features_page_comments.down,
    name: '20260821_080000_tenant_features_page_comments',
  },
  {
    up: migration_20260821_090000_open_community_spaces.up,
    down: migration_20260821_090000_open_community_spaces.down,
    name: '20260821_090000_open_community_spaces',
  },
  {
    up: migration_20260821_100000_portal_plan_demo.up,
    down: migration_20260821_100000_portal_plan_demo.down,
    name: '20260821_100000_portal_plan_demo',
  },
  {
    up: migration_20260821_110000_availability_house_hours.up,
    down: migration_20260821_110000_availability_house_hours.down,
    name: '20260821_110000_availability_house_hours',
  },
  {
    up: migration_20260821_120000_hero_scrim.up,
    down: migration_20260821_120000_hero_scrim.down,
    name: '20260821_120000_hero_scrim',
  },
  {
    up: migration_20260821_170000_hero_scrim_versions.up,
    down: migration_20260821_170000_hero_scrim_versions.down,
    name: '20260821_170000_hero_scrim_versions',
  },
  {
    up: migration_20260822_120000_archive_columns.up,
    down: migration_20260822_120000_archive_columns.down,
    name: '20260822_120000_archive_columns',
  },
  {
    up: migration_20260823_120000_pages_comments_block.up,
    down: migration_20260823_120000_pages_comments_block.down,
    name: '20260823_120000_pages_comments_block',
  },
  {
    up: migration_20260824_100000_works_availability.up,
    down: migration_20260824_100000_works_availability.down,
    name: '20260824_100000_works_availability',
  },
  {
    up: migration_20260824_140000_event_products.up,
    down: migration_20260824_140000_event_products.down,
    name: '20260824_140000_event_products',
  },
  {
    up: migration_20260824_170000_events_layout.up,
    down: migration_20260824_170000_events_layout.down,
    name: '20260824_170000_events_layout',
  },
  {
    up: migration_20260824_180000_events_rels_events_id.up,
    down: migration_20260824_180000_events_rels_events_id.down,
    name: '20260824_180000_events_rels_events_id',
  },
  {
    up: migration_20260824_200000_users_avatar.up,
    down: migration_20260824_200000_users_avatar.down,
    name: '20260824_200000_users_avatar',
  },
  {
    up: migration_20260824_210000_read_state.up,
    down: migration_20260824_210000_read_state.down,
    name: '20260824_210000_read_state',
  },
];
