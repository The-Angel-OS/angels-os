/**
 * Justice Fund Transactions Collection — Sprint 6
 *
 * Records all 5% allocations from the Ultimate Fair split.
 * Each successful payment creates an allocation record here.
 *
 * @see src/lib/ultimate-fair-split.ts — split constants
 * @see src/endpoints/stripe-webhooks.ts — creates records on payment success
 */
import type { CollectionConfig } from 'payload'
import { checkRole } from '@/access/utilities'

export const JusticeFundTransactions: CollectionConfig = {
  slug: 'justice-fund-transactions',
  admin: {
    group: 'Angel OS',
    useAsTitle: 'description',
    defaultColumns: ['type', 'amountCents', 'status', 'processedAt'],
  },
  access: {
    read: ({ req: { user } }) => Boolean(checkRole(['super_admin'], user)),
    create: () => false, // Only created by webhooks/system
    update: ({ req: { user } }) => Boolean(checkRole(['super_admin'], user)),
    delete: ({ req: { user } }) => Boolean(checkRole(['super_admin'], user)),
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      index: true,
      required: true,
      options: [
        { label: 'Allocation (from sale)', value: 'allocation' },
        { label: 'Disbursement (to recipient)', value: 'disbursement' },
        { label: 'Adjustment', value: 'adjustment' },
      ],
    },
    {
      name: 'amountCents',
      type: 'number',
      required: true,
      admin: { description: 'Amount in cents' },
    },
    {
      name: 'sourcePaymentIntentId',
      type: 'text',
      admin: { description: 'Stripe PaymentIntent ID that generated this allocation' },
    },
    {
      name: 'sourceTotalCents',
      type: 'number',
      admin: { description: 'Total transaction amount before split (cents)' },
    },
    {
      name: 'percentage',
      type: 'number',
      admin: { description: 'Percentage applied (e.g. 5 for 5%)' },
    },
    {
      name: 'description',
      type: 'text',
    },
    {
      name: 'status',
      type: 'select',
      index: true,
      required: true,
      defaultValue: 'completed',
      options: [
        { label: 'Completed', value: 'completed' },
        { label: 'Pending', value: 'pending' },
        { label: 'Failed', value: 'failed' },
      ],
    },
    {
      name: 'processedAt',
      type: 'date',
    },
  ],
}
