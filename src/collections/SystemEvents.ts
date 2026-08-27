import type { CollectionConfig } from 'payload'

/**
 * SystemEvents — the arrival ledger.
 *
 * Ken's 260827 ruling, after the Ebbelaar automation talk: persist the event
 * BEFORE you act on it. Ten webhook endpoints did their work inline and left no
 * trace — an inbound SMS or Telegram message that threw halfway simply never
 * happened, with no row saying it arrived, no error to read, and nothing to
 * retry from. Stripe alone kept a record (`processed-stripe-events`), and only
 * as an idempotency guard.
 *
 * This is the sensory record the error nervous system was always missing: the
 * stack cannot reflect on what it never wrote down.
 *
 * ponytail: a LEDGER, not a queue. Payload jobs already run work; this only
 * records that something arrived and how it went. `status` carries 'failed' so
 * a retry sweeper has something to select on the day one is wanted — none is
 * written yet, and none is needed to make the record useful.
 *
 * @see src/utilities/eventLedger.ts — withEventLedger(), the one writer
 */
export const SystemEvents: CollectionConfig = {
  slug: 'system-events',
  // `SystemEvent` — a distinct GraphQL type. @see graphqlTypeNameCollisions.test.ts
  graphQL: { singularName: 'SystemEvent', pluralName: 'SystemEvents' },
  admin: {
    group: 'System',
    useAsTitle: 'source',
    defaultColumns: ['source', 'eventType', 'status', 'durationMs', 'createdAt'],
    listSearchableFields: ['source', 'eventType', 'externalId', 'error'],
    description: 'Every inbound webhook and trigger, recorded on arrival.',
  },
  access: {
    // System-written only. Readable by operators so the ledger can be READ —
    // that is the entire point of keeping it.
    create: () => false,
    read: ({ req }) => {
      const roles = (req.user as { roles?: unknown } | null)?.roles
      return Array.isArray(roles) && roles.includes('super_admin')
    },
    update: () => false,
    delete: ({ req }) => {
      const roles = (req.user as { roles?: unknown } | null)?.roles
      return Array.isArray(roles) && roles.includes('super_admin')
    },
  },
  fields: [
    {
      name: 'source',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'Who sent it — stripe, twilio, telegram, slack, cron…' },
    },
    {
      name: 'eventType',
      type: 'text',
      admin: { description: "The sender's own event name, when it gives one." },
    },
    {
      name: 'externalId',
      type: 'text',
      index: true,
      admin: { description: "The sender's id for this event (evt_…, MessageSid…). Not unique: a redelivery is a SECOND arrival and deserves its own row." },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'received',
      index: true,
      options: [
        { label: 'Received', value: 'received' },
        { label: 'Done', value: 'done' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    {
      name: 'path',
      type: 'text',
      admin: { description: 'The endpoint it arrived on.' },
    },
    {
      name: 'durationMs',
      type: 'number',
      admin: { description: 'How long the handler took.' },
    },
    {
      name: 'statusCode',
      type: 'number',
      admin: { description: 'What we answered the sender with.' },
    },
    {
      name: 'error',
      type: 'textarea',
      admin: { description: 'Why it failed, when it did.' },
    },
    {
      name: 'body',
      type: 'textarea',
      admin: { description: 'The raw payload, truncated. Enough to see what arrived and to replay it by hand.' },
    },
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      index: true,
      admin: { description: 'Set when the handler resolved one. Many webhooks arrive before a tenant is known.' },
    },
  ],
}
