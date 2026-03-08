import type { CollectionConfig } from 'payload'

import { link } from '@/fields/link'
import { publicWithTenantScope } from '@/access/publicWithTenantScope'

export const Footer: CollectionConfig = {
  slug: 'footer',
  admin: {
    group: 'Configuration',
    useAsTitle: 'label',
    description: 'Site footer navigation — one per tenant.',
  },
  access: {
    // Each tenant has its own footer — scope to current tenant.
    read: publicWithTenantScope,
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      admin: {
        description: 'Descriptive label for this footer (e.g. "Main Footer").',
      },
      defaultValue: 'Main Footer',
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
