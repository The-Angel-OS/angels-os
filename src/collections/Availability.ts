import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { tenantField } from '@/fields/tenantField'

export const Availability: CollectionConfig = {
  slug: 'availability',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'provider', 'dayOfWeek', 'startTime', 'endTime', 'isActive'],
    group: 'Commerce',
  },
  access: {
    create: authenticated,
    read: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    tenantField,
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Name for this availability slot (e.g., "Monday Morning Appointments")',
      },
    },
    {
      name: 'provider',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      admin: {
        description: 'The person or resource this availability applies to',
      },
    },
    {
      name: 'availabilityType',
      type: 'select',
      required: true,
      options: [
        {
          label: 'Recurring Weekly',
          value: 'weekly',
        },
        {
          label: 'Specific Date Range',
          value: 'date-range',
        },
        {
          label: 'One-Time Block',
          value: 'one-time',
        },
      ],
      defaultValue: 'weekly',
    },
    {
      name: 'weeklySchedule',
      type: 'group',
      admin: {
        condition: (data) => data.availabilityType === 'weekly',
        description: 'Recurring weekly availability',
      },
      fields: [
        {
          name: 'dayOfWeek',
          type: 'select',
          required: true,
          options: [
            { label: 'Sunday', value: 0 },
            { label: 'Monday', value: 1 },
            { label: 'Tuesday', value: 2 },
            { label: 'Wednesday', value: 3 },
            { label: 'Thursday', value: 4 },
            { label: 'Friday', value: 5 },
            { label: 'Saturday', value: 6 },
          ],
        },
        {
          name: 'startTime',
          type: 'text',
          required: true,
          admin: {
            description: 'Start time (24-hour format, e.g., "09:00")',
          },
          validate: (value) => {
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
            if (!timeRegex.test(value)) {
              return 'Please enter time in HH:MM format (e.g., 09:00)'
            }
            return true
          },
        },
        {
          name: 'endTime',
          type: 'text',
          required: true,
          admin: {
            description: 'End time (24-hour format, e.g., "17:00")',
          },
          validate: (value) => {
            const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
            if (!timeRegex.test(value)) {
              return 'Please enter time in HH:MM format (e.g., 17:00)'
            }
            return true
          },
        },
      ],
    },
    {
      name: 'dateRange',
      type: 'group',
      admin: {
        condition: (data) => data.availabilityType === 'date-range',
        description: 'Specific date range availability',
      },
      fields: [
        {
          name: 'startDate',
          type: 'date',
          required: true,
          admin: {
            date: {
              pickerAppearance: 'dayOnly',
            },
          },
        },
        {
          name: 'endDate',
          type: 'date',
          required: true,
          admin: {
            date: {
              pickerAppearance: 'dayOnly',
            },
          },
        },
        {
          name: 'startTime',
          type: 'text',
          required: true,
          admin: {
            description: 'Daily start time (24-hour format)',
          },
        },
        {
          name: 'endTime',
          type: 'text',
          required: true,
          admin: {
            description: 'Daily end time (24-hour format)',
          },
        },
      ],
    },
    {
      name: 'oneTimeBlock',
      type: 'group',
      admin: {
        condition: (data) => data.availabilityType === 'one-time',
        description: 'One-time availability block',
      },
      fields: [
        {
          name: 'startDateTime',
          type: 'date',
          required: true,
          admin: {
            date: {
              pickerAppearance: 'dayAndTime',
            },
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
          },
        },
      ],
    },
    {
      name: 'slotDuration',
      type: 'number',
      required: true,
      defaultValue: 60,
      admin: {
        description: 'Duration of each bookable slot in minutes',
        step: 15,
      },
    },
    {
      name: 'bufferTime',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'Buffer time between slots in minutes',
        step: 5,
      },
    },
    {
      name: 'maxAdvanceBooking',
      type: 'number',
      defaultValue: 30,
      admin: {
        description: 'Maximum days in advance bookings can be made',
      },
    },
    {
      name: 'minAdvanceBooking',
      type: 'number',
      defaultValue: 1,
      admin: {
        description: 'Minimum hours in advance bookings must be made',
      },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      required: true,
      defaultValue: true,
      admin: {
        description: 'Whether this availability is currently active',
      },
    },
    {
      name: 'exceptions',
      type: 'array',
      admin: {
        description: 'Specific dates when this availability does not apply',
      },
      fields: [
        {
          name: 'date',
          type: 'date',
          required: true,
          admin: {
            date: {
              pickerAppearance: 'dayOnly',
            },
          },
        },
        {
          name: 'reason',
          type: 'text',
          admin: {
            description: 'Optional reason for the exception',
          },
        },
        {
          name: 'alternativeAvailability',
          type: 'group',
          admin: {
            description: 'Alternative availability for this date (optional)',
          },
          fields: [
            {
              name: 'startTime',
              type: 'text',
            },
            {
              name: 'endTime',
              type: 'text',
            },
          ],
        },
      ],
    },
    {
      name: 'serviceTypes',
      type: 'array',
      admin: {
        description: 'Types of services available during these times',
      },
      fields: [
        {
          name: 'serviceType',
          type: 'select',
          options: [
            { label: 'Service Session', value: 'service' },
            { label: 'Consultation', value: 'consultation' },
            { label: 'Equipment Rental', value: 'rental' },
            { label: 'Class/Workshop', value: 'class' },
            { label: 'Event Ticket', value: 'event' },
            { label: 'Custom', value: 'custom' },
          ],
        },
        {
          name: 'maxConcurrent',
          type: 'number',
          defaultValue: 1,
          admin: {
            description: 'Maximum concurrent bookings of this type',
          },
        },
      ],
    },
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Additional availability configuration',
      },
    },
  ],
  timestamps: true,
  hooks: {
    beforeValidate: [
      async ({ data }) => {
        // Auto-generate title if not provided
        if (!data.title && data.provider) {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
          
          if (data.availabilityType === 'weekly' && data.weeklySchedule) {
            const dayName = dayNames[data.weeklySchedule.dayOfWeek]
            data.title = `${dayName} ${data.weeklySchedule.startTime}-${data.weeklySchedule.endTime}`
          } else if (data.availabilityType === 'date-range' && data.dateRange) {
            data.title = `${data.dateRange.startDate} to ${data.dateRange.endDate}`
          } else if (data.availabilityType === 'one-time' && data.oneTimeBlock) {
            data.title = `One-time: ${data.oneTimeBlock.startDateTime}`
          }
        }

        return data
      },
    ],
    beforeChange: [
      async ({ data }) => {
        // Validate time ranges
        if (data.weeklySchedule) {
          const { startTime, endTime } = data.weeklySchedule
          if (startTime >= endTime) {
            throw new Error('Start time must be before end time')
          }
        }

        if (data.dateRange) {
          const { startDate, endDate, startTime, endTime } = data.dateRange
          if (new Date(startDate) > new Date(endDate)) {
            throw new Error('Start date must be before or equal to end date')
          }
          if (startTime >= endTime) {
            throw new Error('Start time must be before end time')
          }
        }

        if (data.oneTimeBlock) {
          const { startDateTime, endDateTime } = data.oneTimeBlock
          if (new Date(startDateTime) >= new Date(endDateTime)) {
            throw new Error('Start datetime must be before end datetime')
          }
        }

        return data
      },
    ],
  },
}