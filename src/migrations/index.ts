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
];
