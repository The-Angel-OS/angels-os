/**
 * Agent Transactions Collection
 *
 * Tracks every spend/earn by LEO's agent wallet across the federation.
 * This is the economic ledger for agent-to-agent commerce.
 *
 * Every transaction records:
 *   - What was purchased/sold
 *   - Which Enterprise was on the other side
 *   - Which skill triggered it
 *   - The amount and status
 *
 * Constitutional Reference:
 *   Article V (Toward-53) — transparent economic model
 *   Article II (Anti-Demonic) — no hidden fees, observable actions
 */

import type { CollectionConfig } from 'payload'

export const AgentTransactions: CollectionConfig = {
  slug: 'agent-transactions',
  admin: {
    group: 'Angel OS',
    useAsTitle: 'description',
    defaultColumns: ['type', 'amountCents', 'description', 'status', 'createdAt'],
    description: 'LEO agent wallet transaction ledger — every spend and earn across the federation',
  },
  access: {
    // Only admins can view transactions
    read: ({ req: { user } }) => {
      if (!user) return false
      const roles = (user as { roles?: string[] }).roles ?? []
      return roles.includes('super_admin') || roles.includes('admin')
    },
    // Programmatic only
    create: () => false,
    update: () => false,
    delete: () => false,
  },

  fields: [
    // ── Tenant Scope ────────────────────────────────────────────────
    {
      name: 'tenant',
      type: 'relationship',
      relationTo: 'tenants',
      required: true,
      admin: {
        description: 'The Enterprise this transaction belongs to',
      },
    },

    // ── Transaction Type ────────────────────────────────────────────
    {
      name: 'type',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Spend', value: 'spend' },
        { label: 'Earn', value: 'earn' },
        { label: 'Refund', value: 'refund' },
      ],
      admin: {
        description: 'Whether we spent, earned, or received a refund',
      },
    },

    // ── Amount ──────────────────────────────────────────────────────
    {
      name: 'amountCents',
      type: 'number',
      required: true,
      admin: {
        description: 'Amount in cents (e.g., 500 = $5.00)',
      },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'usd',
      admin: {
        description: 'Currency code',
      },
    },

    // ── Description ─────────────────────────────────────────────────
    {
      name: 'description',
      type: 'text',
      required: true,
      admin: {
        description: 'What was purchased, sold, or refunded',
      },
    },

    // ── Counterparty ────────────────────────────────────────────────
    {
      name: 'counterpartyFederationId',
      type: 'text',
      admin: {
        description: 'Federation UUID of the other Enterprise in this transaction',
      },
    },
    {
      name: 'counterpartyDomain',
      type: 'text',
      admin: {
        description: 'Domain of the other Enterprise',
      },
    },
    {
      name: 'counterpartyName',
      type: 'text',
      admin: {
        description: 'Name of the other Enterprise',
      },
    },

    // ── Skill Context ───────────────────────────────────────────────
    {
      name: 'skillInvoked',
      type: 'text',
      admin: {
        description: 'Which federation skill triggered this transaction',
      },
    },
    {
      name: 'skillCategory',
      type: 'select',
      options: [
        { label: 'Catalog', value: 'catalog' },
        { label: 'Booking', value: 'booking' },
        { label: 'Content', value: 'content' },
        { label: 'Communication', value: 'communication' },
        { label: 'Analytics', value: 'analytics' },
        { label: 'Payment', value: 'payment' },
        { label: 'Moderation', value: 'moderation' },
        { label: 'Infrastructure', value: 'infrastructure' },
      ],
      admin: {
        description: 'Category of the skill (for spending rules)',
      },
    },

    // ── Payment ─────────────────────────────────────────────────────
    {
      name: 'stripePaymentIntentId',
      type: 'text',
      admin: {
        description: 'Stripe PaymentIntent ID if backed by a real payment',
      },
    },

    // ── Status ──────────────────────────────────────────────────────
    {
      name: 'status',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Completed', value: 'completed' },
        { label: 'Failed', value: 'failed' },
        { label: 'Refunded', value: 'refunded' },
      ],
      admin: {
        description: 'Transaction status',
      },
    },

    // ── Metadata ────────────────────────────────────────────────────
    {
      name: 'metadata',
      type: 'json',
      admin: {
        description: 'Additional context (skill params, response data, etc.)',
      },
    },
  ],

  timestamps: true,
}
