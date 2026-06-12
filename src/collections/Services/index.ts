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

export const Services: CollectionConfig = {
  slug: 'services',
  admin: {
    group: 'Commerce',
    useAsTitle: 'label',
    defaultColumns: ['label', 'priceUSD', 'durationMinutes', 'enabled', 'tenant'],
    description: 'Bookable services offered by this tenant (the /book catalog).',
  },
  access: {
    // Public read of enabled services drives the booking page; writes are gated.
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
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
    { name: 'priceUsd', type: 'number', required: true, min: 0, admin: { description: 'Total price in USD.' } },
    { name: 'depositPercent', type: 'number', required: true, min: 0, max: 100, defaultValue: 20,
      admin: { description: 'Percent charged up front to reserve; balance due on completion.' } },
    { name: 'durationMinutes', type: 'number', required: true, min: 1, defaultValue: 60,
      admin: { description: "How long the booking occupies the provider's calendar." } },
    { name: 'enabled', type: 'checkbox', defaultValue: true, index: true,
      admin: { description: 'Unchecked = hidden from the booking page.' } },
  ],
  timestamps: true,
}
