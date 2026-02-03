import * as migration_20260201_025229 from './20260201_025229';
import * as migration_20260201_025611 from './20260201_025611';
import * as migration_20260201_065943_add_header_footer_collections from './20260201_065943_add_header_footer_collections';
import * as migration_20260201_081109_add_tenant_memberships from './20260201_081109_add_tenant_memberships';
import * as migration_20260201_081522_add_spaces_and_branding from './20260201_081522_add_spaces_and_branding';
import * as migration_20260202_003913_add_channels_messages from './20260202_003913_add_channels_messages';
import * as migration_20260202_022727_add_leo_system_user_fields from './20260202_022727_add_leo_system_user_fields';

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
    name: '20260202_022727_add_leo_system_user_fields'
  },
];
