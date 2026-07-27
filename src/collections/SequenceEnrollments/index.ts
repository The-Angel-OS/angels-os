import type { CollectionConfig } from 'payload'

import { isTenantMember } from '@/access/isTenantMember'

/**
 * One person's position in one sequence.
 *
 * Separate from `sequences` because this is per-person STATE — editing a
 * sequence's wording must never reset where 1,500 people are in it.
 *
 * `nextSendAt` is the whole design: the tick queries for enrolments that are
 * due, rather than walking every contact on every run. Indexed, because at
 * campaign scale this query runs every few minutes.
 */
export const SequenceEnrollments: CollectionConfig = {
  slug: 'sequence-enrollments',
  admin: {
    group: 'Commerce',
    useAsTitle: 'id',
    defaultColumns: ['contact', 'sequence', 'status', 'currentStep', 'nextSendAt'],
    description: 'Who is in which sequence, and what is due next.',
  },
  access: {
    read: isTenantMember,
    create: isTenantMember,
    update: isTenantMember,
    delete: isTenantMember,
  },
  fields: [
    // No `tenant` field here: the multi-tenant plugin adds one (this collection
    // is registered with it), and declaring a second is a DuplicateFieldName at
    // config build. Writes still pass `tenant` in data — same field name.
    { name: 'sequence', type: 'relationship', relationTo: 'sequences', required: true, index: true },
    { name: 'contact', type: 'relationship', relationTo: 'contacts', required: true, index: true },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Completed', value: 'completed' },
        { label: 'Stopped', value: 'stopped' },
      ],
    },
    {
      name: 'stoppedReason',
      type: 'select',
      options: [
        { label: 'Purchased', value: 'purchased' },
        { label: 'Unsubscribed', value: 'unsubscribed' },
        { label: 'Manually stopped', value: 'manual' },
        { label: 'Send failed repeatedly', value: 'failed' },
      ],
      admin: { description: 'Why it ended. "purchased" is the one you want to see a lot of.' },
    },
    {
      name: 'currentStep',
      type: 'number',
      required: true,
      defaultValue: 0,
      admin: { description: 'Index of the NEXT step to send.' },
    },
    {
      name: 'nextSendAt',
      type: 'date',
      index: true,
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'When the next step is due. Empty once finished.',
      },
    },
    {
      name: 'enrolledAt',
      type: 'date',
      required: true,
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'lastSentAt',
      type: 'date',
      admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'sendFailures',
      type: 'number',
      defaultValue: 0,
      admin: {
        readOnly: true,
        description: 'Consecutive failures. A permanently failing address stops rather than retrying forever.',
      },
    },
  ],
  timestamps: true,
}
