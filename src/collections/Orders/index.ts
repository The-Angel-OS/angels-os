import { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'

/**
 * Orders Collection Override — Sprint 4 + Angel Tokens
 *
 * Extends the ecommerce plugin's Orders collection with fulfillment
 * routing fields for the Holon manufacturing network and Angel Token
 * queue system for zero-manufacturer launch.
 *
 * Angel Token lifecycle:
 * - Created: Payment succeeds, no Holon available → tokenStatus: 'active'
 * - Redeemed: Maker matches + accepts + delivers → tokenStatus: 'redeemed'
 * - Refunded: Customer cancels while queued → tokenStatus: 'refunded'
 *
 * Each order item can be independently routed to a different Holon node,
 * tracked through the fulfillment state machine, and include design assets
 * for print-on-demand workflows.
 *
 * @see docs/ANGEL_TOKENS_BLOCKCHAIN_ECONOMY.md — full token economy vision
 */
export const OrdersCollection: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
  admin: {
    ...defaultCollection?.admin,
    defaultColumns: ['id', 'customer', 'total', 'currency', 'status', 'createdAt'],
    listSearchableFields: ['id', 'currency'],
  },
  fields: [
    ...defaultCollection.fields,
    // ─── Fulfillment Routing ────────────────────────────────
    {
      name: 'fulfillment',
      type: 'array',
      admin: {
        description: 'Per-item fulfillment routing to Holon production nodes',
      },
      fields: [
        {
          name: 'orderItemIndex',
          type: 'number',
          required: true,
          admin: { description: 'Index into the order items array' },
        },
        {
          name: 'assignedHolon',
          type: 'relationship',
          relationTo: 'holon-capabilities',
          admin: { description: 'The Holon node assigned to fulfill this item' },
        },
        {
          name: 'sourceTenant',
          type: 'relationship',
          relationTo: 'tenants',
          admin: { description: 'The vendor tenant that owns the assigned Holon' },
        },
        {
          name: 'fulfillmentStatus',
          type: 'select',
          required: true,
          defaultValue: 'pending_match',
          options: [
            { label: 'Pending Match', value: 'pending_match' },
            { label: 'Matched', value: 'matched' },
            { label: 'Accepted', value: 'accepted' },
            { label: 'In Production', value: 'in_production' },
            { label: 'Shipped', value: 'shipped' },
            { label: 'Delivered', value: 'delivered' },
            { label: 'Rejected', value: 'rejected' },
            { label: 'Cancelled', value: 'cancelled' },
          ],
        },
        // ─── Angel Token Fields ─────────────────────────────
        {
          name: 'angelTokenId',
          type: 'text',
          unique: true,
          admin: {
            description: 'Angel Token identifier (e.g. AT-2026-00042). Issued when order queues with no available maker.',
            readOnly: true,
          },
        },
        {
          name: 'tokenStatus',
          type: 'select',
          admin: {
            description: 'Angel Token lifecycle status — active tokens represent paid claims on future production.',
            readOnly: true,
          },
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Redeemed', value: 'redeemed' },
            { label: 'Refunded', value: 'refunded' },
          ],
        },
        {
          name: 'queuedAt',
          type: 'date',
          admin: {
            description: 'When the Angel Token was issued (no Holon available at payment time)',
            readOnly: true,
          },
        },
        {
          name: 'queueReason',
          type: 'text',
          admin: {
            description: 'Human-readable reason: "Waiting for a maker with: CNC-milling, plywood"',
            readOnly: true,
          },
        },
        {
          name: 'customerNotifiedAt',
          type: 'date',
          admin: {
            description: 'Last time customer was notified of queue status change',
            readOnly: true,
          },
        },
        {
          name: 'selectedConfiguration',
          type: 'json',
          admin: {
            description: 'Customer selections from ProductConfigurator (colors, sizes, custom text, materials). This becomes the work order for the maker.',
          },
        },
        // ─── Matching & Timing ──────────────────────────────
        {
          name: 'matchScore',
          type: 'number',
          admin: { description: 'Routing engine match score (0-100)' },
        },
        {
          name: 'matchedAt',
          type: 'date',
        },
        {
          name: 'acceptedAt',
          type: 'date',
        },
        {
          name: 'shippedAt',
          type: 'date',
        },
        {
          name: 'trackingNumber',
          type: 'text',
          admin: {
            condition: (_, siblingData) =>
              siblingData?.fulfillmentStatus === 'shipped' ||
              siblingData?.fulfillmentStatus === 'delivered',
          },
        },
        {
          name: 'trackingUrl',
          type: 'text',
          admin: {
            condition: (_, siblingData) =>
              siblingData?.fulfillmentStatus === 'shipped' ||
              siblingData?.fulfillmentStatus === 'delivered',
          },
        },
        {
          name: 'estimatedCompletion',
          type: 'date',
        },
        {
          name: 'rejectionReason',
          type: 'textarea',
          admin: {
            condition: (_, siblingData) => siblingData?.fulfillmentStatus === 'rejected',
          },
        },
        {
          name: 'vendorShare',
          type: 'number',
          admin: { description: 'Vendor share amount (60% of item price by default)' },
        },
        // ─── Design Assets (Print-on-Demand) ────────────────
        {
          name: 'designAssets',
          type: 'array',
          admin: { description: 'Design files for print-on-demand fulfillment' },
          fields: [
            {
              name: 'media',
              type: 'upload',
              relationTo: 'media',
              required: true,
            },
            {
              name: 'instructions',
              type: 'textarea',
              admin: { description: 'Placement, sizing, color notes for the printer' },
            },
          ],
        },
      ],
    },
    // ─── Affiliate attribution ──────────────────────────────
    /**
     * Who sent this customer, captured at checkout from the `ref` cookie.
     *
     * Snapshot, not a join: `code` and `rate` are copied here rather than read
     * through the relationship, so renaming a partner's code or renegotiating
     * their rate can never rewrite what they already earned. The relationship is
     * for reporting; these two columns are the record.
     *
     * An order that shipped without this on it can never be attributed
     * afterwards, which is the whole reason it lands before any payout machinery.
     */
    {
      name: 'referral',
      type: 'group',
      admin: {
        description: 'Affiliate attribution. Written once at checkout; do not edit to change a payout.',
      },
      fields: [
        {
          name: 'partner',
          type: 'relationship',
          relationTo: 'partners',
          index: true,
          admin: { description: 'Resolved from the code at capture time. Null when the code matched nothing.' },
        },
        {
          name: 'code',
          type: 'text',
          index: true,
          admin: {
            description:
              'The raw ?ref= value, kept even when it matches no partner — an unmatched code is a typo in someone’s link, and you only find those by looking.',
          },
        },
        {
          name: 'rate',
          type: 'number',
          admin: { description: 'Commission percent AS AGREED WHEN THE ORDER WAS PLACED. Snapshot.' },
        },
        {
          name: 'commission',
          type: 'number',
          admin: { description: 'Computed at capture: subtotal × rate. Stored so a report never re-derives money.' },
        },
        {
          name: 'landedAt',
          type: 'date',
          admin: { description: 'When the referral cookie was set — the click, not the purchase.' },
        },
        {
          name: 'landingPath',
          type: 'text',
          admin: { description: 'The path they landed on, e.g. /pelvic-floor. This is what tells you which page sells.' },
        },
        {
          name: 'payoutStatus',
          type: 'select',
          defaultValue: 'pending',
          options: [
            { label: 'Pending', value: 'pending' },
            { label: 'Approved — past the refund window', value: 'approved' },
            { label: 'Paid', value: 'paid' },
            { label: 'Void — refunded or cancelled', value: 'void' },
          ],
          index: true,
          admin: { description: 'Settled by hand today. The column exists so automating it later is not a migration.' },
        },
      ],
    },
  ],
})
