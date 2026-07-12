import type { CollectionConfig } from 'payload'

/**
 * Vendors — the fulfillment-holon registry for a marketing/broker holon.
 *
 * A vendor is a supply-side holon (e.g. a local dumpster-rental operator) that the
 * platform routes captured demand to. Lightweight tier: just a record + service
 * area + capabilities + trust (gets emailed/SMS'd leads). Full tier: later links to
 * its own Endeavor/portal. This is the generic services-marketplace primitive —
 * dumpster is instance #1 (solar, junk removal, etc. reuse it).
 *
 * Routing is deterministic (VendorRoutingService.matchVendors — pure, no LLM).
 * Per-vendor operational config (notification prefs, capacity tuning) lives in the
 * Setting bag (entityName:'vendor'); this collection holds only what we ROUTE on.
 *
 * @see docs/architecture/OQTANE_SPINE.md · project_kendev_commercial_arm (memory)
 */
export const Vendors: CollectionConfig = {
  slug: 'vendors',
  admin: {
    group: 'Marketplace',
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'trustLevel', 'contactEmail'],
    listSearchableFields: ['name', 'contactEmail', 'contactPhone'],
    description: 'Fulfillment-holon registry — operators the platform routes leads to.',
  },
  access: {
    create: ({ req: { user } }) => Boolean(user),
    read: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => Boolean(user),
  },
  fields: [
    { name: 'name', type: 'text', required: true },
    { name: 'contactEmail', type: 'text', index: true },
    { name: 'contactPhone', type: 'text' },
    {
      name: 'serviceZips',
      type: 'json',
      admin: { description: 'Zip codes this vendor serves, e.g. ["33755","33756"]. Zip-list MVP; geo-polygon later.' },
    },
    {
      name: 'sizes',
      type: 'json',
      admin: { description: 'Container/service sizes offered, e.g. ["10yd","15yd","20yd"].' },
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      index: true,
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Paused', value: 'paused' },
      ],
    },
    {
      name: 'trustLevel',
      type: 'select',
      defaultValue: 'probation',
      index: true,
      admin: { description: 'Diocese trust grain — gates lead priority. Decays on bad fulfillment.' },
      options: [
        { label: 'Probation', value: 'probation' },
        { label: 'Vouched', value: 'vouched' },
        { label: 'Full', value: 'full' },
      ],
    },
    {
      name: 'maxConcurrent',
      type: 'number',
      admin: { description: 'Soft capacity cap — max active leads at once (0/blank = unlimited).' },
    },
    {
      name: 'endeavor',
      type: 'relationship',
      relationTo: 'endeavors',
      admin: { description: 'Optional — set once the vendor graduates to its own portal/endeavor.' },
    },
  ],
}
