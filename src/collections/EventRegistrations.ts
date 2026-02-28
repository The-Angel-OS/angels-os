import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'

export const EventRegistrations: CollectionConfig = {
  slug: 'event-registrations',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['event', 'name', 'email', 'status', 'registrationType', 'attendanceMode'],
    group: 'Commerce',
  },
  access: {
    // Public registration — anyone can sign up
    create: () => true,
    // Authenticated users see own registrations; admins see all
    read: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'event',
      type: 'relationship',
      relationTo: 'events',
      index: true,
      required: true,
      admin: {
        description: 'Which event this registration is for',
      },
    },
    {
      name: 'attendee',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: {
        description: 'Registered user (optional — anonymous registrations use name/email)',
      },
    },
    {
      name: 'name',
      type: 'text',
      admin: {
        description: 'Attendee name (required for anonymous registrations)',
      },
    },
    {
      name: 'email',
      type: 'text',
      index: true,
      admin: {
        description: 'Attendee email (required for anonymous registrations)',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Registered', value: 'registered' },
        { label: 'Waitlisted', value: 'waitlisted' },
        { label: 'Checked In', value: 'checked-in' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'No Show', value: 'no-show' },
      ],
      defaultValue: 'registered',
    },
    {
      name: 'registrationType',
      type: 'select',
      required: true,
      options: [
        { label: 'Pre-Event', value: 'pre-event' },
        { label: 'At Event', value: 'at-event' },
        { label: 'Post-Event (Late)', value: 'post-event' },
      ],
      defaultValue: 'pre-event',
    },
    {
      name: 'attendanceMode',
      type: 'select',
      required: true,
      options: [
        { label: 'In-Person', value: 'in-person' },
        { label: 'Virtual', value: 'virtual' },
        { label: 'Replay', value: 'replay' },
      ],
      defaultValue: 'in-person',
    },
    {
      name: 'checkedInAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'When the attendee checked in',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: {
        description: 'Attendee notes or special requests',
      },
    },
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Additional registration data',
      },
    },
  ],
  timestamps: true,
  hooks: {
    beforeValidate: [
      async ({ data, req, operation }) => {
        if (!data || operation !== 'create') return data

        // Require name or attendee
        if (!data.attendee && !data.name) {
          throw new Error('Either a user account (attendee) or a name is required to register.')
        }
        if (!data.attendee && !data.email) {
          throw new Error('Email is required for anonymous registrations.')
        }

        // Capacity check
        if (data.event) {
          const eventId = typeof data.event === 'object' ? data.event.id : data.event
          const event = await req.payload.findByID({
            collection: 'events',
            id: eventId,
            depth: 0,
          })

          if (!event) throw new Error('Event not found.')

          // Check registration is open
          const reg = event.registration as any
          if (reg && !reg.isOpen) {
            // Allow late registration if enabled and event is completed
            if (!(reg.allowLateRegistration && event.status === 'completed')) {
              throw new Error('Registration is closed for this event.')
            }
          }

          // Check capacity
          const capacity = event.capacity as any
          if (capacity?.maxAttendees && capacity.maxAttendees > 0) {
            const existing = await req.payload.count({
              collection: 'event-registrations',
              where: {
                and: [
                  { event: { equals: eventId } },
                  { status: { not_equals: 'cancelled' } },
                ],
              },
            })

            if (existing.totalDocs >= capacity.maxAttendees) {
              if (capacity.waitlistEnabled) {
                data.status = 'waitlisted'
              } else {
                throw new Error('This event is at full capacity.')
              }
            }
          }

          // Auto-set registrationType based on event status
          if (event.status === 'completed' || event.status === 'cancelled') {
            data.registrationType = 'post-event'
          } else if (event.status === 'live') {
            data.registrationType = 'at-event'
          }
        }

        return data
      },
    ],
    afterChange: [
      async ({ doc, req, operation }) => {
        if (operation !== 'create') return doc

        // Post AI Bus notification for new registration
        try {
          const eventId = typeof doc.event === 'object' ? doc.event.id : doc.event
          const event = await req.payload.findByID({
            collection: 'events',
            id: eventId,
            depth: 1,
          })

          if (event?.space && (event as any).announceToAIBus) {
            const attendeeName = doc.name || doc.email || 'Someone'
            const modeLabel =
              doc.attendanceMode === 'virtual'
                ? ' (virtual)'
                : doc.attendanceMode === 'replay'
                  ? ' (replay)'
                  : ''
            const lateLabel = doc.registrationType === 'post-event' ? ' [late registration]' : ''

            const spaceId =
              typeof event.space === 'object' ? (event.space as any).id : event.space
            await req.payload.create({
              collection: 'messages',
              data: {
                space: spaceId,
                channel: 'general',
                content: {
                  type: 'text',
                  text: `🎟️ **${attendeeName}** registered for **${event.title}**${modeLabel}${lateLabel}`,
                },
                messageType: 'booking',
                visibility: 'tenant',
                priority: 'low',
                status: 'active',
              } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
              req,
              overrideAccess: true,
            })
          }
        } catch {
          // Non-critical
        }

        return doc
      },
    ],
  },
}
