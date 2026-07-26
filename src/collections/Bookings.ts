import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { ownedBy } from '@/access/isDocumentOwner'
import { lexicalEditor } from '@payloadcms/richtext-lexical'

export const Bookings: CollectionConfig = {
  slug: 'bookings',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'bookingType', 'startDateTime', 'status', 'tenant'],
    listSearchableFields: ['title'],
    group: 'Commerce',
    description: 'Appointment and service bookings — links providers, clients, and time slots.',
  },
  access: {
    // Anyone signed in can book. Ownership is enforced on the way back out.
    create: authenticated,
    read: ownedBy('client', 'provider'),
    // Same filter for writes: `authenticated` let any signed-in customer
    // reschedule or cancel a stranger's appointment.
    update: ownedBy('client', 'provider'),
    delete: ownedBy('client', 'provider'),
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
      index: true,
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
      index: true,
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
      // Soft hold: a deposit checkout reserves the slot only until this time. If
      // the deposit isn't paid by then, availability ignores the pending booking
      // so an abandoned checkout stops eating the slot forever. Null = no expiry
      // (a no-deposit REQUEST holds until the owner confirms/declines).
      name: 'holdExpiresAt',
      type: 'date',
      index: true,
      admin: {
        readOnly: true,
        date: { pickerAppearance: 'dayAndTime' },
        description: 'Deposit-hold expiry. Empty = holds until the owner acts.',
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
      defaultValue: 95,
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
            description: 'DEPRECATED — nothing applies these. The live rate is the configured platform fee (95/5 by default); see src/utilities/platformFee.ts.',
          },
          fields: [
            {
              name: 'providerShare',
              type: 'number',
              required: true,
              defaultValue: 95,
              admin: {
                description: 'Provider percentage (deprecated field).',
                step: 0.1,
              },
            },
            {
              name: 'platformShare',
              type: 'number',
              required: true,
              defaultValue: 5,
              admin: {
                description: 'Platform percentage (deprecated field).',
                step: 0.1,
              },
            },
            {
              name: 'operationsShare',
              type: 'number',
              required: true,
              defaultValue: 0,
              admin: {
                description: 'Operations percentage (deprecated field).',
                step: 0.1,
              },
            },
            {
              name: 'justiceShare',
              type: 'number',
              required: true,
              defaultValue: 5,
              admin: {
                description: 'Justice Fund percentage (deprecated field).',
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
      index: true,
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
      name: 'cancellation',
      type: 'group',
      admin: {
        condition: (data) => data.status === 'cancelled',
        description: 'Details about the cancellation',
      },
      fields: [
        {
          name: 'reason',
          type: 'textarea',
          admin: {
            description: 'Why this booking was cancelled',
          },
        },
        {
          name: 'cancelledBy',
          type: 'select',
          options: [
            { label: 'Client', value: 'client' },
            { label: 'Provider', value: 'provider' },
            { label: 'System', value: 'system' },
          ],
          admin: {
            description: 'Who initiated the cancellation',
          },
        },
        {
          name: 'cancelledAt',
          type: 'date',
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
            description: 'When the cancellation occurred',
          },
        },
      ],
    },
    {
      name: 'rescheduling',
      type: 'group',
      admin: {
        description: 'Rescheduling history for this booking',
      },
      fields: [
        {
          name: 'rescheduledFrom',
          type: 'json',
          admin: {
            readOnly: true,
            description: 'Previous time slot before rescheduling',
          },
        },
        {
          name: 'rescheduleCount',
          type: 'number',
          defaultValue: 0,
          admin: {
            readOnly: true,
            description: 'Number of times this booking has been rescheduled',
          },
        },
      ],
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
          editor: lexicalEditor({}),
          admin: {
            description: 'What the client should do to prepare',
          },
        },
        {
          name: 'cancellationPolicy',
          type: 'richText',
          editor: lexicalEditor({}),
          admin: {
            description: 'Cancellation terms and timing requirements',
          },
        },
        {
          name: 'specialInstructions',
          type: 'richText',
          editor: lexicalEditor({}),
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
    {
      // The mirrored event on the provider's Google Calendar. Stored so a
      // reschedule MOVES that event and a cancel REMOVES it — writing without
      // keeping the id would leave orphans on their calendar, which is worse
      // than never writing at all.
      name: 'googleEventId',
      type: 'text',
      admin: { readOnly: true, hidden: true },
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

        // The splitConfiguration validator lived here and BLOCKED CHECKOUT.
        // The field is deprecated — nothing applies it; the live rate is data in
        // src/utilities/platformFee.ts. But its own defaults (95/5/0/5) sum to
        // 105, so any booking created without an explicit split — which is every
        // booking from /book — threw "percentages must sum to 100%" and the
        // deposit could not be paid. A validator guarding a value nothing reads
        // took the money path down with it. @see docs/FOOTGUNS.md §2.3
        //
        // Deleted rather than corrected: making 105 into 100 would keep a rule
        // enforcing a number that has no effect on what anyone is charged.

        return data
      },
    ],
    afterChange: [
      // Mirror the booking onto the provider's own Google Calendar, if they
      // connected one. Entirely fail-soft: the booking is already saved (and
      // possibly paid) before this runs, so a Google outage must never surface
      // here. Every write passes `req` — a hook that writes on its own
      // connection is the 300s deadlock. @see docs/FOOTGUNS.md §2.1
      async ({ doc, req, operation, previousDoc, context }) => {
        // Our own googleEventId write-back re-enters this hook; without the flag
        // it runs a second, pointless pass on every booking.
        if (context?.skipCalendarSync) return doc
        const providerId = typeof doc.provider === 'object' ? doc.provider?.id : doc.provider
        if (!providerId) return doc

        const cancelled = doc.status === 'cancelled'
        const wasCancelled = previousDoc?.status === 'cancelled'
        const timeMoved =
          operation === 'update' &&
          (previousDoc?.startDateTime !== doc.startDateTime ||
            previousDoc?.endDateTime !== doc.endDateTime)

        try {
          const { createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } = await import(
            '@/utilities/googleCalendar'
          )

          if (cancelled && doc.googleEventId) {
            await deleteCalendarEvent(req.payload, providerId, doc.googleEventId)
            await req.payload.update({
              collection: 'bookings',
              id: doc.id,
              data: { googleEventId: null } as Record<string, unknown>,
              depth: 0,
              overrideAccess: true,
              req,
              context: { skipCalendarSync: true },
            })
            return doc
          }

          if (cancelled || wasCancelled) return doc

          if (doc.googleEventId) {
            if (timeMoved) {
              await updateCalendarEvent(req.payload, providerId, doc.googleEventId, {
                start: new Date(doc.startDateTime),
                end: new Date(doc.endDateTime),
                summary: doc.title,
              })
            }
            return doc
          }

          if (operation === 'create') {
            const eventId = await createCalendarEvent(req.payload, providerId, {
              summary: doc.title,
              description: `Booked through The Angel OS.`,
              start: new Date(doc.startDateTime),
              end: new Date(doc.endDateTime),
            })
            if (eventId) {
              await req.payload.update({
                collection: 'bookings',
                id: doc.id,
                data: { googleEventId: eventId } as Record<string, unknown>,
                depth: 0,
                overrideAccess: true,
                req,
                context: { skipCalendarSync: true },
              })
            }
          }
        } catch {
          // Never let a calendar problem touch the booking.
        }
        return doc
      },
      async ({ doc, req, operation, previousDoc }) => {
        // Booking creation notifications (email+ICS, WhatsApp, SMS, LEO thread)
        // are handled by sendBookingConfirmation() in bookingEngine.ts (Sprint 35).
        // This afterChange hook handles status-change notifications.
        if (operation === 'update' && previousDoc.status !== doc.status) {
          // Status transitions are surfaced via booking notification system (bookingEngine.ts)
          // No additional logging needed here — notifications already sent on create/update.
        }

        return doc
      },
    ],
  },
}