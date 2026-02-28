import type { CollectionConfig, CollectionBeforeChangeHook } from 'payload'

/**
 * LogisticsNodes — Physical locations in the Universal Logistics Network (ULN).
 *
 * Represents pantries, shelters, drop zones, warehouses, and any physical
 * location that can originate or receive shipments. Each node operates
 * under one of two governance modes:
 *
 *   - **Regulated** (Institutional): Requires insurance/compliance docs.
 *     Think Red Cross, Feeding America, hospital supply chains.
 *
 *   - **Autonomous** (Soul Fleet): Good Samaritan protocol.
 *     Think mutual aid, church pantries, community fridges.
 *
 * Both can coexist on the same map without breaking each other's rules.
 *
 * The `@handle` is auto-generated from name + geohash prefix, providing
 * a human-readable address for the node (e.g. @clearwater-pantry-djk3x).
 *
 * @see src/utilities/logistics-engine.ts — Matching & routing functions
 * @see src/collections/Logistics/Transports.ts — Soul Fleet vehicles
 * @see src/collections/Logistics/Shipments.ts — Manifests & delivery tracking
 */

// ---------------------------------------------------------------------------
// Geohash utility (base32 encoding of lat/lng for spatial indexing)
// ---------------------------------------------------------------------------

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz'

function encodeGeohash(lat: number, lng: number, precision = 7): string {
  let minLat = -90, maxLat = 90
  let minLng = -180, maxLng = 180
  let bit = 0, ch = 0, hash = ''
  let isLng = true

  while (hash.length < precision) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2
      if (lng >= mid) { ch |= 1 << (4 - bit); minLng = mid } else { maxLng = mid }
    } else {
      const mid = (minLat + maxLat) / 2
      if (lat >= mid) { ch |= 1 << (4 - bit); minLat = mid } else { maxLat = mid }
    }
    isLng = !isLng
    if (bit < 4) { bit++ } else { hash += BASE32[ch]; bit = 0; ch = 0 }
  }
  return hash
}

// ---------------------------------------------------------------------------
// beforeChange hook: auto-generate @handle and geohash
// ---------------------------------------------------------------------------

const autoGenerateHandle: CollectionBeforeChangeHook = ({ data }) => {
  // Auto-compute geohash from lat/lng if provided
  if (data?.location?.lat != null && data?.location?.lng != null && !data.geohash) {
    data.geohash = encodeGeohash(data.location.lat, data.location.lng)
  }

  // Auto-generate @handle if not manually set
  if (!data?.handle && data?.name) {
    const slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const geoSuffix = data.geohash ? `-${data.geohash.slice(0, 5)}` : ''
    data.handle = `@${slug}${geoSuffix}`
  }

  return data
}

// ---------------------------------------------------------------------------
// Collection
// ---------------------------------------------------------------------------

export const LogisticsNodes: CollectionConfig = {
  slug: 'logistics-nodes',
  hooks: {
    beforeChange: [autoGenerateHandle],
  },
  admin: {
    group: 'Logistics',
    useAsTitle: 'name',
    defaultColumns: ['name', 'handle', 'type', 'governanceMode', 'trustScore'],
    description: 'Physical nodes in the Universal Logistics Network — pantries, shelters, drop zones.',
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
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'Human-readable node name (e.g., "Clearwater Community Pantry")' },
    },
    {
      name: 'handle',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        description: 'Auto-generated @handle (e.g., @clearwater-pantry-djk3x). Leave blank to auto-generate.',
        readOnly: true,
      },
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      index: true,
      options: [
        { label: 'Food Pantry', value: 'pantry' },
        { label: 'Shelter', value: 'shelter' },
        { label: 'Drop Zone', value: 'dropzone' },
        { label: 'Warehouse', value: 'warehouse' },
        { label: 'Medical Facility', value: 'medical' },
        { label: 'Distribution Center', value: 'distribution' },
        { label: 'Community Fridge', value: 'community_fridge' },
      ],
    },
    // ─── Governance: The Hybrid Federation Model ────────────────────────────
    {
      name: 'governanceMode',
      type: 'select',
      required: true,
      defaultValue: 'autonomous',
      options: [
        { label: 'Institutional (Requires Insurance/Compliance)', value: 'regulated' },
        { label: 'Soul Fleet (Good Samaritan / At Own Risk)', value: 'autonomous' },
      ],
      admin: {
        description: 'Regulated = institutional (Red Cross, hospitals). Autonomous = grassroots mutual aid.',
      },
    },
    {
      name: 'insurancePolicy',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Upload insurance certificate (PDF/image)',
        condition: (data) => data?.governanceMode === 'regulated',
      },
    },
    {
      name: 'complianceCerts',
      type: 'array',
      admin: {
        description: 'HIPAA, food safety, or other compliance certifications',
        condition: (data) => data?.governanceMode === 'regulated',
      },
      fields: [
        { name: 'certType', type: 'text', required: true, admin: { description: 'e.g., "HIPAA", "ServSafe", "FDA"' } },
        { name: 'certDoc', type: 'upload', relationTo: 'media' },
        { name: 'expiresAt', type: 'date' },
      ],
    },
    {
      name: 'liabilityWaiverSigned',
      type: 'checkbox',
      label: 'Agrees to Good Samaritan / At Own Risk Protocol',
      defaultValue: false,
      admin: {
        condition: (data) => data?.governanceMode === 'autonomous',
        description: 'Soul Fleet operators accept responsibility under Good Samaritan laws.',
      },
    },
    // ─── Trust & Reputation ─────────────────────────────────────────────────
    {
      name: 'trustScore',
      type: 'number',
      defaultValue: 1,
      min: 0,
      max: 100,
      admin: { description: 'Reputation score. Starts at 1, grows with successful deliveries. Max 100.' },
    },
    {
      name: 'completedShipments',
      type: 'number',
      defaultValue: 0,
      admin: { description: 'Total shipments successfully completed through this node.' },
    },
    // ─── Location ───────────────────────────────────────────────────────────
    {
      name: 'location',
      type: 'group',
      fields: [
        { name: 'lat', type: 'number', required: true },
        { name: 'lng', type: 'number', required: true },
        { name: 'address', type: 'text', admin: { description: 'Street address' } },
        { name: 'city', type: 'text' },
        { name: 'state', type: 'text' },
        { name: 'zip', type: 'text' },
      ],
    },
    {
      name: 'geohash',
      type: 'text',
      index: true,
      admin: {
        description: 'Auto-computed from lat/lng. Used for spatial proximity queries.',
        readOnly: true,
      },
    },
    {
      name: 'serviceRadius',
      type: 'number',
      defaultValue: 25,
      admin: { description: 'Delivery/pickup radius in miles. 0 = pickup only.' },
    },
    // ─── Inventory (what this node HAS or NEEDS) ────────────────────────────
    {
      name: 'inventory',
      type: 'array',
      admin: { description: 'Current stock at this node' },
      fields: [
        { name: 'item', type: 'text', required: true, admin: { description: 'e.g., "Canned Soup", "Blankets", "First Aid Kit"' } },
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
        { name: 'quantity', type: 'number', required: true, min: 0 },
        { name: 'unit', type: 'text', defaultValue: 'units', admin: { description: 'e.g., "cases", "lbs", "units"' } },
        { name: 'expiresAt', type: 'date', admin: { description: 'For perishables' } },
      ],
    },
    {
      name: 'needs',
      type: 'array',
      admin: { description: 'What this node currently needs — drives demand matching' },
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
        { name: 'urgency', type: 'select', defaultValue: 'standard', options: [
          { label: 'Standard', value: 'standard' },
          { label: 'Urgent', value: 'urgent' },
          { label: 'SOS / Emergency', value: 'sos' },
        ]},
      ],
    },
    // ─── Operational ────────────────────────────────────────────────────────
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      index: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Seasonal', value: 'seasonal' },
      ],
    },
    {
      name: 'operatingHours',
      type: 'text',
      admin: { description: 'e.g., "Mon-Fri 9am-5pm" or "24/7"' },
    },
    {
      name: 'contactName',
      type: 'text',
    },
    {
      name: 'contactPhone',
      type: 'text',
    },
    {
      name: 'contactEmail',
      type: 'email',
    },
  ],
}
