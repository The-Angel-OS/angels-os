import type { CollectionConfig } from 'payload'

import { link } from '@/fields/link'
import { publicWithTenantScope } from '@/access/publicWithTenantScope'

export const Header: CollectionConfig = {
  slug: 'header',
  admin: {
    group: 'Configuration',
    useAsTitle: 'label',
    description: 'Site header navigation — one per tenant.',
  },
  access: {
    // Each tenant has its own header — scope to current tenant.
    read: publicWithTenantScope,
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      admin: {
        description: 'Descriptive label for this header (e.g. "Main Header").',
      },
      defaultValue: 'Main Header',
    },
    {
      name: 'navItems',
      type: 'array',
      fields: [
        link({
          appearances: false,
        }),
      ],
      maxRows: 6,
    },
  ],
}
