/**
 * Memberships — recurring membership/dues subscriptions (the universal unlock).
 *
 * One row per member's recurring subscription to an endeavor's plan: church pledges,
 * gym memberships, makerspace/Toastmasters dues, market booth fees — the SAME
 * primitive across every community-org vertical. Dues are billed via Stripe on the
 * endeavor's CONNECTED account (the money lands in the endeavor's hands; the platform
 * takes a small application fee), and the status here is the authoritative
 * "who's a member / are their dues current" answer.
 *
 * Written programmatically (create/update closed) — rows are upserted by the Stripe
 * webhook (customer.subscription.* / invoice.*) and the checkout flow. Own `tenant`
 * field (NOT in the multiTenantPlugin list, matches Wallets/Signatures). No
 * drafts/versions → single flat table, single rels → no junction table.
 *
 * @see src/endpoints/membership-checkout.ts  @see src/utilities/membershipPlans.ts
 * @see docs/strategy/COMMUNITY_OS_VERTICALS.md
 */
import type { CollectionConfig } from 'payload'

export const Memberships: CollectionConfig = {
  slug: 'memberships',
  admin: {
    group: 'Economy',
    useAsTitle: 'memberEmail',
    defaultColumns: ['memberEmail', 'planName', 'status', 'amountCents', 'interval', 'tenant'],
    listSearchableFields: ['memberEmail', 'memberName', 'planName', 'planId', 'stripeSubscriptionId', 'stripeCustomerId'],
    description: 'Recurring membership/dues subscriptions per endeavor.',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      const roles = (user as { roles?: string[] }).roles ?? []
      if (roles.includes('super_admin') || roles.includes('admin')) return true
      // A member sees their own memberships.
      return { member: { equals: (user as { id?: number | string }).id } }
    },
    create: () => false, // upserted by the checkout flow + Stripe webhook
    update: () => false,
    delete: ({ req: { user } }) =>
      Boolean(user && ((user as { roles?: string[] }).roles ?? []).includes('super_admin')),
  },
  fields: [
    { name: 'tenant', type: 'relationship', relationTo: 'tenants', required: true, index: true },
    { name: 'member', type: 'relationship', relationTo: 'users', index: true,
      admin: { description: 'The subscribing user, when known. Blank for email-only members.' } },
    { name: 'memberEmail', type: 'text', index: true },
    { name: 'memberName', type: 'text' },
    { name: 'planId', type: 'text', index: true, admin: { description: 'Plan id from the tenant membership-plans (settings bag).' } },
    { name: 'planName', type: 'text' },
    { name: 'amountCents', type: 'number' },
    { name: 'interval', type: 'select', defaultValue: 'month',
      options: [{ label: 'Monthly', value: 'month' }, { label: 'Yearly', value: 'year' }] },
    { name: 'status', type: 'select', index: true, defaultValue: 'incomplete',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Trialing', value: 'trialing' },
        { label: 'Past Due', value: 'past_due' },
        { label: 'Canceled', value: 'canceled' },
        { label: 'Incomplete', value: 'incomplete' },
      ] },
    { name: 'stripeSubscriptionId', type: 'text', index: true, admin: { readOnly: true } },
    { name: 'stripeCustomerId', type: 'text', admin: { readOnly: true } },
    { name: 'currentPeriodEnd', type: 'date', admin: { readOnly: true } },
    { name: 'startedAt', type: 'date', admin: { readOnly: true } },
    { name: 'metadata', type: 'json' },
  ],
  timestamps: true,
}
