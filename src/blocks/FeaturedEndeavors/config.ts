import type { Block } from 'payload'

export const FeaturedEndeavors: Block = {
  slug: 'featuredEndeavors',
  interfaceName: 'FeaturedEndeavorsBlock',
  labels: {
    singular: 'Featured Endeavors',
    plural: 'Featured Endeavors',
  },
  fields: [
    {
      name: 'heading',
      type: 'text',
      defaultValue: 'Featured Endeavors',
      admin: {
        description: 'Section heading displayed above the endeavor cards',
      },
    },
    {
      name: 'subheading',
      type: 'textarea',
      admin: {
        description: 'Optional description below the heading',
      },
    },
    {
      name: 'source',
      type: 'select',
      defaultValue: 'recent',
      options: [
        { label: 'Most Recent', value: 'recent' },
        { label: 'Hand-Picked', value: 'manual' },
      ],
      admin: {
        description:
          'Choose "Most Recent" to auto-display the 5 latest active endeavors, or "Hand-Picked" to select specific ones.',
      },
    },
    {
      name: 'endeavors',
      type: 'relationship',
      relationTo: 'endeavors',
      hasMany: true,
      maxRows: 12,
      admin: {
        isSortable: true,
        description: 'Select specific endeavors to feature (only used when source is "Hand-Picked")',
        condition: (_, siblingData) => siblingData?.source === 'manual',
      },
    },
    {
      name: 'maxItems',
      type: 'number',
      defaultValue: 5,
      min: 1,
      max: 12,
      admin: {
        description: 'Maximum number of endeavors to display (used when source is "Most Recent")',
        condition: (_, siblingData) => siblingData?.source === 'recent',
      },
    },
    {
      name: 'layout',
      type: 'select',
      defaultValue: 'grid',
      options: [
        { label: 'Grid (3 columns)', value: 'grid' },
        { label: 'Carousel (rotating)', value: 'carousel' },
        { label: 'Featured + Grid (hero card + smaller)', value: 'featured' },
      ],
      admin: {
        description: 'How the endeavor cards are displayed',
      },
    },
    {
      name: 'showDescription',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Display the endeavor description/tagline',
      },
    },
    {
      name: 'showRegion',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description: 'Display the endeavor region/location',
      },
    },
  ],
}
