import type { CollectionConfig } from 'payload'

/**
 * HolonCapabilities — Constitutional manufacturing network node registration.
 *
 * Each tenant can register as a production node with specific capabilities.
 * Inspired by Daniel Suarez's Freedom™ Holons — self-governing nodes within
 * a 100-mile economic radius, coordinated by AI, governed by constitution.
 *
 * Node types: assembly, print, service, product, digital, fulfillment.
 *
 * @see docs/planning/PHASE_4_PLAN.md — Holon architecture details
 */
export const HolonCapabilities: CollectionConfig = {
  slug: 'holon-capabilities',
  admin: {
    group: 'Angel OS',
    useAsTitle: 'nodeType',
    defaultColumns: ['tenant', 'nodeType', 'serviceRadius', 'constitutionalCompliance'],
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    // Note: 'tenant' field is auto-added by the multi-tenant plugin.
    // Do not define it here to avoid duplicate field errors.
    {
      name: 'nodeType',
      type: 'select',
      required: true,
      options: [
        { label: 'Assembly Node', value: 'assembly' },
        { label: 'Print Node', value: 'print' },
        { label: 'Service Node', value: 'service' },
        { label: 'Product Node', value: 'product' },
        { label: 'Digital Node', value: 'digital' },
        { label: 'Fulfillment Node', value: 'fulfillment' },
      ],
    },
    {
      name: 'capabilities',
      type: 'array',
      required: true,
      minRows: 1,
      fields: [
        {
          name: 'skill',
          type: 'text',
          required: true,
          admin: { description: 'e.g. "3d-printing", "screen-printing", "web-development"' },
        },
        {
          name: 'equipment',
          type: 'text',
          admin: { description: 'e.g. "Bambu Lab X1C", "Heat Press"' },
        },
        {
          name: 'materials',
          type: 'json',
          admin: { description: 'Array of materials, e.g. ["PLA", "PETG", "TPU"]' },
        },
        {
          name: 'maxVolume',
          type: 'text',
          admin: { description: 'e.g. "250x250x250mm"' },
        },
        {
          name: 'turnaroundHours',
          type: 'number',
          admin: { description: 'Typical production time in hours' },
        },
      ],
    },
    {
      name: 'serviceRadius',
      type: 'number',
      admin: {
        description: 'Service/delivery radius in miles. 0 for digital (no limit).',
      },
    },
    {
      name: 'location',
      type: 'group',
      fields: [
        { name: 'lat', type: 'number' },
        { name: 'lng', type: 'number' },
        { name: 'city', type: 'text' },
        { name: 'region', type: 'text' },
      ],
    },
    {
      name: 'businessName',
      type: 'text',
      admin: { description: 'Business name (e.g., "HIT Promotional Products")' },
    },
    {
      name: 'contactName',
      type: 'text',
      admin: { description: 'Primary business contact name' },
    },
    {
      name: 'rating',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Community trust score (0-5)' },
    },
    {
      name: 'activeOrderCount',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Current active orders (used for Answer 53 fairness scoring)' },
    },
    {
      name: 'acceptingOrders',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Currently accepting new orders from the network' },
    },
    {
      name: 'constitutionalCompliance',
      type: 'checkbox',
      defaultValue: true,
      required: true,
      admin: {
        description:
          'I agree to operate under the Angel OS constitution: 60/20/15/5 Ultimate Fair Split, Answer 53 principles, and network governance.',
      },
    },
  ],
}
