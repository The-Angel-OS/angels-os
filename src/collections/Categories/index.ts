import { simpleSlugField } from '@/fields/simpleSlugField'
import { publicWithTenantScope } from '@/access/publicWithTenantScope'
import { preventDuplicateSlug } from './hooks/preventDuplicateSlug'
import type { CollectionConfig } from 'payload'

export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    read: publicWithTenantScope,
  },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'slug'],
    listSearchableFields: ['title', 'slug'],
    group: 'Content',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    simpleSlugField,
  ],
  hooks: {
    beforeValidate: [preventDuplicateSlug],
  },
}
