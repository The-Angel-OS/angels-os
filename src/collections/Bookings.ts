import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { authenticatedOrPublished } from '@/access/authenticatedOrPublished'

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'bookingType', 'startDateTime', 'status', 'tenant'],
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
        description: 'Display name for this booking (e.g., "Massage with Sarah")',
      },
    },
    {
      name: 'bookingType',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Service Session',
          value: 'service',
        },
        {
          label: 'Consultation',
          value: 'consultation',
        },
        {
          label: 'Equipment Rental',
          value: 'rental',
        },
        {
          label: 'Class/Workshop',
          value: 'class',
        },
        {
          label: 'Event Ticket',
          value: 'event',
        },
        {
          label: 'Custom',
          value: 'custom',
        },
      ],
      defaultValue: 'service',
    },
    {
      name: 'description',
      type: 'richText',
      admin: {
        description: 'Detailed description of what this booking includes',
      },
    },
    {
      name: 'provider',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'The person or resource providing this service',
      },
    },
    {
      name: 'client',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'The person booking this service',
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
        description: 'When this booking starts',
      },
    },
    {
      name: 'endDateTime',
      type: 'date',
      required: true,
      admin: {
        date: {
          pickerAppearance: 'dayAndTime',
        },
        description: 'When this booking ends',
      },
    },
    {
      name: 'duration',
      type: 'number',
      required: true,
      admin: {
        description: 'Duration in minutes',
        step: 15,
      },
      defaultValue: 60,
    },
    {
      name: 'pricing',
      type: 'group',
      fields: [
        {
          name: 'amount',
          type: 'number',
          required: true,
          admin: {
            description: 'Base price for this booking',
          },
        },
        {
          name: 'currency',
          type: 'select',
          required: true,
          options: [
            {
              label: 'USD',
              value: 'usd',
            },
            {
              label: 'EUR',
              value: 'eur',
            },
          ],
          defaultValue: 'usd',
        },
        {
          name: 'splitConfiguration',
          type: 'group',
          admin: {
            description: 'Ultimate Fair payment distribution',
          },
          fields: [
            {
              name: 'providerShare',
              type: 'number',
              required: true,
              defaultValue: 60,
              admin: {
                description: 'Provider percentage (default: 60%)',
                step: 0.1,
              },
            },
            {
              name: 'platformShare',
              type: 'number',
              required: true,
              defaultValue: 20,
              admin: {
                description: 'Platform percentage (default: 20%)',
                step: 0.1,
              },
            },
            {
              name: 'operationsShare',
              type: 'number',
              required: true,
              defaultValue: 15,
              admin: {
                description: 'Operations percentage (default: 15%)',
                step: 0.1,
              },
            },
            {
              name: 'justiceShare',
              type: 'number',
              required: true,
              defaultValue: 5,
              admin: {
                description: 'Justice Fund percentage (default: 5%)',
                step: 0.1,
              },
            },
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
          label: 'Pending',
          value: 'pending',
        },
        {
          label: 'Confirmed',
          value: 'confirmed',
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
          label: 'Cancelled',
          value: 'cancelled',
        },
        {
          label: 'No Show',
          value: 'no-show',
        },
      ],
      defaultValue: 'pending',
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
            {
              label: 'At Provider Location',
              value: 'provider',
            },
            {
              label: 'At Client Location',
              value: 'client',
            },
            {
              label: 'Remote/Online',
              value: 'remote',
            },
            {
              label: 'Custom Location',
              value: 'custom',
            },
          ],
          defaultValue: 'provider',
        },
        {
          name: 'address',
          type: 'textarea',
          admin: {
            condition: (data) => data.location?.type !== 'remote',
            description: 'Physical address for the booking',
          },
        },
        {
          name: 'remoteDetails',
          type: 'group',
          admin: {
            condition: (data) => data.location?.type === 'remote',
          },
          fields: [
            {
              name: 'platform',
              type: 'select',
              options: [
                { label: 'Zoom', value: 'zoom' },
                { label: 'Google Meet', value: 'google-meet' },
                { label: 'Angel OS Live', value: 'angelos-live' },
                { label: 'Custom', value: 'custom' },
              ],
            },
            {
              name: 'meetingLink',
              type: 'text',
            },
            {
              name: 'accessCode',
              type: 'text',
            },
          ],
        },
      ],
    },
    {
      name: 'requirements',
      type: 'group',
      fields: [
        {
          name: 'clientPreparation',
          type: 'richText',
          admin: {
            description: 'What the client should do to prepare',
          },
        },
        {
          name: 'cancellationPolicy',
          type: 'richText',
          admin: {
            description: 'Cancellation terms and timing requirements',
          },
        },
        {
          name: 'specialInstructions',
          type: 'richText',
          admin: {
            description: 'Any special requirements or instructions',
          },
        },
      ],
    },
    {
      name: 'notifications',
      type: 'group',
      fields: [
        {
          name: 'confirmationSent',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'reminderSent',
          type: 'checkbox',
          defaultValue: false,
        },
        {
          name: 'followUpSent',
          type: 'checkbox',
          defaultValue: false,
        },
      ],
    },
    {
      name: 'integration',
      type: 'group',
      admin: {
        description: 'External system integration data',
      },
      fields: [
        {
          name: 'stripePaymentIntent',
          type: 'text',
          admin: {
            readOnly: true,
            description: 'Stripe payment intent ID',
          },
        },
        {
          name: 'calendarEventId',
          type: 'text',
          admin: {
            readOnly: true,
            description: 'Calendar system event ID',
          },
        },
        {
          name: 'leoConversationId',
          type: 'text',
          admin: {
            readOnly: true,
            description: 'LEO conversation thread for this booking',
          },
        },
      ],
    },
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Additional booking-specific data',
      },
    },
  ],
  timestamps: true,
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        // Calculate end time from start + duration
        if (data.startDateTime && data.duration) {
          const startTime = new Date(data.startDateTime)
          const endTime = new Date(startTime.getTime() + data.duration * 60000)
          data.endDateTime = endTime.toISOString()
        }

        // Validate Ultimate Fair percentages sum to 100
        if (data.pricing?.splitConfiguration) {
          const {
            providerShare = 60,
            platformShare = 20,
            operationsShare = 15,
            justiceShare = 5,
          } = data.pricing.splitConfiguration

          const total = providerShare + platformShare + operationsShare + justiceShare
          if (Math.abs(total - 100) > 0.01) {
            throw new Error(`Payment split percentages must sum to 100%. Current total: ${total}%`)
          }
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation, previousDoc }) => {
        // TODO: Integrate with notification system
        // TODO: Sync with calendar systems
        // TODO: Create LEO conversation thread if needed
        
        // Example: Status change notifications
        if (operation === 'update' && previousDoc.status !== doc.status) {
          // Notify client and provider of status change
          console.log(`Booking ${doc.id} status changed from ${previousDoc.status} to ${doc.status}`)
        }

        return doc
      },
    ],
  },
}