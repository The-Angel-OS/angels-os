import type { CollectionConfig } from 'payload'

import { publicWithTenantScope } from '@/access/publicWithTenantScope'

/**
 * SiteSettings — Tenant-scoped site configuration.
 *
 * NOT a Global because Payload Globals don't support the multi-tenant plugin.
 * Same pattern as Header and Footer — one document per tenant.
 *
 * Stores social links, analytics, OG defaults, maintenance mode,
 * and announcement bar configuration.
 */
export const SiteSettings: CollectionConfig = {
  slug: 'site-settings',
  admin: {
    group: 'Configuration',
    useAsTitle: 'label',
    description: 'Site-wide settings — social links, SEO defaults, maintenance mode, and announcement bar. One per tenant.',
  },
  access: {
    read: publicWithTenantScope,
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      defaultValue: 'Site Settings',
      admin: {
        description: 'Descriptive label (e.g. "Main Site Settings").',
      },
    },
    // ─── Social Links ─────────────────────────────────────────
    {
      name: 'socialLinks',
      type: 'array',
      admin: {
        description: 'Social media links displayed in the site footer.',
      },
      fields: [
        {
          name: 'platform',
          type: 'select',
          required: true,
          options: [
            { label: 'Facebook', value: 'facebook' },
            { label: 'Instagram', value: 'instagram' },
            { label: 'X (Twitter)', value: 'twitter' },
            { label: 'LinkedIn', value: 'linkedin' },
            { label: 'YouTube', value: 'youtube' },
            { label: 'TikTok', value: 'tiktok' },
            { label: 'GitHub', value: 'github' },
            { label: 'Discord', value: 'discord' },
            { label: 'Bluesky', value: 'bluesky' },
          ],
        },
        {
          name: 'url',
          type: 'text',
          required: true,
          admin: { placeholder: 'https://...' },
        },
      ],
    },
    // ─── Analytics ────────────────────────────────────────────
    {
      name: 'googleAnalyticsId',
      type: 'text',
      admin: {
        description: 'Google Analytics Measurement ID (e.g. G-XXXXXXXXXX).',
        placeholder: 'G-XXXXXXXXXX',
      },
    },
    // ─── SEO Defaults ─────────────────────────────────────────
    {
      name: 'defaultOgImage',
      type: 'upload',
      relationTo: 'media' as any,
      admin: {
        description: 'Default Open Graph image used when pages have no specific OG image.',
      },
    },
    {
      name: 'defaultMetaDescription',
      type: 'textarea',
      admin: {
        description: 'Default meta description for pages without their own.',
      },
    },
    // ─── Donations ────────────────────────────────────────────
    {
      name: 'donationsEnabled',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description:
          'Enable the /donate page for this Endeavor. Default: on. Donations go to the Justice Fund.',
      },
    },
    // ─── Maintenance Mode ─────────────────────────────────────
    {
      name: 'maintenanceMode',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'When enabled, visitors see a maintenance page instead of the site.',
      },
    },
    {
      name: 'maintenanceMessage',
      type: 'textarea',
      admin: {
        description: 'Message displayed during maintenance mode.',
        condition: (data) => data?.maintenanceMode,
      },
    },
    // ─── Announcement Bar ─────────────────────────────────────
    {
      name: 'announcementBar',
      type: 'group',
      admin: {
        description: 'Optional announcement banner displayed at the top of the site.',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'text',
          type: 'text',
          admin: {
            condition: (data) => data?.announcementBar?.enabled,
          },
        },
        {
          name: 'link',
          type: 'text',
          admin: {
            description: 'Optional link URL for the announcement.',
            condition: (data) => data?.announcementBar?.enabled,
          },
        },
        {
          name: 'backgroundColor',
          type: 'text',
          defaultValue: '#f5a623',
          admin: {
            description: 'Background color (hex). Default: LCARS amber.',
            condition: (data) => data?.announcementBar?.enabled,
          },
        },
      ],
    },
  ],
}
