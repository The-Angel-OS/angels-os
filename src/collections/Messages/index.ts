import type { CollectionConfig } from 'payload'

import { runWorkflows } from './hooks/runWorkflows'

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
        { label: 'Inventory', value: 'inventory' },
        { label: 'PDF', value: 'pdf' },
        { label: 'Video', value: 'video' },
      ],
      admin: { description: 'Message type – workflow runners use inventory/pdf/video for structured processing' },
    },
    {
      name: 'attachments',
      type: 'array',
      fields: [
        {
          name: 'media',
          type: 'relationship',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'caption',
          type: 'text',
        },
      ],
      admin: {
        description: 'Attached media (images, PDFs) – workflows can process these',
      },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      admin: { description: 'Tenant for scoping (derived from space)' },
    },
  ],
  hooks: {
    afterChange: [runWorkflows],
  },
}
