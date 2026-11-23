import type { Block } from 'payload'

/**
 * UserPortals — Modular Payload CMS Page Block replacing the legacy hardcoded
 * AlreadyOnboardedBanner.
 *
 * Displays interactive cards for every portal the signed-in viewer owns — or,
 * for platform admins (`super_admin`) when `scope` is `'all_for_admin'`, all
 * portals across the node — complete with status badges, plan pills, search,
 * filters, and quick links to Dashboard, live Site, Settings, and Admin.
 */
export const UserPortals: Block = {
  slug: 'userPortals',
  interfaceName: 'UserPortalsBlock',
  labels: {
    singular: 'User Portals Directory',
    plural: 'User Portals Directories',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      defaultValue: 'Your Portals',
      admin: {
        description: 'Heading shown above the portal cards.',
      },
    },
    {
      name: 'subheading',
      type: 'text',
      admin: {
        description: 'Optional subheading below the main title.',
      },
    },
    {
      name: 'scope',
      type: 'select',
      defaultValue: 'all_for_admin',
      options: [
        { label: 'All Portals for Platform Admins (Owned for Creators)', value: 'all_for_admin' },
        { label: 'Owned Portals Only', value: 'owned' },
      ],
      admin: {
        description:
          'When "All Portals for Platform Admins" is selected, super_admin viewers see every tenant on this node in addition to portals they personally own.',
      },
    },
    {
      name: 'columns',
      type: 'select',
      defaultValue: '3',
      options: ['2', '3', '4'],
      admin: {
        description: 'Number of card columns on desktop screens.',
      },
    },
    {
      name: 'showQuota',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Show the viewer’s plan quota pill (e.g., "15 of 100 portals on your plan").',
      },
    },
    {
      name: 'showFilters',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Show search bar and category/status filter pills above the grid.',
      },
    },
    {
      name: 'showCreateCard',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Show a "+ Launch New Portal" card linking to /start.',
      },
    },
    {
      name: 'hideWhenAnonymous',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Hide this entire block for anonymous / logged-out visitors.',
      },
    },
    {
      name: 'includePlatformTenant',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Include the root `platform` tenant card inside the directory.',
      },
    },
  ],
}
