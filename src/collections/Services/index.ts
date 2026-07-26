/**
 * Services — a tenant's bookable service catalog (admin/owner-editable).
 *
 * Promotes the static `src/config/bookableServices.ts` catalog into a real
 * collection so owners configure their own services from Business Ops (the
 * "services configurator"). Each service drives the /book flow: duration shapes
 * the slot grid, price + depositPercent drive the reservation deposit, balance
 * settles on completion.
 *
 * Resolution falls back to the static seed when a tenant has no DB rows yet, so
 * the migration is non-breaking. One of three "offering" kinds (Product / Service
 * / Quest) configured through the unified Catalog surface.
 *
 * @see src/utilities/resolveServices.ts  @see src/config/bookableServices.ts
 */
import type { CollectionConfig } from 'payload'
import { isTenantMember } from '@/access/isTenantMember'

export const Services: CollectionConfig = {
  slug: 'services',
  admin: {
    group: 'Commerce',
    useAsTitle: 'label',
    defaultColumns: ['label', 'priceUSD', 'durationMinutes', 'enabled', 'tenant'],
    listSearchableFields: ['label', 'serviceId', 'description', 'unitLabel'],
    description: 'Bookable services offered by this tenant (the /book catalog).',
  },
  access: {
    // Public read of enabled services drives the booking page; writes are gated.
    read: () => true,
    create: isTenantMember,
    // NOT `Boolean(user)`: this collection is not multi-tenant-plugin wrapped,
    // so that let any signed-in customer rewrite ANOTHER endeavor's service —
    // including its price and deposit, which is what /book charges.
    update: isTenantMember,
    delete: ({ req: { user } }) => {
      const roles = (user as { roles?: string[] } | null)?.roles ?? []
      return roles.includes('super_admin') || roles.includes('admin')
    },
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'serviceId', type: 'text', required: true, index: true,
      admin: { description: 'Stable id used in the booking flow + stored on booking metadata (e.g. pressure-washing-driveway).' } },
    { name: 'label', type: 'text', required: true },
    { name: 'description', type: 'textarea' },
    { name: 'image', type: 'upload', relationTo: 'media' },
    { name: 'bookingType', type: 'select', defaultValue: 'service',
      options: [
        { label: 'Service', value: 'service' },
        { label: 'Consultation', value: 'consultation' },
        { label: 'Rental', value: 'rental' },
        { label: 'Class', value: 'class' },
        { label: 'Event', value: 'event' },
        { label: 'Custom', value: 'custom' },
      ] },
    // ─── Pricing model ───────────────────────────────────────────────
    { name: 'pricingModel', type: 'select', defaultValue: 'fixed', index: true,
      options: [
        { label: 'Fixed price (per job)', value: 'fixed' },
        { label: 'Hourly (billed for time on the clock)', value: 'hourly' },
        { label: 'Per unit (e.g. per sq ft / window / visit)', value: 'per_unit' },
      ],
      admin: { description: 'How this service is priced.' } },
    { name: 'priceUsd', type: 'number', min: 0, admin: { description: 'FIXED: total price in USD.' } },
    { name: 'hourlyRateUsd', type: 'number', min: 0,
      admin: { description: 'HOURLY: rate per hour. Only time actually on the clock is billed — phone calls/breaks are clocked out and not charged.' } },
    { name: 'billingIncrementMinutes', type: 'number', min: 1, defaultValue: 15,
      admin: { description: 'HOURLY: round billed time to this increment (1 = bill exact minutes).' } },
    { name: 'minimumMinutes', type: 'number', min: 0,
      admin: { description: 'HOURLY: minimum billable time per visit (optional).' } },
    { name: 'unitLabel', type: 'text',
      admin: { description: "PER-UNIT: the unit being priced (e.g. 'sq ft', 'window', 'visit')." } },
    { name: 'unitRateUsd', type: 'number', min: 0, admin: { description: 'PER-UNIT: price per unit.' } },
    { name: 'allowsExtraCosts', type: 'checkbox', defaultValue: true,
      admin: { description: 'Allow adding materials / disposal / trip-fee line items to the final bill per job.' } },
    // ─── Booking ──────────────────────────────────────────────────────
    { name: 'depositPercent', type: 'number', min: 0, max: 100, defaultValue: 20,
      admin: { description: 'Percent charged up front to reserve; balance due on completion.' } },
    { name: 'depositFlatUsd', type: 'number', min: 0,
      admin: {
        description:
          'Fixed booking deposit in USD, credited against the final invoice. Takes precedence over depositPercent. This is how a trade takes money for work it cannot price sight-unseen — a percentage of an unknown total is always zero, so a quote-only service could otherwise never hold a slot with a deposit.',
      } },
    { name: 'durationMinutes', type: 'number', min: 1, defaultValue: 60,
      admin: { description: "Estimated/scheduled time the booking holds on the calendar (actual billed time can differ for hourly)." } },
    { name: 'enabled', type: 'checkbox', defaultValue: true, index: true,
      admin: { description: 'Unchecked = hidden from the booking page.' } },
    // ─── Consent ──────────────────────────────────────────────────────
    { name: 'serviceAgreement', type: 'textarea',
      admin: { description: 'Optional rental/service agreement or waiver terms. When set, the customer must sign (e-signature) before paying the deposit at the booking confirm step.' } },
  ],
  timestamps: true,
}
