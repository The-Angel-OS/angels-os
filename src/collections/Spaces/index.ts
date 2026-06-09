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
    group: 'Spaces',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'tenant', 'visibility'],
    description: 'Workspaces per tenant (Discord-style) — containers for channels, conversations, and invites.',
  },
  access: {
    create: async ({ req: { user }, data }) => {
      if (!user?.id) return false
      const { canManageSpaces } = await import('@/access/canManageSpaces')
      const tenantId = typeof data?.tenant === 'object' ? data.tenant?.id : data?.tenant
      if (!tenantId) return false
      return canManageSpaces(user, tenantId)
    },
    // Role-inherits-non-private + explicit-private-grants — one resolver, shared
    // with Channels.read + Messages.read so visibility never drifts. See
    // PermissionService.buildSpaceVisibilityFilter.
    read: async ({ req: { user, payload } }) => {
      const { buildSpaceVisibilityFilter } = await import('@/services/PermissionService')
      return buildSpaceVisibilityFilter(payload, user, 'id')
    },
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    // Note: 'tenant' field is auto-added by the multi-tenant plugin.
    // Do not define it here to avoid duplicate field errors.
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
      name: 'visibility',
      type: 'select',
      defaultValue: 'invite_only',
      options: [
        { label: 'Public', value: 'public' },
        { label: 'Invite only', value: 'invite_only' },
        { label: 'Private', value: 'private' },
      ],
    },
    {
      name: 'isMain',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description:
          'Primary community space for this tenant. Auto-joined by all new members on onboarding.',
      },
    },
    {
      name: 'enabledApplets',
      type: 'json',
      defaultValue: ['chat', 'files', 'tasks'],
      admin: {
        description:
          'Array of applet IDs enabled for this space (e.g. ["chat", "files", "tasks"]). Chat is always available.',
      },
    },
  ],
}
