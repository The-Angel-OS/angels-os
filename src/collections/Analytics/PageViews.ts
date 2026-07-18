import type { CollectionConfig } from 'payload'

/**
 * PageViews — the raw event stream for the native Site Log (the self-hosted,
 * per-Endeavor analytics that replaces Vercel/GA). One row per page view,
 * tenant-scoped (multiTenantPlugin auto-injects `tenant`).
 *
 * PRIVACY: cookieless. A visitor is identified by `sessionHash` = a DAILY-salted
 * hash of ip+ua (the salt rotates each day and is never stored), so uniques are
 * countable within a day but visitors can't be tracked across days or back to an
 * IP. No PII is retained. Matches Plausible's model — GDPR-clean, no consent banner.
 *
 * LIFECYCLE: raw rows are cheap to write, expensive to keep. The rollup job
 * aggregates them into per-day PageViewRollups; the prune job then deletes raw
 * rows past the retention window. So this table stays small; history lives in the
 * rollups. @see src/collections/Analytics/PageViewRollups.ts
 * @see src/endpoints/site-log-collect.ts (writer) @see src/endpoints/site-log-ops.ts (rollup/prune)
 *
 * Access mirrors Pheromones/FederationAuditLog: system-written (overrideAccess),
 * never user-editable; read gated to owners/staff (plugin clamps to their tenant).
 */
export const PageViews: CollectionConfig = {
  slug: 'page-views',
  admin: {
    group: 'Analytics',
    useAsTitle: 'path',
    defaultColumns: ['path', 'referrerHost', 'country', 'device', 'createdAt'],
    listSearchableFields: ['path', 'referrerHost', 'country'],
    description: 'Raw site-log events (cookieless). Aggregated into rollups, then pruned.',
  },
  access: {
    read: ({ req: { user } }) => {
      if (!user) return false
      const roles = (user as { roles?: string[] }).roles ?? []
      // super_admin/admin see all (plugin clamps); tenant owners/staff see their own.
      return roles.includes('super_admin') || roles.includes('admin') || roles.some((r) => r !== 'customer')
    },
    create: () => false, // written by the collector endpoint via overrideAccess
    update: () => false,
    delete: ({ req: { user } }) => {
      if (!user) return false
      const roles = (user as { roles?: string[] }).roles ?? []
      return roles.includes('super_admin') // prune job also uses overrideAccess
    },
  },
  timestamps: true,
  fields: [
    { name: 'path', type: 'text', required: true, index: true, admin: { description: 'Requested pathname (no query string).' } },
    { name: 'referrerHost', type: 'text', index: true, admin: { description: 'Host of the referrer (e.g. "google.com"), or "direct".' } },
    { name: 'referrerFull', type: 'text', admin: { description: 'Full referrer URL, when present.' } },
    { name: 'country', type: 'text', index: true, admin: { description: 'ISO country from Cloudflare (cf-ipcountry).' } },
    {
      name: 'device',
      type: 'select',
      index: true,
      options: [
        { label: 'Desktop', value: 'desktop' },
        { label: 'Mobile', value: 'mobile' },
        { label: 'Tablet', value: 'tablet' },
        { label: 'Bot', value: 'bot' },
      ],
      admin: { description: 'Coarse device class derived from the user agent.' },
    },
    { name: 'sessionHash', type: 'text', index: true, admin: { description: 'Daily-salted hash(ip+ua) — cookieless unique-visitor key. Not reversible to an IP.' } },
    { name: 'isBot', type: 'checkbox', defaultValue: false, index: true, admin: { description: 'Flagged bot/crawler — excluded from human-visitor rollups.' } },
  ],
}
