import type { CollectionConfig } from 'payload'

import { link } from '@/fields/link'
import { publicWithTenantScope } from '@/access/publicWithTenantScope'
import { revalidateTenantDoc } from '@/utilities/revalidateTenantDoc'

const revalidate = revalidateTenantDoc('header')

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
  hooks: {
    afterChange: [revalidate.afterChange],
    afterDelete: [revalidate.afterDelete],
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
      admin: {
        description: 'Top-level navigation links. Each can optionally have child items for dropdown menus.',
      },
      fields: [
        link({
          appearances: false,
        }),
        {
          name: 'children',
          type: 'array',
          admin: {
            description: 'Dropdown child links under this parent item.',
          },
          fields: [
            link({
              appearances: false,
            }),
          ],
          maxRows: 8,
        },
      ],
      maxRows: 10,
    },
  ],
}
