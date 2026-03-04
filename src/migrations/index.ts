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
    name: '20260304_152233'
  },
];
