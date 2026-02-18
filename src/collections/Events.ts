import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { authenticatedOrPublished } from '@/access/authenticatedOrPublished'

export const Events: CollectionConfig = {
  slug: 'events',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'eventType', 'startDateTime', 'status', 'tenant'],
    group: 'Commerce',
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
        description: 'Event name (e.g., "Dovydas Fan Meetup")',
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      admin: {
        description: 'URL slug — auto-generated from title if not set',
      },
    },
    {
      name: 'description',
      type: 'richText',
      admin: {
        description: 'Full event description',
      },
    },
    {
      name: 'eventType',
      type: 'select',
      required: true,
      options: [
        { label: 'Meetup', value: 'meetup' },
        { label: 'Workshop', value: 'workshop' },
        { label: 'Livestream', value: 'livestream' },
        { label: 'Conference', value: 'conference' },
        { label: 'Screening', value: 'screening' },
        { label: 'Custom', value: 'custom' },
      ],
      defaultValue: 'meetup',
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Upcoming', value: 'upcoming' },
        { label: 'Live', value: 'live' },
        { label: 'Completed', value: 'completed' },
        { label: 'Cancelled', value: 'cancelled' },
      ],
      defaultValue: 'draft',
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Hero/cover image for the event',
      },
    },
    {
      name: 'host',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'Event organizer',
      },
    },
    {
      name: 'startDateTime',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'When the event starts',
      },
    },
    {
      name: 'endDateTime',
      type: 'date',
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'When the event ends (auto-calculated from start + duration if not set)',
      },
    },
    {
      name: 'duration',
      type: 'number',
      defaultValue: 60,
      admin: {
        description: 'Duration in minutes',
        step: 15,
      },
    },
    {
      name: 'timezone',
      type: 'text',
      admin: {
        description: 'Timezone (e.g., "America/New_York")',
        placeholder: 'America/New_York',
      },
    },
    {
      name: 'location',
      type: 'group',
      fields: [
        {
          name: 'type',
          type: 'select',
          required: true,
          options: [
            { label: 'In-Person', value: 'in-person' },
            { label: 'Virtual', value: 'virtual' },
            { label: 'Hybrid', value: 'hybrid' },
          ],
          defaultValue: 'in-person',
        },
        {
          name: 'venueName',
          type: 'text',
          admin: {
            condition: (data) => data.location?.type !== 'virtual',
            description: 'Venue name',
          },
        },
        {
          name: 'address',
          type: 'textarea',
          admin: {
            condition: (data) => data.location?.type !== 'virtual',
            description: 'Physical address',
          },
        },
        {
          name: 'remoteLink',
          type: 'text',
          admin: {
            condition: (data) =>
              data.location?.type === 'virtual' || data.location?.type === 'hybrid',
            description: 'Virtual meeting link',
          },
        },
        {
          name: 'remotePlatform',
          type: 'select',
          options: [
            { label: 'Zoom', value: 'zoom' },
            { label: 'Google Meet', value: 'google-meet' },
            { label: 'Angel OS Live', value: 'angelos-live' },
            { label: 'YouTube Live', value: 'youtube-live' },
            { label: 'Twitch', value: 'twitch' },
            { label: 'Custom', value: 'custom' },
          ],
          admin: {
            condition: (data) =>
              data.location?.type === 'virtual' || data.location?.type === 'hybrid',
          },
        },
      ],
    },
    {
      name: 'capacity',
      type: 'group',
      fields: [
        {
          name: 'maxAttendees',
          type: 'number',
          defaultValue: 0,
          admin: {
            description: 'Maximum attendees (0 = unlimited)',
          },
        },
        {
          name: 'waitlistEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Allow waitlist when capacity is reached',
          },
        },
      ],
    },
    {
      name: 'registration',
      type: 'group',
      fields: [
        {
          name: 'isOpen',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'Registration is currently open',
          },
        },
        {
          name: 'requiresApproval',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Registrations require host approval',
          },
        },
        {
          name: 'registrationDeadline',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
            description: 'Registration closes at this time (optional)',
          },
        },
        {
          name: 'allowLateRegistration',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              'Allow registration after event completes (for "stay in the loop" / future updates)',
          },
        },
      ],
    },
    {
      name: 'pricing',
      type: 'group',
      fields: [
        {
          name: 'isFree',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description: 'This is a free event',
          },
        },
        {
          name: 'amount',
          type: 'number',
          admin: {
            condition: (data) => !data.pricing?.isFree,
            description: 'Ticket price',
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
          admin: {
            condition: (data) => !data.pricing?.isFree,
          },
        },
        {
          name: 'splitConfiguration',
          type: 'group',
          admin: {
            condition: (data) => !data.pricing?.isFree,
            description: 'Ultimate Fair payment distribution',
          },
          fields: [
            {
              name: 'providerShare',
              type: 'number',
              defaultValue: 60,
              admin: { description: 'Host percentage (default: 60%)', step: 0.1 },
            },
            {
              name: 'platformShare',
              type: 'number',
              defaultValue: 20,
              admin: { description: 'Platform percentage (default: 20%)', step: 0.1 },
            },
            {
              name: 'operationsShare',
              type: 'number',
              defaultValue: 15,
              admin: { description: 'Operations percentage (default: 15%)', step: 0.1 },
            },
            {
              name: 'justiceShare',
              type: 'number',
              defaultValue: 5,
              admin: { description: 'Justice Fund percentage (default: 5%)', step: 0.1 },
            },
          ],
        },
      ],
    },
    {
      name: 'announceToAIBus',
      type: 'checkbox',
      defaultValue: true,
      admin: {
        description:
          'Post announcements to AI Bus when event status changes (e.g., goes live). Disable for quiet/private events.',
      },
    },
    {
      name: 'tags',
      type: 'array',
      admin: {
        description: 'Tags for filtering and discovery',
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
      name: 'space',
      type: 'relationship',
      relationTo: 'spaces',
      admin: {
        description: 'Associated space for AI Bus announcements',
      },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Additional event-specific data',
      },
    },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      async ({ data, operation }) => {
        if (!data) return data

        // Auto-generate slug from title
        if (data.title && !data.slug) {
          data.slug = data.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
        }

        // Calculate endDateTime from start + duration
        if (data.startDateTime && data.duration && !data.endDateTime) {
          const start = new Date(data.startDateTime)
          data.endDateTime = new Date(start.getTime() + data.duration * 60000).toISOString()
        }

        // Validate Ultimate Fair percentages
        if (data.pricing?.splitConfiguration && !data.pricing?.isFree) {
          const {
            providerShare = 60,
            platformShare = 20,
            operationsShare = 15,
            justiceShare = 5,
          } = data.pricing.splitConfiguration

          const total = providerShare + platformShare + operationsShare + justiceShare
          if (Math.abs(total - 100) > 0.01) {
            throw new Error(
              `Payment split percentages must sum to 100%. Current total: ${total}%`,
            )
          }
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, previousDoc, req, operation }) => {
        // Post AI Bus announcement when status changes to upcoming or live
        if (!doc.announceToAIBus) return doc
        if (!doc.space) return doc

        const statusChanged = operation === 'update' && previousDoc?.status !== doc.status
        const isNewUpcoming = operation === 'create' && doc.status === 'upcoming'

        if (
          (statusChanged && (doc.status === 'upcoming' || doc.status === 'live')) ||
          isNewUpcoming
        ) {
          try {
            const emoji = doc.status === 'live' ? '🔴' : '📅'
            const statusLabel = doc.status === 'live' ? 'LIVE NOW' : 'Upcoming'
            const text = `${emoji} **${statusLabel}: ${doc.title}** — ${new Date(doc.startDateTime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`

            await req.payload.create({
              collection: 'messages',
              data: {
                space: typeof doc.space === 'object' ? doc.space.id : doc.space,
                channel: 'general',
                content: { type: 'text', text },
                messageType: 'announcement',
                visibility: 'tenant',
                priority: doc.status === 'live' ? 'high' : 'normal',
                status: 'active',
              } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
              req,
              overrideAccess: true,
            })
          } catch {
            // Non-critical: don't fail event save if AI Bus announcement fails
          }
        }

        return doc
      },
    ],
  },
}
