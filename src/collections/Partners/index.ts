import type { CollectionConfig } from 'payload'
import { adminOnly } from '@/access/adminOnly'

/**
 * Partners — an affiliate who sends traffic, and the rate they earn on it.
 *
 * Deliberately NOT a payout system. Attribution is the part that's expensive to
 * retrofit (an order that shipped without a referral code on it can never be
 * attributed afterwards), so that lands now; commission accrual, wallets and
 * transfers land when a partner has actually earned something. Everything here
 * is designed so that later work is additive: a `partner` relationship and a
 * `commission` number on Orders, and a ledger entry keyed off the same code.
 *
 * Tenant-scoped by the multi-tenant plugin. Payout details are on the doc, so
 * access is admin-only rather than any-signed-in-user — an affiliate program's
 * partner list IS a competitor's prospect list, and the payout fields are worse.
 *
 * @see src/collections/Orders/index.ts — the `referral` group this pairs with
 */
export const Partners: CollectionConfig = {
  slug: 'partners',
  admin: {
    group: 'Configuration',
    useAsTitle: 'name',
    defaultColumns: ['name', 'code', 'rate', 'partnerStatus', 'createdAt'],
    listSearchableFields: ['name', 'code', 'email', 'notes'],
    description: 'Affiliate partners and the commission rate they earn.',
  },
  access: {
    create: adminOnly,
    read: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  fields: [
    { name: 'name', type: 'text', required: true, admin: { description: 'Who this is — person or company.' } },
    {
      name: 'code',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description:
          'The value in ?ref=… . Short, lowercase, no spaces. Changing it orphans every link already in the wild, so treat it as permanent.',
      },
      hooks: {
        // A code that differs from its link by a capital letter is a support
        // ticket that ends in "we can't attribute that order".
        beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value)],
      },
    },
    { name: 'email', type: 'email', index: true, admin: { description: 'Where statements go.' } },
    {
      name: 'rate',
      type: 'number',
      required: true,
      defaultValue: 10,
      min: 0,
      max: 100,
      admin: {
        description:
          'Commission percent of order subtotal. Copied onto the order at capture time, so changing it never rewrites what a partner already earned.',
      },
    },
    {
      name: 'partnerStatus',
      type: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Paused — links still resolve, no new commission', value: 'paused' },
        { label: 'Ended', value: 'ended' },
      ],
      index: true,
    },
    {
      name: 'landingPage',
      type: 'relationship',
      relationTo: 'pages',
      admin: {
        description:
          'Optional page this partner sends traffic to. A bare ?ref= on any page still attributes; this is for "here is YOUR page".',
      },
    },
    {
      name: 'payout',
      type: 'group',
      admin: { description: 'How this partner gets paid. Manual today — no transfer is ever initiated from here.' },
      fields: [
        {
          name: 'method',
          type: 'select',
          defaultValue: 'manual',
          options: [
            { label: 'Manual (cheque, transfer, however you settle up)', value: 'manual' },
            { label: 'Stripe Connect account', value: 'stripe' },
            { label: 'Store credit', value: 'credit' },
          ],
        },
        {
          name: 'stripeAccountId',
          type: 'text',
          admin: {
            description: 'acct_… — recorded only. Nothing in this codebase moves money on it.',
            condition: (_d, sibling) => sibling?.method === 'stripe',
          },
        },
        { name: 'notes', type: 'textarea', admin: { description: 'Terms, agreed rate changes, anything you’ll want in six months.' } },
      ],
    },
    { name: 'notes', type: 'textarea' },
  ],
}
