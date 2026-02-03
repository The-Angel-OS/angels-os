import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { simpleSlugField } from '@/fields/simpleSlugField'

/**
 * Workspace per tenant (Discord-style).
 * Created by tenant admins; used for conversations, channels, invites.
 */
export const Spaces: CollectionConfig = {
  slug: 'spaces',
  admin: {
    group: 'Angel OS',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'tenant', 'visibility'],
  },
  access: {
    create: async ({ req: { user }, data }) => {
      if (!user?.id) return false
      const { canManageSpaces } = await import('@/access/canManageSpaces')
      const tenantId = typeof data?.tenant === 'object' ? data.tenant?.id : data?.tenant
      if (!tenantId) return false
      return canManageSpaces(user, tenantId)
    },
    read: ({ req: { user } }) => Boolean(user),
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    simpleSlugField,
    {
      name: 'description',
      type: 'textarea',
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: { description: 'Tenant this space belongs to' },
    },
    {
      name: 'visibility',
      type: 'select',
      defaultValue: 'invite_only',
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Invite only', value: 'invite_only' },
        { label: 'Private', value: 'private' },
      ],
    },
  ],
}
