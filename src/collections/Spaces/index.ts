import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { adminOnlyFieldAccess } from '@/access/adminOnlyFieldAccess'
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
    listSearchableFields: ['name', 'slug', 'description'],
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
      const f = await buildSpaceVisibilityFilter(payload, user, 'id')
      // false → REST list 403; never-match → empty 200 (correct list semantics).
      return f === false ? { id: { exists: false } } : f
    },
    update: adminOnly,
    delete: adminOnly,
  },
  hooks: {
    // Cascade-delete children before the space row is removed. Their `space` FK is
    // ON DELETE SET NULL but the column is NOT NULL (channels/messages/space-
    // memberships), so a bare space delete fails with a not-null violation (→ 500 /
    // "Something went wrong" in the UI). Payload's convention is app-layer cascade;
    // this hook implements it. Nullable refs (connectors/events/endeavors) SET NULL
    // automatically and are left alone. Order: memberships → messages → channels.
    beforeDelete: [
      async ({ req, id }) => {
        const { payload } = req
        for (const collection of ['space-memberships', 'messages', 'channels'] as const) {
          try {
            await payload.delete({
              collection,
              where: { space: { equals: id } },
              req,
              overrideAccess: true,
            })
          } catch (err) {
            payload.logger?.warn?.(
              `[spaces.beforeDelete] cascade ${collection} for space ${id}: ${err instanceof Error ? err.message : String(err)}`,
            )
          }
        }
      },
    ],
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
      // Infrastructure, not a room people chose to be in: the AI Bus (LEO's
      // channels, the error log, the system log) and Direct Messages.
      //
      // Five call sites already read `space.isSystem` — the dashboard's
      // default-space pick, SpacesChat, the settings guard — and the field had
      // never existed, so every one of them read `undefined`. `find(s =>
      // !s.isSystem)` therefore matched the AI Bus as happily as anything else.
      // Some sites had grown a `slug === 'ai-bus'` fallback; this makes the flag
      // they were all written against real, so the guess isn't the guard.
      name: 'isSystem',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      access: { update: adminOnlyFieldAccess },
      admin: {
        position: 'sidebar',
        description:
          'System space — provisioned infrastructure (AI Bus, Direct Messages). Cannot be deleted and is skipped when picking a default space.',
      },
    },
    {
      name: 'visibility',
      type: 'select',
      defaultValue: 'invite_only',
      options: [
        { label: 'Community (universal town square)', value: 'community' },
        { label: 'Public', value: 'public' },
        { label: 'Invite only', value: 'invite_only' },
        { label: 'Private', value: 'private' },
      ],
      admin: {
        description:
          "'Community' is the town square: readable AND postable by ANY authenticated user across the whole node, no membership or invite needed (distinct from 'Public', which is only visible within its own tenant). 'Private' hides the space except from explicit members.",
      },
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
