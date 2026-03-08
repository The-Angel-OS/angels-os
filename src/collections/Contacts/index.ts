import type { CollectionConfig } from 'payload'
import { checkRole } from '@/access/utilities'
import { enforceUniqueEmailPerTenant } from './hooks/enforceUniqueEmailPerTenant'

/**
 * CRM Contacts — source of truth for all imported/manual contacts.
 *
 * Tenant-scoped (auto-injected by multiTenantPlugin).
 * Used for bulk import from Clerk, CSV, and manual entry,
 * and for tracking invite status through the funnel.
 */
export const Contacts: CollectionConfig = {
  slug: 'contacts',
  admin: {
    group: 'Configuration',
    useAsTitle: 'email',
    defaultColumns: ['email', 'name', 'source', 'contactStatus', 'inviteStatus'],
    description: 'CRM contact records for invite management',
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) =>
      Boolean(user && checkRole(['super_admin', 'admin'], user)),
  },
  hooks: {
    beforeValidate: [enforceUniqueEmailPerTenant],
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      required: true,
      index: true,
      admin: { description: 'Contact email address' },
    },
    {
      name: 'name',
      type: 'text',
      admin: { description: 'Contact display name (optional)' },
    },
    {
      name: 'source',
      type: 'select',
      required: true,
      defaultValue: 'manual',
      options: [
        { label: 'Clerk LMS', value: 'clerk-lms' },
        { label: 'Manual Entry', value: 'manual' },
        { label: 'CSV Import', value: 'csv-import' },
        { label: 'JSON Import', value: 'json-import' },
        { label: 'Signup', value: 'signup' },
        { label: 'Referral', value: 'referral' },
        { label: 'API', value: 'api' },
      ],
      index: true,
      admin: { description: 'Where this contact was sourced from' },
    },
    {
      name: 'sourceId',
      type: 'text',
      admin: { description: 'External ID from source system (Clerk user_xxx, etc.)' },
    },
    {
      name: 'tags',
      type: 'text',
      hasMany: true,
      admin: { description: 'Tags for segmentation (e.g. "lms-student", "beta-tester")' },
    },
    {
      name: 'contactStatus',
      type: 'select',
      defaultValue: 'lead',
      options: [
        { label: 'Lead', value: 'lead' },
        { label: 'Invited', value: 'invited' },
        { label: 'Accepted', value: 'accepted' },
        { label: 'Bounced', value: 'bounced' },
        { label: 'Unsubscribed', value: 'unsubscribed' },
      ],
      index: true,
      admin: { description: 'Overall contact lifecycle status' },
    },
    {
      name: 'inviteStatus',
      type: 'select',
      defaultValue: 'not-invited',
      options: [
        { label: 'Not Invited', value: 'not-invited' },
        { label: 'Pending', value: 'pending' },
        { label: 'Accepted', value: 'accepted' },
        { label: 'Expired', value: 'expired' },
        { label: 'Failed', value: 'failed' },
      ],
      index: true,
      admin: { description: 'Current invitation status' },
    },
    {
      name: 'lastInvitedAt',
      type: 'date',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'inviteCount',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Number of times invited' },
    },
    {
      name: 'notes',
      type: 'textarea',
      admin: { description: 'Internal notes about this contact' },
    },
  ],
}
