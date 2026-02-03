import type { CollectionConfig } from 'payload'

import { link } from '@/fields/link'

export const Header: CollectionConfig = {
  slug: 'header',
  admin: {
    group: 'Angel OS',
    useAsTitle: 'id',
  },
  access: {
    read: () => true,
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
