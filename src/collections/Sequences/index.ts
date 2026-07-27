import type { CollectionConfig } from 'payload'

import { isTenantMember } from '@/access/isTenantMember'
import { publicWithTenantScope } from '@/access/publicWithTenantScope'

/**
 * A timed follow-up sequence — the drip half of the CRM.
 *
 * The platform could already BROADCAST (dashboard/admin/contacts: audience,
 * suppression, metered chunks) but had no concept of "send this in three days,
 * and stop if they buy". Most of a clearance sells on touch three, not touch
 * one, so without this every lead the capture widget collects goes cold.
 *
 * A sequence is a DEFINITION. Who is in it lives in `sequence-enrollments`,
 * because a person's position in a sequence is per-person state and editing the
 * definition must never lose it.
 */
export const Sequences: CollectionConfig = {
  slug: 'sequences',
  admin: {
    group: 'Commerce',
    useAsTitle: 'name',
    defaultColumns: ['name', 'trigger', 'isActive', 'tenant'],
    description: 'Timed follow-up sequences — "day 1, 3, 7", stopping on purchase.',
  },
  access: {
    read: publicWithTenantScope,
    create: isTenantMember,
    update: isTenantMember,
    delete: isTenantMember,
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    {
      name: 'trigger',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'captured',
      options: [
        { label: 'Lead captured', value: 'captured' },
        { label: 'Manual enrolment only', value: 'manual' },
      ],
      admin: { description: 'What enrols someone. Manual = enrolled by a tool or by hand.' },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: false,
      index: true,
      admin: {
        description:
          'Off by default — a half-written sequence must not start emailing the moment it is saved.',
      },
    },
    {
      // The whole point: stop sending discounts to someone who already paid.
      name: 'stopOnPurchase',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'End a person\'s enrolment as soon as they buy.' },
    },
    {
      name: 'steps',
      type: 'array',
      required: true,
      minRows: 1,
      admin: { description: 'Sent in order. Delay is measured from ENROLMENT, not from the previous step.' },
      fields: [
        {
          name: 'delayHours',
          type: 'number',
          required: true,
          defaultValue: 24,
          min: 0,
          admin: {
            description:
              'Hours after enrolment. Absolute, not cumulative — 0 / 24 / 72 / 168 is day 0, 1, 3, 7.',
          },
        },
        { name: 'subject', type: 'text', required: true },
        {
          name: 'body',
          type: 'textarea',
          required: true,
          admin: { description: 'HTML. {{name}} and {{email}} are substituted.' },
        },
      ],
    },
  ],
  timestamps: true,
}
