import type { CollectionConfig } from 'payload'

import { link } from '@/fields/link'
import { publicWithTenantScope } from '@/access/publicWithTenantScope'

export const Header: CollectionConfig = {
  slug: 'header',
  admin: {
    group: 'Angel OS',
    useAsTitle: 'id',
  },
  access: {
    // Each tenant has its own header — scope to current tenant.
    read: publicWithTenantScope,
  },
  fields: [
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
