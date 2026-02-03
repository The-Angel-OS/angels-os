import type { CollectionConfig } from 'payload'

/**
 * User–space membership (Discord-style roles within a space).
 */
export const SpaceMemberships: CollectionConfig = {
  slug: 'space-memberships',
  admin: {
    group: 'Angel OS',
    useAsTitle: 'id',
    defaultColumns: ['user', 'space', 'role', 'status'],
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      required: true,
    },
    {
      name: 'space',
      type: 'relationship',
      relationTo: 'spaces',
      required: true,
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
