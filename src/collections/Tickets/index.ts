import type { Access, CollectionConfig, Where } from 'payload'

import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { escalateNewTicket } from './hooks/escalateNewTicket'

/**
 * Tickets — ONE primitive, several flavours.
 *
 * A warranty claim, a support request, a return and a product question are the
 * same shape: a requester, a subject, a description, attachments, a status
 * lifecycle, an assignee, internal notes versus customer-visible replies, and a
 * resolution. So `type` is a discriminator on one collection rather than three
 * near-identical collections to keep in sync — the same "one primitive, many
 * flavours" pattern the platform already uses for Tenant (Circle, Business,
 * Guardian Angel are all tenants).
 *
 * DELIBERATELY NOT BUILT, and please don't add them by drift: SLA timers,
 * business-hours calendars, escalation matrices, a queue/view builder, CSAT
 * surveys, automation-and-trigger builders, multi-brand form schemas. That is
 * the "infinity of options" this is explicitly not trying to be. The 20% that
 * does the work is type, status, priority, assignee, requester, attachments,
 * notes and a filterable list.
 *
 * CONVERSATION LIVES ELSEWHERE. Replies are not a field here — `channelRef`
 * points at a channel, so a ticket thread gets threading, attachments, presence
 * and a participating LEO from machinery that already exists and already works.
 * The row owns the LIFECYCLE; the channel owns the DISCUSSION.
 */

/** Admins see everything. A tenant member sees their tenant's tickets. Everyone
 *  else sees only the tickets they themselves raised. */
const ticketRead: Access = async ({ req }) => {
  const user = req.user
  if (!user?.id) return false
  if (checkRole(ADMIN_ROLES, user)) return true

  const memberships = await req.payload.find({
    collection: 'tenant-memberships',
    where: { and: [{ user: { equals: user.id } }, { status: { equals: 'active' } }] },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const tenantIds = (memberships.docs || [])
    .map((m) => {
      const t = (m as { tenant?: unknown }).tenant
      return typeof t === 'object' && t !== null ? (t as { id?: number | string }).id : t
    })
    .filter((v): v is number | string => v != null)

  // A customer raising a warranty claim is NOT a member of the seller's tenant,
  // so ownership has to be an OR — otherwise they can't see their own claim.
  if (!tenantIds.length) return { requester: { equals: user.id } } as Where
  return {
    or: [{ tenant: { in: tenantIds } }, { requester: { equals: user.id } }],
  } as Where
}

/** Staff move tickets along. A requester can raise one but not reclassify it. */
const ticketWrite: Access = async ({ req }) => {
  const user = req.user
  if (!user?.id) return false
  if (checkRole(ADMIN_ROLES, user)) return true

  const memberships = await req.payload.find({
    collection: 'tenant-memberships',
    where: { and: [{ user: { equals: user.id } }, { status: { equals: 'active' } }] },
    limit: 500,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const tenantIds = (memberships.docs || [])
    .map((m) => {
      const t = (m as { tenant?: unknown }).tenant
      return typeof t === 'object' && t !== null ? (t as { id?: number | string }).id : t
    })
    .filter((v): v is number | string => v != null)

  if (!tenantIds.length) return false
  return { tenant: { in: tenantIds } } as Where
}

export const Tickets: CollectionConfig = {
  slug: 'tickets',
  admin: {
    group: 'Commerce',
    useAsTitle: 'subject',
    defaultColumns: ['subject', 'type', 'status', 'priority', 'requester', 'createdAt'],
    description: 'Warranty claims, support requests and returns — one queue.',
    listSearchableFields: ['subject', 'orderNumber'],
  },
  access: {
    // Signed in. Anonymous claims would let anyone file against any order
    // number, and the review step would carry all that weight.
    create: ({ req: { user } }) => Boolean(user),
    read: ticketRead,
    update: ticketWrite,
    delete: ({ req: { user } }) => Boolean(user && checkRole(ADMIN_ROLES, user)),
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'support',
      options: [
        { label: 'Warranty claim', value: 'warranty' },
        { label: 'Support request', value: 'support' },
        { label: 'Return', value: 'return' },
        { label: 'Question', value: 'question' },
      ],
      admin: { description: 'Adding a new kind of request is an option here, not a new collection.' },
    },
    { name: 'subject', type: 'text', required: true },
    {
      name: 'description',
      type: 'textarea',
      required: true,
      admin: { description: 'What happened, in the requester\'s own words.' },
    },
    {
      // Photos and video of the fault. For a warranty claim this is most of the
      // evidence — a claims queue without images is a queue of phone calls.
      name: 'attachments',
      type: 'array',
      admin: { description: 'Images or video showing the issue.' },
      fields: [{ name: 'file', type: 'upload', relationTo: 'media', required: true }],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'submitted',
      options: [
        { label: 'Submitted', value: 'submitted' },
        { label: 'Reviewing', value: 'reviewing' },
        { label: 'Approved', value: 'approved' },
        { label: 'Denied', value: 'denied' },
        { label: 'Resolved', value: 'resolved' },
      ],
    },
    {
      name: 'priority',
      type: 'select',
      defaultValue: 'normal',
      index: true,
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Normal', value: 'normal' },
        { label: 'High', value: 'high' },
        { label: 'Urgent', value: 'urgent' },
      ],
    },
    {
      name: 'requester',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: { description: 'Who raised it. Set from the session, never from the form body.' },
    },
    {
      name: 'assignee',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: { description: 'Who owns it now. Empty means unclaimed.' },
    },

    // ─── Warranty-specific ─────────────────────────────────────────────────
    // Grouped and conditional: a support request shouldn't be asked for an
    // order number, and a warranty claim is useless without one.
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      index: true,
      admin: {
        condition: (data) => data?.type === 'warranty' || data?.type === 'return',
        description:
          'Which product. A relationship, not a static list — it fills itself from the catalog.',
      },
    },
    {
      name: 'purchaseDate',
      type: 'date',
      admin: { condition: (data) => data?.type === 'warranty' || data?.type === 'return' },
    },
    {
      name: 'orderNumber',
      type: 'text',
      index: true,
      admin: { condition: (data) => data?.type === 'warranty' || data?.type === 'return' },
    },
    {
      name: 'sellerName',
      type: 'text',
      admin: {
        condition: (data) => data?.type === 'warranty' || data?.type === 'return',
        description: 'Where they bought it, if not direct (Amazon, a clinic, a distributor).',
      },
    },

    // ─── Resolution ────────────────────────────────────────────────────────
    {
      name: 'resolution',
      type: 'textarea',
      admin: { description: 'What was done. Visible to the requester.' },
    },
    {
      name: 'internalNotes',
      type: 'textarea',
      access: {
        // Staff-only: the whole point of an internal note is that the requester
        // cannot read it. Field access, not admin.hidden — hiding is cosmetic.
        read: ({ req: { user } }) => Boolean(user && checkRole(ADMIN_ROLES, user)),
      },
      admin: { description: 'Never shown to the requester.' },
    },
    {
      name: 'channelRef',
      type: 'text',
      index: true,
      admin: {
        readOnly: true,
        description:
          'The channel carrying this ticket\'s conversation. Replies live there, not here.',
      },
    },
  ],
  hooks: {
    afterChange: [escalateNewTicket],
  },
  timestamps: true,
}
