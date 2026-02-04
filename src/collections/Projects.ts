import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { authenticatedOrPublished } from '@/access/authenticatedOrPublished'

export const Projects: CollectionConfig = {
  slug: 'projects',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'client', 'status', 'projectType', 'completedAt', 'tenant'],
    group: 'Portfolio',
  },
  access: {
    create: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Project name (e.g., "Kitchen Remodel - Smith Family")',
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        position: 'sidebar',
        description: 'URL-friendly version of title',
      },
      hooks: {
        beforeValidate: [
          ({ data }) => {
            if (data?.title && !data?.slug) {
              return data.title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '')
            }
            return data?.slug
          },
        ],
      },
    },
    {
      name: 'projectType',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Kitchen Design',
          value: 'kitchen',
        },
        {
          label: 'Bathroom Remodel',
          value: 'bathroom',
        },
        {
          label: 'Cabinet Installation',
          value: 'cabinets',
        },
        {
          label: 'Custom Millwork',
          value: 'millwork',
        },
        {
          label: 'Commercial Casework',
          value: 'commercial',
        },
        {
          label: 'Furniture Build',
          value: 'furniture',
        },
        {
          label: 'Service Appointment',
          value: 'service',
        },
        {
          label: 'Consultation',
          value: 'consultation',
        },
        {
          label: 'Other',
          value: 'other',
        },
      ],
      defaultValue: 'other',
    },
    {
      name: 'description',
      type: 'richText',
      admin: {
        description: 'Detailed project description, scope, and objectives',
      },
    },
    {
      name: 'client',
      type: 'group',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: {
            description: 'Client name (can be anonymized for public display)',
          },
        },
        {
          name: 'displayName',
          type: 'text',
          admin: {
            description: 'Public display name (e.g., "Residential Client - Largo, FL")',
          },
        },
        {
          name: 'contact',
          type: 'group',
          admin: {
            condition: (data, siblingData) => !data?.isPublic,
          },
          fields: [
            {
              name: 'email',
              type: 'email',
            },
            {
              name: 'phone',
              type: 'text',
            },
            {
              name: 'address',
              type: 'textarea',
            },
          ],
        },
      ],
    },
    {
      name: 'timeline',
      type: 'group',
      fields: [
        {
          name: 'startDate',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayOnly',
            },
          },
        },
        {
          name: 'completedAt',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayOnly',
            },
            description: 'Project completion date',
          },
        },
        {
          name: 'estimatedDuration',
          type: 'text',
          admin: {
            description: 'Human-readable duration (e.g., "3 weeks", "2 days")',
          },
        },
      ],
    },
    {
      name: 'budget',
      type: 'group',
      admin: {
        condition: (data) => !data?.isPublic,
      },
      fields: [
        {
          name: 'estimatedCost',
          type: 'number',
          admin: {
            description: 'Initial project estimate',
          },
        },
        {
          name: 'finalCost',
          type: 'number',
          admin: {
            description: 'Actual project cost',
          },
        },
        {
          name: 'currency',
          type: 'select',
          options: [
            { label: 'USD', value: 'usd' },
            { label: 'EUR', value: 'eur' },
          ],
          defaultValue: 'usd',
        },
        {
          name: 'budgetRange',
          type: 'select',
          admin: {
            description: 'Public budget range for portfolio display',
          },
          options: [
            { label: 'Under $1,000', value: 'under-1k' },
            { label: '$1,000 - $5,000', value: '1k-5k' },
            { label: '$5,000 - $15,000', value: '5k-15k' },
            { label: '$15,000 - $50,000', value: '15k-50k' },
            { label: '$50,000+', value: '50k-plus' },
            { label: 'Contact for Quote', value: 'contact' },
          ],
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Planning',
          value: 'planning',
        },
        {
          label: 'In Progress',
          value: 'in-progress',
        },
        {
          label: 'Completed',
          value: 'completed',
        },
        {
          label: 'On Hold',
          value: 'on-hold',
        },
        {
          label: 'Cancelled',
          value: 'cancelled',
        },
      ],
      defaultValue: 'planning',
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'gallery',
      type: 'array',
      admin: {
        description: 'Before, during, and after photos',
      },
      fields: [
        {
          name: 'image',
          type: 'relationship',
          relationTo: 'media',
          required: true,
        },
        {
          name: 'caption',
          type: 'text',
          admin: {
            description: 'Optional caption for the image',
          },
        },
        {
          name: 'stage',
          type: 'select',
          required: true,
          options: [
            { label: 'Before', value: 'before' },
            { label: 'During - Progress', value: 'progress' },
            { label: 'After - Completed', value: 'after' },
            { label: 'Detail Shot', value: 'detail' },
            { label: 'Material/Product', value: 'material' },
          ],
          defaultValue: 'after',
        },
        {
          name: 'isHeroImage',
          type: 'checkbox',
          admin: {
            description: 'Use as the main project image',
          },
        },
      ],
    },
    {
      name: 'materials',
      type: 'array',
      admin: {
        description: 'Materials, products, and vendors used',
      },
      fields: [
        {
          name: 'item',
          type: 'text',
          required: true,
          admin: {
            description: 'Material or product name',
          },
        },
        {
          name: 'vendor',
          type: 'text',
          admin: {
            description: 'Supplier or manufacturer',
          },
        },
        {
          name: 'specifications',
          type: 'text',
          admin: {
            description: 'Size, color, model, etc.',
          },
        },
        {
          name: 'category',
          type: 'select',
          options: [
            { label: 'Cabinetry', value: 'cabinets' },
            { label: 'Countertops', value: 'countertops' },
            { label: 'Hardware', value: 'hardware' },
            { label: 'Appliances', value: 'appliances' },
            { label: 'Flooring', value: 'flooring' },
            { label: 'Lighting', value: 'lighting' },
            { label: 'Plumbing', value: 'plumbing' },
            { label: 'Paint/Finish', value: 'finish' },
            { label: 'Other', value: 'other' },
          ],
        },
        {
          name: 'link',
          type: 'text',
          admin: {
            description: 'Link to product or vendor (optional)',
          },
        },
      ],
    },
    {
      name: 'testimonial',
      type: 'group',
      admin: {
        description: 'Client feedback and testimonial',
      },
      fields: [
        {
          name: 'quote',
          type: 'textarea',
          admin: {
            description: 'Client testimonial quote',
          },
        },
        {
          name: 'rating',
          type: 'number',
          min: 1,
          max: 5,
          admin: {
            description: 'Star rating (1-5)',
            step: 0.5,
          },
        },
        {
          name: 'isPublic',
          type: 'checkbox',
          admin: {
            description: 'Show testimonial publicly',
          },
        },
      ],
    },
    {
      name: 'team',
      type: 'array',
      admin: {
        description: 'Team members who worked on this project',
      },
      fields: [
        {
          name: 'member',
          type: 'relationship',
          relationTo: 'users',
          required: true,
        },
        {
          name: 'role',
          type: 'text',
          required: true,
          admin: {
            description: 'Role in this project (e.g., "Lead Designer", "Installer")',
          },
        },
      ],
    },
    {
      name: 'challenges',
      type: 'array',
      admin: {
        description: 'Challenges faced and how they were solved',
      },
      fields: [
        {
          name: 'challenge',
          type: 'text',
          required: true,
          admin: {
            description: 'Brief description of the challenge',
          },
        },
        {
          name: 'solution',
          type: 'richText',
          admin: {
            description: 'How the challenge was resolved',
          },
        },
      ],
    },
    {
      name: 'relatedProjects',
      type: 'relationship',
      relationTo: 'projects',
      hasMany: true,
      admin: {
        description: 'Similar projects or related work',
      },
    },
    {
      name: 'isPublic',
      type: 'checkbox',
      required: true,
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Show in public portfolio',
      },
    },
    {
      name: 'isFeatured',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        condition: (data) => data?.isPublic,
        description: 'Feature prominently in portfolio',
      },
    },
    {
      name: 'seoTitle',
      type: 'text',
      admin: {
        condition: (data) => data?.isPublic,
        description: 'SEO-optimized title for public pages',
      },
    },
    {
      name: 'seoDescription',
      type: 'textarea',
      admin: {
        condition: (data) => data?.isPublic,
        description: 'Meta description for search engines',
      },
    },
    {
      name: 'tags',
      type: 'array',
      admin: {
        description: 'Tags for categorization and search',
      },
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Additional project-specific data',
      },
    },
  ],
  timestamps: true,
  versions: {
    drafts: true,
  },
  hooks: {
    beforeChange: [
      async ({ data, operation }) => {
        // Auto-generate display name if not provided
        if (data.client?.name && !data.client?.displayName) {
          // Extract city from address or use generic format
          const location = data.client.contact?.address 
            ? data.client.contact.address.split(',').pop()?.trim() || 'Undisclosed Location'
            : 'Undisclosed Location'
          
          data.client.displayName = `Residential Client - ${location}`
        }

        // Set completion date when status changes to completed
        if (data.status === 'completed' && !data.timeline?.completedAt) {
          data.timeline = {
            ...data.timeline,
            completedAt: new Date().toISOString()
          }
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        // TODO: Integrate with LEO for project updates
        // TODO: Send notifications to team members
        // TODO: Generate project reports
        
        if (operation === 'create') {
          console.log(`New project created: ${doc.title}`)
        }

        if (operation === 'update' && doc.status === 'completed') {
          console.log(`Project completed: ${doc.title}`)
          // TODO: Trigger completion workflows
          // TODO: Request client testimonial
          // TODO: Generate final invoice
        }

        return doc
      },
    ],
  },
}