import type { CollectionConfig } from 'payload'
import { checkRole } from '@/access/utilities'
import { enforceUniqueEmailPerTenant } from './hooks/enforceUniqueEmailPerTenant'
import type { CollectionBeforeValidateHook } from 'payload'

/** A contact must be reachable somehow: email OR phone. */
const requireEmailOrPhone: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  const email = (data?.email ?? originalDoc?.email ?? '') as string
  const phone = (data?.phone ?? originalDoc?.phone ?? '') as string
  if (!String(email).trim() && !String(phone).trim()) {
    throw new Error('A contact needs an email address or a phone number.')
  }
  return data
}

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
    listSearchableFields: ['email', 'name', 'sourceId', 'notes'],
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
    beforeValidate: [requireEmailOrPhone, enforceUniqueEmailPerTenant],
  },
  fields: [
    {
      name: 'email',
      type: 'email',
      // Optional since voice leads: a phone call yields a NAME + PHONE; making
      // someone spell an email aloud is where voice leads die. A contact needs
      // email OR phone (enforced in requireEmailOrPhone below).
      required: false,
      index: true,
      admin: { description: 'Contact email address (optional if phone present)' },
    },
    {
      name: 'phone',
      type: 'text',
      index: true,
      admin: { description: 'Phone number (E.164 preferred) — primary channel for voice-captured leads' },
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
        { label: 'Voice Call', value: 'voice' },
        { label: 'Web Form', value: 'web-form' },
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
      // FIRST-touch attribution, captured by the embed widget. First rather than
      // last on purpose: the ad that earned the visit is the one worth crediting,
      // and by the time someone converts they have usually arrived again
      // directly. Without this, "which channel sold it" is unanswerable — which
      // is the only number a campaign is judged on.
      name: 'attribution',
      type: 'group',
      admin: { description: 'Where this contact originally came from (first touch).' },
      fields: [
        { name: 'source', type: 'text', index: true, admin: { description: 'utm_source — e.g. youtube, meta, newsletter' } },
        { name: 'medium', type: 'text', admin: { description: 'utm_medium — e.g. cpc, organic, email' } },
        { name: 'campaign', type: 'text', index: true, admin: { description: 'utm_campaign — e.g. kessela-clearout' } },
        { name: 'landingPage', type: 'text', admin: { description: 'The page they first arrived on' } },
        { name: 'referrer', type: 'text', admin: { description: 'document.referrer at first touch' } },
      ],
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
    // ── Campaign / email metering ──────────────────────────────────────────
    {
      name: 'unsubscribeToken',
      type: 'text',
      index: true,
      admin: {
        description: 'Opaque token for one-click unsubscribe links (generated on first send)',
        readOnly: true,
      },
    },
    {
      name: 'lastEmailedAt',
      type: 'date',
      admin: {
        date: { pickerAppearance: 'dayAndTime' },
        description: 'When this contact was last sent a campaign email',
      },
    },
    {
      name: 'emailCount',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Number of campaign emails sent to this contact' },
    },
  ],
}
