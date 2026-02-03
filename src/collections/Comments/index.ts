import type { CollectionConfig } from 'payload'

import { adminOnly } from '@/access/adminOnly'
import { checkRole } from '@/access/utilities'

export const Comments: CollectionConfig = {
  slug: 'comments',
  admin: {
    group: 'Content',
    defaultColumns: ['author', 'content', 'rating', 'isApproved', 'parent', 'updatedAt'],
    useAsTitle: 'id',
    description: 'Comments and reviews on Posts and Products. Product comments include star ratings.',
  },
  access: {
    create: () => true,
    read: ({ req: { user } }) => {
      if (user && checkRole(['super_admin', 'admin'], user)) return true
      return { isApproved: { equals: true } }
    },
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    {
      name: 'parent',
      type: 'relationship',
      relationTo: ['posts', 'products'],
      required: true,
      admin: {
        description: 'The Post or Product this comment is attached to',
      },
    },
    {
      name: 'author',
      type: 'text',
      required: true,
      admin: {
        description: 'Display name for the comment author',
      },
    },
    {
      name: 'email',
      type: 'email',
      required: true,
      admin: {
        description: 'Email of the comment author (not displayed publicly)',
      },
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
      admin: {
        description: 'The comment or review text',
      },
    },
    {
      name: 'rating',
      type: 'number',
      min: 1,
      max: 5,
      admin: {
        description: 'Star rating (1–5). Used for product reviews; optional for post comments.',
        position: 'sidebar',
      },
    },
    {
      name: 'isApproved',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Only approved comments are shown on the frontend',
        position: 'sidebar',
      },
    },
  ],
}
