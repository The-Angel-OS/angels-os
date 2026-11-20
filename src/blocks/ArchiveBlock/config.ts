import type { Block } from 'payload'

import {
  FixedToolbarFeature,
  HeadingFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'

import { tenantFilterOptions } from '@/fields/tenantFilterOptions'

export const Archive: Block = {
  slug: 'archive',
  interfaceName: 'ArchiveBlock',
  fields: [
    {
      name: 'introContent',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [
            ...rootFeatures,
            HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
            FixedToolbarFeature(),
            InlineToolbarFeature(),
          ]
        },
      }),
      label: 'Intro Content',
    },
    {
      name: 'populateBy',
      type: 'select',
      defaultValue: 'collection',
      options: [
        {
          label: 'Collection',
          value: 'collection',
        },
        {
          label: 'Individual Selection',
          value: 'selection',
        },
      ],
    },
    {
      name: 'relationTo',
      type: 'select',
      admin: {
        condition: (_, siblingData) => siblingData.populateBy === 'collection',
      },
      defaultValue: 'products',
      label: 'Collections To Show',
      options: [
        {
          label: 'Products',
          value: 'products',
        },
        {
          label: 'Posts',
          value: 'posts',
        },
      ],
    },
    {
      name: 'categories',
      type: 'relationship',
      admin: {
        condition: (_, siblingData) => siblingData.populateBy === 'collection',
      },
      hasMany: true,
      label: 'Categories To Show',
      relationTo: 'categories',
      filterOptions: tenantFilterOptions,
    },
    {
      name: 'limit',
      type: 'number',
      admin: {
        condition: (_, siblingData) => siblingData.populateBy === 'collection',
        step: 1,
      },
      defaultValue: 10,
      label: 'Limit',
    },
    {
      name: 'columns',
      type: 'select',
      defaultValue: '4',
      label: 'Cards per row',
      options: [
        { label: 'Three across', value: '3' },
        { label: 'Four across', value: '4' },
      ],
      admin: {
        description:
          'Three reads as a featured row; four as a listing. Narrow screens always stack.',
      },
    },
    {
      name: 'enableSearch',
      type: 'checkbox',
      defaultValue: false,
      label: 'Enable Search Bar',
      admin: {
        condition: (_, siblingData) => siblingData.populateBy === 'collection',
        description: 'Show a live ?q= keyword search input above the archive grid.',
      },
    },
    {
      name: 'enableCategoryTabs',
      type: 'checkbox',
      defaultValue: false,
      label: 'Enable Category Filter Tabs',
      admin: {
        condition: (_, siblingData) => siblingData.populateBy === 'collection',
        description: 'Render clickable ?category= filter pills from the selected Categories above.',
      },
    },
    {
      name: 'enablePagination',
      type: 'checkbox',
      defaultValue: false,
      label: 'Enable Pagination',
      admin: {
        condition: (_, siblingData) => siblingData.populateBy === 'collection',
        description: 'Paginate results with ?page= links when total items exceed Limit.',
      },
    },
    {
      name: 'selectedDocs',
      type: 'relationship',
      admin: {
        condition: (_, siblingData) => siblingData.populateBy === 'selection',
      },
      hasMany: true,
      label: 'Selection',
      relationTo: ['products', 'posts'],
      filterOptions: tenantFilterOptions,
    },
  ],
  labels: {
    plural: 'Featured Posts & Products',
    singular: 'Featured Posts & Products',
  },
}
