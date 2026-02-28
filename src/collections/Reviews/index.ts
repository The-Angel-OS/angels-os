import type { CollectionConfig } from 'payload'
import { publicWithTenantScope } from '@/access/publicWithTenantScope'

/**
 * Reviews collection — customer feedback and ratings.
 *
 * Supports multiple sources: Angel OS native, Google Places import, manual.
 * Tenant-scoped through the multi-tenant plugin.
 */
export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    group: 'Commerce',
    useAsTitle: 'author',
    defaultColumns: ['author', 'rating', 'source', 'isVerified', 'publishedAt'],
    description: 'Customer feedback and ratings — native, Google Places import, or manual entry.',
  },
  access: {
    read: publicWithTenantScope,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) =>
      Boolean(
        user &&
          'roles' in user &&
          Array.isArray(user.roles) &&
          (user.roles.includes('admin') || user.roles.includes('super_admin')),
      ),
  },
  fields: [
    {
      name: 'author',
      type: 'text',
      required: true,
      admin: { description: 'Reviewer display name' },
    },
    {
      name: 'authorEmail',
      type: 'email',
      admin: { description: 'Reviewer email (private, for deduplication)' },
    },
    {
      name: 'rating',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
      admin: { description: 'Star rating (1-5)' },
    },
    {
      name: 'content',
      type: 'textarea',
      required: true,
      admin: { description: 'Review text' },
    },
    {
      name: 'source',
      type: 'select',
      index: true,
      defaultValue: 'angelos',
      options: [
        { label: 'Angel OS', value: 'angelos' },
        { label: 'Google', value: 'google' },
        { label: 'Manual', value: 'manual' },
      ],
      admin: { description: 'Where this review originated' },
    },
    {
      name: 'externalId',
      type: 'text',
      admin: {
        description: 'External review ID (e.g., Google Places review ID)',
        condition: (_, siblingData) => siblingData?.source === 'google',
      },
    },
    {
      name: 'isVerified',
      type: 'checkbox',
      defaultValue: false,
      admin: { description: 'Verified purchase/customer' },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: { description: 'When the review was published' },
    },
    {
      name: 'response',
      type: 'group',
      admin: { description: 'Business owner response to this review' },
      fields: [
        {
          name: 'content',
          type: 'textarea',
          admin: { description: 'Response text' },
        },
        {
          name: 'respondedAt',
          type: 'date',
        },
        {
          name: 'respondedBy',
          type: 'relationship',
          relationTo: 'users',
        },
      ],
    },
    {
      name: 'product',
      index: true,
      type: 'relationship',
      relationTo: 'products',
      admin: {
        description: 'Product this review is about (optional)',
        position: 'sidebar',
      },
    },
  ],
}
