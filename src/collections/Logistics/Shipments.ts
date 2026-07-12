import type { CollectionConfig } from 'payload'

/**
 * Shipments — The Bread-Breaker Manifests.
 *
 * Each shipment represents a movement of goods from an origin node to a
 * destination node, with a manifest of items, priority level, and state
 * machine tracking from creation through delivery.
 *
 * Shipments can be:
 *   - **Manual**: Created by a user dispatching resources.
 *   - **Auto-matched**: Created by the Bread-Breaker algorithm when
 *     a supply node's inventory matches a demand node's needs.
 *   - **SOS**: Emergency priority — triggers immediate dispatch and
 *     bypasses normal queue ordering.
 *
 * State machine: pending → matched → dispatched → in_transit → delivered
 *                  ↘ cancelled  ↗ failed (with reason)
 *
 * @see src/utilities/logistics-engine.ts — matchSupplyToDemand()
 * @see src/collections/Logistics/LogisticsNodes.ts — Origin/destination
 * @see src/collections/Logistics/Transports.ts — Assigned transport
 */
export const Shipments: CollectionConfig = {
  slug: 'shipments',
  admin: {
    group: 'Logistics',
    useAsTitle: 'shipmentId',
    defaultColumns: ['shipmentId', 'origin', 'destination', 'priority', 'status', 'createdAt'],
    listSearchableFields: ['shipmentId', 'failureReason'],
    description: 'Resource shipments moving between logistics nodes.',
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    // Note: 'tenant' field is auto-added by the multi-tenant plugin.
    {
      name: 'shipmentId',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'Auto-generated shipment identifier (e.g., SHP-20260228-001). Leave blank to auto-generate.',
        readOnly: true,
      },
      hooks: {
        beforeValidate: [
          ({ value }) => {
            if (!value) {
              const ts = new Date().toISOString().slice(0, 10).replace(/-/g, '')
              const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
              return `SHP-${ts}-${rand}`
            }
            return value
          },
        ],
      },
    },
    // ─── Route ──────────────────────────────────────────────────────────────
    {
      name: 'origin',
      type: 'relationship',
      relationTo: 'logistics-nodes',
      required: true,
      index: true,
      admin: { description: 'Pickup location (supply node).' },
    },
    {
      name: 'destination',
      type: 'relationship',
      relationTo: 'logistics-nodes',
      required: true,
      index: true,
      admin: { description: 'Delivery location (demand node).' },
    },
    {
      name: 'distanceMiles',
      type: 'number',
      admin: { description: 'Calculated distance between origin and destination in miles.' },
    },
    // ─── Manifest ───────────────────────────────────────────────────────────
    {
      name: 'manifest',
      type: 'array',
      required: true,
      minRows: 1,
      admin: { description: 'Items being shipped.' },
      fields: [
        { name: 'item', type: 'text', required: true },
        { name: 'category', type: 'select', options: [
          { label: 'Food', value: 'food' },
          { label: 'Medicine', value: 'medicine' },
          { label: 'Clothing', value: 'clothing' },
          { label: 'Hygiene', value: 'hygiene' },
          { label: 'Shelter Supplies', value: 'shelter' },
          { label: 'Baby/Child', value: 'baby' },
          { label: 'Pet Supplies', value: 'pet' },
          { label: 'Other', value: 'other' },
        ]},
        { name: 'quantity', type: 'number', required: true, min: 1 },
        { name: 'unit', type: 'text', defaultValue: 'units' },
        { name: 'weight', type: 'number', admin: { description: 'Weight in lbs (optional)' } },
        { name: 'perishable', type: 'checkbox', defaultValue: false },
        { name: 'requiresRefrigeration', type: 'checkbox', defaultValue: false },
      ],
    },
    // ─── Priority & Status ──────────────────────────────────────────────────
    {
      name: 'priority',
      type: 'select',
      required: true,
      defaultValue: 'standard',
      index: true,
      options: [
        { label: 'Standard', value: 'standard' },
        { label: 'Urgent', value: 'urgent' },
        { label: 'SOS / Emergency', value: 'sos' },
      ],
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending — Awaiting transport match', value: 'pending' },
        { label: 'Matched — Transport assigned', value: 'matched' },
        { label: 'Dispatched — Transport en route to pickup', value: 'dispatched' },
        { label: 'In Transit — Goods picked up, heading to destination', value: 'in_transit' },
        { label: 'Delivered — Mission complete', value: 'delivered' },
        { label: 'Cancelled', value: 'cancelled' },
        { label: 'Failed — Could not complete', value: 'failed' },
      ],
    },
    {
      name: 'failureReason',
      type: 'textarea',
      admin: {
        condition: (data) => data?.status === 'failed' || data?.status === 'cancelled',
        description: 'Why the shipment failed or was cancelled.',
      },
    },
    // ─── Transport Assignment ───────────────────────────────────────────────
    {
      name: 'assignedTransport',
      type: 'relationship',
      relationTo: 'transports',
      index: true,
      admin: { description: 'The Soul Fleet vehicle assigned to this shipment.' },
    },
    {
      name: 'driver',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'The person actually driving / carrying the goods.' },
      index: true,
    },
    // ─── Matching Metadata ──────────────────────────────────────────────────
    {
      name: 'matchType',
      type: 'select',
      defaultValue: 'manual',
      options: [
        { label: 'Manual — Created by a human', value: 'manual' },
        { label: 'Auto-matched — Bread-Breaker algorithm', value: 'auto' },
        { label: 'SOS Dispatch — Emergency auto-route', value: 'sos_dispatch' },
      ],
    },
    {
      name: 'matchScore',
      type: 'number',
      admin: { description: 'Algorithm confidence score (0-100) if auto-matched.' },
    },
    // ─── Timestamps ─────────────────────────────────────────────────────────
    {
      name: 'matchedAt',
      type: 'date',
    },
    {
      name: 'dispatchedAt',
      type: 'date',
    },
    {
      name: 'pickedUpAt',
      type: 'date',
    },
    {
      name: 'deliveredAt',
      type: 'date',
    },
    {
      name: 'estimatedArrival',
      type: 'date',
      admin: { description: 'ETA at destination.' },
    },
    // ─── Proof of Delivery ──────────────────────────────────────────────────
    {
      name: 'proofOfDelivery',
      type: 'group',
      admin: { description: 'Evidence that the shipment was received.' },
      fields: [
        { name: 'photo', type: 'upload', relationTo: 'media' },
        { name: 'recipientName', type: 'text' },
        { name: 'recipientSignature', type: 'checkbox', label: 'Recipient confirmed receipt' },
        { name: 'notes', type: 'textarea' },
      ],
    },
    // ─── Cargo Sizing ───────────────────────────────────────────────────────
    {
      name: 'totalSize',
      type: 'number',
      admin: { description: 'Total cargo size in standard units (used for transport capacity matching).' },
    },
    {
      name: 'totalWeight',
      type: 'number',
      admin: { description: 'Total weight in lbs.' },
    },
    // ─── Requester ──────────────────────────────────────────────────────────
    {
      name: 'requestedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'Who created or triggered this shipment.' },
    },
  ],
  timestamps: true,
}
