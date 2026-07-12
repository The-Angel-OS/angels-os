import type { CollectionConfig } from 'payload'

/**
 * Transports — The Soul Fleet.
 *
 * Represents vehicles (or people on foot/bike) that move resources between
 * LogisticsNodes. Each transport belongs to a user and has a capacity,
 * current status, and a "vibe name" because the Soul Fleet has personality.
 *
 * Transport types range from cargo vans to bicycle couriers — the network
 * doesn't discriminate on vehicle type, only on what fits.
 *
 * @see src/utilities/logistics-engine.ts — findNearestTransport()
 * @see src/collections/Logistics/Shipments.ts — Manifest assignment
 */
export const Transports: CollectionConfig = {
  slug: 'transports',
  admin: {
    group: 'Logistics',
    useAsTitle: 'vehicleName',
    defaultColumns: ['vehicleName', 'owner', 'transportType', 'status', 'capacity'],
    listSearchableFields: ['vehicleName', 'availableFrom'],
    description: 'Soul Fleet vehicles and couriers that move resources between nodes.',
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
      name: 'vehicleName',
      type: 'text',
      required: true,
      admin: { description: 'Give it a name. "Soul Van 1", "The Enterprise", "Blue Thunder" — the vibe matters.' },
    },
    {
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      required: true,
      index: true,
      admin: { description: 'The driver / operator responsible for this transport.' },
    },
    {
      name: 'transportType',
      type: 'select',
      required: true,
      defaultValue: 'van',
      options: [
        { label: 'Cargo Van', value: 'van' },
        { label: 'Pickup Truck', value: 'pickup' },
        { label: 'Box Truck', value: 'box_truck' },
        { label: 'SUV / Car', value: 'car' },
        { label: 'Bicycle / Cargo Bike', value: 'bicycle' },
        { label: 'On Foot', value: 'foot' },
        { label: 'Boat', value: 'boat' },
        { label: 'Drone', value: 'drone' },
      ],
    },
    {
      name: 'capacity',
      type: 'number',
      required: true,
      min: 1,
      admin: { description: 'Cargo capacity in standard units (1 unit = approx 1 cubic foot / 30 lbs).' },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'idle',
      index: true,
      options: [
        { label: 'Idle — Available for dispatch', value: 'idle' },
        { label: 'En Route — Currently on a delivery', value: 'en_route' },
        { label: 'Loading — At pickup location', value: 'loading' },
        { label: 'Returning — Heading back', value: 'returning' },
        { label: 'Offline — Not available', value: 'offline' },
        { label: 'Maintenance', value: 'maintenance' },
      ],
    },
    // ─── Current Location ───────────────────────────────────────────────────
    {
      name: 'currentLocation',
      type: 'group',
      admin: { description: 'Last known position. Updated by driver app or GPS integration.' },
      fields: [
        { name: 'lat', type: 'number' },
        { name: 'lng', type: 'number' },
        { name: 'updatedAt', type: 'date', admin: { description: 'When this position was last reported' } },
      ],
    },
    {
      name: 'homeBase',
      type: 'relationship',
      relationTo: 'logistics-nodes',
      index: true,
      admin: { description: 'Where this transport is normally stationed.' },
    },
    // ─── Operational ────────────────────────────────────────────────────────
    {
      name: 'maxRange',
      type: 'number',
      defaultValue: 50,
      admin: { description: 'Maximum one-way range in miles the driver is willing to travel.' },
    },
    {
      name: 'availableFrom',
      type: 'text',
      admin: { description: 'Availability schedule, e.g., "Weekdays 6am-2pm" or "On-call"' },
    },
    {
      name: 'specialCapabilities',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Refrigerated', value: 'refrigerated' },
        { label: 'Temperature Controlled', value: 'temp_controlled' },
        { label: 'Hazmat Certified', value: 'hazmat' },
        { label: 'Wheelchair Accessible', value: 'accessible' },
        { label: 'Pet-Friendly', value: 'pet_friendly' },
      ],
      admin: { description: 'Special capabilities this transport offers.' },
    },
    // ─── Stats ──────────────────────────────────────────────────────────────
    {
      name: 'completedDeliveries',
      type: 'number',
      defaultValue: 0,
    },
    {
      name: 'rating',
      type: 'number',
      defaultValue: 5,
      min: 0,
      max: 5,
      admin: { description: 'Driver reliability rating (0-5).' },
    },
    {
      name: 'activeShipment',
      type: 'relationship',
      relationTo: 'shipments',
      index: true,
      admin: { description: 'Currently assigned shipment (if en_route).' },
    },
  ],
}
