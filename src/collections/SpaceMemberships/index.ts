import type { CollectionConfig } from 'payload'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'

/**
 * User–space membership (Discord-style roles within a space).
 *
 * Access control:
 *   - Read:   Authenticated users (tenant plugin scopes to their tenant)
 *   - Create: Admin only via REST API (hooks/endpoints use overrideAccess)
 *   - Update: Admin, OR user can update their OWN membership (e.g. leave)
 *   - Delete: Admin only (prefer soft-delete via status='left')
 *
 * Space admins manage members through the space-members endpoint and
 * SpaceSettingsClient UI, which use overrideAccess server-side.
 */
export const SpaceMemberships: CollectionConfig = {
  slug: 'space-memberships',
  admin: {
    group: 'Spaces',
    useAsTitle: 'id',
    defaultColumns: ['user', 'space', 'role', 'status'],
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      if (checkRole(ADMIN_ROLES, user)) return true
      // Authenticated non-admin: tenant plugin scopes to their tenant
      return true
    },
    create: ({ req: { user } }) => {
      if (!user) return false
      if (checkRole(ADMIN_ROLES, user)) return true
      // Non-admin: must go through hooks (overrideAccess) or managed endpoints
      return false
    },
    update: ({ req: { user } }) => {
      if (!user) return false
      if (checkRole(ADMIN_ROLES, user)) return true
      // Users can update their own membership (e.g. leave a space)
      return { user: { equals: user.id } }
    },
    delete: ({ req: { user } }) => {
      if (!user) return false
      if (checkRole(ADMIN_ROLES, user)) return true
      // Non-admin: use soft-delete via space-members endpoint
      return false
    },
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
    },
    {
      name: 'space',
      type: 'relationship',
      relationTo: 'spaces',
      required: true,
      index: true,
    },
    {
      name: 'role',
      type: 'select',
      required: true,
      options: [
        { label: 'Space Admin', value: 'space_admin' },
        { label: 'Moderator', value: 'moderator' },
        { label: 'Member', value: 'member' },
        { label: 'Guest', value: 'guest' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      index: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Pending', value: 'pending' },
        { label: 'Suspended', value: 'suspended' },
        { label: 'Left', value: 'left' },
        { label: 'Banned', value: 'banned' },
      ],
    },
    {
      name: 'joinedAt',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'invitedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'User who invited (for non-tenant user onboarding)' },
    },
    {
      name: 'invitationDetails',
      type: 'group',
      admin: { description: 'For pending invitations (tenant user inviting non-tenant user)' },
      fields: [
        {
          name: 'invitationToken',
          type: 'text',
          admin: { readOnly: true },
        },
        {
          name: 'invitationExpiresAt',
          type: 'date',
        },
        {
          name: 'invitationMessage',
          type: 'textarea',
        },
        {
          name: 'invitationEmail',
          type: 'email',
          admin: { description: 'Email of invited user (may not exist yet)' },
        },
      ],
    },
  ],
}
