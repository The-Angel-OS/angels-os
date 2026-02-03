import type { CollectionConfig } from 'payload'

/**
 * Message within a Space.
 * channel is the channel name (string) for template compatibility;
 * can be upgraded to relationship to Channels when needed.
 */
export const Messages: CollectionConfig = {
  slug: 'messages',
  admin: {
    group: 'Angel OS',
    useAsTitle: 'id',
    defaultColumns: ['content', 'space', 'channel', 'messageType', 'author'],
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    {
      name: 'author',
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
      name: 'channel',
      type: 'text',
      required: true,
      admin: { description: 'Channel name (e.g. welcome, general, support)' },
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
    },
    {
      name: 'messageType',
      type: 'select',
      defaultValue: 'user',
      options: [
        { label: 'User', value: 'user' },
        { label: 'System', value: 'system' },
        { label: 'Announcement', value: 'announcement' },
        { label: 'AI Agent', value: 'ai_agent' },
      ],
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      admin: { description: 'Tenant for scoping (derived from space)' },
    },
  ],
}
