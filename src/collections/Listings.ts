import type { CollectionConfig } from 'payload'
import { authenticated } from '@/access/authenticated'
import { publicWithTenantScope } from '@/access/publicWithTenantScope'

/**
 * Listings — the bookable-inventory primitive.
 *
 * ONE mode-agnostic unit that every reservation vertical shares (see
 * docs/strategy/BOOKABLE_INVENTORY_PLAN.md). A church hall, a campsite, a motel
 * room, a storage bay, and a rental unit are all Listings — they differ only by
 * `mode`, `rateUnit`, and the free-form `attributes` bag, not by shape.
 *
 *   facility → hourly / per-day (halls, rooms, venues) — rides the existing
 *              slot BookingEngine as-is.
 *   stay     → per-night, multi-day range (motel, cabin, campsite, slip) —
 *              needs the date-range booking extension.
 *   rent     → recurring monthly (lease, storage, seasonal) — rides Memberships
 *              + ACH.
 *
 * A Listing is a ROW the operating endeavor OWNS (tenant-scoped), NOT a separate
 * tenant. Many listings under one endeavor (a campground's 80 sites). That is a
 * different granularity from sub-endeavors-under-an-umbrella (market vendors),
 * which stay their own tenants. @see BOOKABLE_INVENTORY_PLAN.md §3.
 *
 * NOTE: mode-specific templates, the date-range engine, the site-map picker, and
 * ACH are deliberately NOT built yet — they depend on product decisions still
 * open. This collection is the shared foundation those build on.
 */
export const Listings: CollectionConfig = {
  slug: 'listings',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'mode', 'unitType', 'rateCents', 'rateUnit', 'isActive'],
    listSearchableFields: ['title', 'unitType', 'description'],
    group: 'Commerce',
    description:
      'Bookable inventory — halls, rooms, campsites, units. Mode-agnostic (facility/stay/rent).',
  },
  access: {
    // Public read (guests browse listings to book them), tenant-scoped. Writes
    // are admin/operator work. Mirrors Endeavors' publicWithTenantScope pattern.
    read: publicWithTenantScope,
    create: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: { description: 'Display name, e.g. "Fellowship Hall", "Site 42", "Room 204"' },
    },
    {
      name: 'mode',
      type: 'select',
      required: true,
      index: true,
      defaultValue: 'facility',
      options: [
        { label: 'Facility (hourly / per-day)', value: 'facility' },
        { label: 'Stay (per-night, multi-day)', value: 'stay' },
        { label: 'Rent (recurring monthly)', value: 'rent' },
      ],
      admin: {
        description:
          'Determines time granularity and payment rail. facility=slot booking (card), stay=date range (card), rent=recurring (ACH).',
      },
    },
    {
      name: 'unitType',
      type: 'text',
      admin: {
        description:
          'Template-seeded taxonomy label, e.g. "hall", "classroom", "RV pad", "cabin", "storage bay".',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: { rows: 3 },
    },
    {
      name: 'media',
      type: 'upload',
      relationTo: 'media',
      hasMany: true,
      admin: { description: 'Photos of the space/unit.' },
    },
    {
      name: 'capacity',
      type: 'number',
      admin: { description: 'Max occupancy / seats / party size.' },
    },
    // ── Rate model ──────────────────────────────────────────────────
    {
      type: 'row',
      fields: [
        {
          name: 'rateCents',
          type: 'number',
          admin: { width: '50%', description: 'Base rate in cents, per rateUnit.' },
        },
        {
          name: 'rateUnit',
          type: 'select',
          defaultValue: 'hour',
          options: [
            { label: 'Per hour', value: 'hour' },
            { label: 'Per day', value: 'day' },
            { label: 'Per night', value: 'night' },
            { label: 'Per month', value: 'month' },
          ],
          admin: { width: '50%' },
        },
      ],
    },
    {
      name: 'minUnits',
      type: 'number',
      admin: {
        description: 'Minimum units per reservation (min-stay nights / min-hours). Blank = 1.',
      },
    },
    {
      type: 'row',
      fields: [
        {
          name: 'cleaningFeeCents',
          type: 'number',
          admin: { width: '33%', description: 'One-off cleaning fee (cents).' },
        },
        {
          name: 'depositCents',
          type: 'number',
          admin: { width: '33%', description: 'Booking deposit (cents). Overrides depositPercent.' },
        },
        {
          name: 'depositPercent',
          type: 'number',
          admin: { width: '34%', description: 'Booking deposit as % of total (0–100).' },
        },
      ],
    },
    {
      name: 'securityDepositCents',
      type: 'number',
      admin: { description: 'Refundable security deposit / hold (cents). Stays & rent.' },
    },
    // ── Mode-specific extras (schema-drift-proof) ───────────────────
    {
      name: 'attributes',
      type: 'json',
      admin: {
        description:
          'Free-form mode-specific attributes so verticals extend without schema churn — campsite hookups (30/50-amp, water, sewer, full), pad type, max rig length, pull-through/back-in, pet-friendly; room amenities; hall AV. Template-seeded.',
      },
    },
    // ── Ownership / status ──────────────────────────────────────────
    {
      // The person who manages this listing. tenant is added by multiTenantPlugin.
      name: 'owner',
      type: 'relationship',
      relationTo: 'users',
      admin: { description: 'Operator/host who manages this listing.' },
    },
    {
      name: 'isActive',
      type: 'checkbox',
      defaultValue: true,
      index: true,
      admin: { description: 'Uncheck to hide from booking without deleting.', position: 'sidebar' },
    },
  ],
}
