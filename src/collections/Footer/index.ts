import type { CollectionConfig } from 'payload'

import { link } from '@/fields/link'
import { publicWithTenantScope } from '@/access/publicWithTenantScope'
import { revalidateTenantDoc } from '@/utilities/revalidateTenantDoc'

const revalidate = revalidateTenantDoc('footer')

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
  hooks: {
    afterChange: [revalidate.afterChange],
    afterDelete: [revalidate.afterDelete],
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
    // ─── Legacy flat nav (backward compat) ─────────────────
    {
      name: 'navItems',
      type: 'array',
      admin: {
        description: 'Simple flat links. For grouped columns, use navGroups below.',
      },
      fields: [
        link({
          appearances: false,
        }),
      ],
      maxRows: 6,
    },
    // ─── Hierarchical nav groups (columnar footer) ───────
    {
      name: 'navGroups',
      type: 'array',
      admin: {
        description: 'Footer columns — each group becomes a column with a heading and child links.',
      },
      fields: [
        {
          name: 'heading',
          type: 'text',
          required: true,
          admin: {
            description: 'Column heading (e.g. "Legal", "Resources", "Community")',
          },
        },
        {
          name: 'items',
          type: 'array',
          fields: [
            link({
              appearances: false,
            }),
          ],
          maxRows: 10,
        },
      ],
      maxRows: 6,
    },
    // ─── Bottom bar ──────────────────────────────────────
    {
      name: 'bottomText',
      type: 'text',
      admin: {
        description: 'Copyright text at the very bottom (e.g. "© 2026 Angel OS Federation").',
      },
    },
  ],
}
