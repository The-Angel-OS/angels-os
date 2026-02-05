import type { CollectionConfig } from 'payload'

import { checkRole } from '@/access/utilities'

/**
 * Tenants collection for multi-domain routing (Finly pattern).
 * Each tenant = one Angel/LEO for the Endeavor; exposes MCP interface.
 * Middleware injects x-tenant-id based on request hostname.
 * Visible in admin only to super_admin.
 */
export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    group: 'Angel OS',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'domain', 'status'],
    hidden: ({ user }) => !(user && 'roles' in user && Array.isArray(user.roles) && user.roles.includes('super_admin')),
  },
  access: {
    read: () => true, // Public for hostname resolution
    create: ({ req: { user } }) => Boolean(checkRole(['super_admin'], user)),
    update: ({ req: { user } }) => Boolean(checkRole(['super_admin'], user)),
    delete: ({ req: { user } }) => Boolean(checkRole(['super_admin'], user)),
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Platform', value: 'platform' },
        { label: 'Tenant', value: 'tenant' },
      ],
      defaultValue: 'tenant',
      required: true,
      admin: {
        description: 'Platform tenant is the special singleton for Angel OS infrastructure',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Tenant Name',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Used in x-tenant-id header and URLs (e.g., hays-cactus)',
      },
    },
    {
      name: 'domain',
      type: 'text',
      required: true,
      admin: {
        description: 'Primary domain (e.g., hays-cactus.com). Used for hostname routing.',
      },
    },
    {
      name: 'domains',
      type: 'array',
      label: 'Additional Domains',
      admin: {
        description: 'Alias domains that resolve to this tenant',
      },
      fields: [
        {
          name: 'domain',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Provisioning', value: 'provisioning' },
      ],
    },
    {
      name: 'branding',
      type: 'group',
      admin: {
        description: 'Site branding (Zubricks-style)',
      },
      fields: [
        {
          name: 'logo',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'siteName',
          type: 'text',
        },
        {
          name: 'tagline',
          type: 'text',
        },
        {
          name: 'primaryColor',
          type: 'text',
          admin: { description: 'Hex (e.g. #10B981)', placeholder: '#10B981' },
        },
        {
          name: 'secondaryColor',
          type: 'text',
          admin: { placeholder: '#0078D4' },
        },
        {
          name: 'accentColor',
          type: 'text',
          admin: { placeholder: '#FF6B35' },
        },
        {
          name: 'backgroundColor',
          type: 'text',
          admin: { placeholder: '#FFFFFF' },
        },
        {
          name: 'foregroundColor',
          type: 'text',
          admin: { placeholder: '#1A1A1A' },
        },
        {
          name: 'borderColor',
          type: 'text',
          admin: { placeholder: '#E5E7EB' },
        },
        {
          name: 'headingFont',
          type: 'select',
          defaultValue: 'inter',
          options: [
            { label: 'Inter', value: 'inter' },
            { label: 'Playfair Display', value: 'playfair-display' },
            { label: 'Montserrat', value: 'montserrat' },
            { label: 'Raleway', value: 'raleway' },
            { label: 'Poppins', value: 'poppins' },
          ],
        },
        {
          name: 'bodyFont',
          type: 'select',
          defaultValue: 'inter',
          options: [
            { label: 'Inter', value: 'inter' },
            { label: 'Open Sans', value: 'open-sans' },
            { label: 'Lato', value: 'lato' },
            { label: 'Roboto', value: 'roboto' },
            { label: 'Source Sans 3', value: 'source-sans-3' },
          ],
        },
      ],
    },
  ],
}
