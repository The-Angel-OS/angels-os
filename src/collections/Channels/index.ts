import type { CollectionConfig } from 'payload'

import { simpleSlugField } from '@/fields/simpleSlugField'

/**
 * Discord-style channel within a Space.
 * Used for organizing messages (welcome, general, support, sales, etc.).
 */
export const Channels: CollectionConfig = {
  slug: 'channels',
  admin: {
    group: 'Angel OS',
    useAsTitle: 'name',
    defaultColumns: ['name', 'space', 'type', 'isDefault'],
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
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
      name: 'space',
      type: 'relationship',
      relationTo: 'spaces',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      defaultValue: 'general',
      options: [
        { label: 'General', value: 'general' },
        { label: 'Announcements', value: 'announcements' },
        { label: 'Support', value: 'support' },
        { label: 'Sales', value: 'sales' },
        { label: 'Team', value: 'team' },
        { label: 'Social', value: 'social' },
      ],
    },
    {
      name: 'isDefault',
      type: 'checkbox',
      defaultValue: false,
    },
  ],
}
