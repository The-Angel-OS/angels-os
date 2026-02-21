import type { CollectionConfig } from 'payload'

/**
 * ProcessedStripeEvents — Webhook idempotency persistence
 *
 * Stores Stripe event IDs that have been successfully handled.
 * Replaces the in-memory Set that resets on every deploy.
 * Hidden system collection — super_admin delete only.
 */
export const ProcessedStripeEvents: CollectionConfig = {
  slug: 'processed-stripe-events',
  admin: {
    group: 'System',
    hidden: true,
  },
  access: {
    create: () => false, // System only (overrideAccess)
    read: () => false,
    update: () => false,
    delete: ({ req }) => {
      const user = req.user as Record<string, unknown> | null
      const roles = Array.isArray(user?.roles) ? user.roles : []
      return roles.includes('super_admin')
    },
  },
  fields: [
    {
      name: 'eventId',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Stripe event ID (evt_...)',
      },
    },
    {
      name: 'eventType',
      type: 'text',
      required: true,
      admin: {
        description: 'Stripe event type (e.g., payment_intent.succeeded)',
      },
    },
    {
      name: 'processedAt',
      type: 'date',
      required: true,
      admin: {
        description: 'When the event was processed',
      },
    },
  ],
  timestamps: false,
}
