import { CollectionOverride } from '@payloadcms/plugin-ecommerce/types'

/**
 * Orders Collection Override — Sprint 4
 *
 * Extends the ecommerce plugin's Orders collection with fulfillment
 * routing fields for the Holon manufacturing network.
 *
 * Each order item can be independently routed to a different Holon node,
 * tracked through the fulfillment state machine, and include design assets
 * for print-on-demand workflows.
 */
export const OrdersCollection: CollectionOverride = ({ defaultCollection }) => ({
  ...defaultCollection,
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
          relationTo: 'holon-capabilities' as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- slug not in generated types yet
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
          ],
        },
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
  ],
})
