import type { CollectionConfig } from 'payload'

import { checkRole } from '@/access/utilities'

/**
 * SiteVisits — one row per public page view. The substrate for the Site Log.
 *
 * This is the DNN Site Log module's job, done deliberately rather than by
 * accident. DNN's was eventually deprecated for one reason worth learning from:
 * it wrote a row for every request forever and quietly became the largest table
 * in the database. So:
 *
 *   - Only PUBLIC page renders are recorded (see recordSiteVisit) — never assets,
 *     never /api, never the dashboard or admin.
 *   - Rows are pruned on the same nightly janitor as application-logs.
 *   - No raw IP is ever stored. `visitorHash` is a salted, per-day digest, which
 *     counts unique visitors without keeping anything that identifies one.
 *
 * Append-only and system-written (overrideAccess). Writes are FAIL-SOFT, so this
 * is safe to deploy before the table exists on a given node.
 *
 * @see src/utilities/recordSiteVisit.ts — the writer
 * @see src/endpoints/site-log-report.ts — the aggregates the dashboard reads
 */
export const SiteVisits: CollectionConfig = {
  slug: 'site-visits',
  admin: {
    group: 'System',
    useAsTitle: 'path',
    defaultColumns: ['path', 'referrerHost', 'browser', 'os', 'isBot', 'createdAt'],
    listSearchableFields: ['path', 'referrerHost', 'userAgent'],
    hidden: ({ user }) =>
      !(user && 'roles' in user && Array.isArray(user.roles) && user.roles.includes('super_admin')),
  },
  access: {
    create: () => false, // system only (overrideAccess)
    read: ({ req: { user } }) => Boolean(user),
    update: () => false,
    delete: ({ req: { user } }) => Boolean(checkRole(['super_admin'], user)),
  },
  fields: [
    {
      name: 'path',
      type: 'text',
      required: true,
      index: true,
      admin: { description: 'The page that was viewed, without query string.' },
    },
    {
      name: 'referrer',
      type: 'text',
      admin: { description: 'Full referring URL, when the browser sent one.' },
    },
    {
      name: 'referrerHost',
      type: 'text',
      index: true,
      admin: { description: 'Just the referring domain — what the Referrers report groups on.' },
    },
    {
      name: 'userAgent',
      type: 'text',
      admin: { description: 'Raw User-Agent string.' },
    },
    { name: 'browser', type: 'text', index: true },
    { name: 'os', type: 'text', index: true },
    {
      name: 'device',
      type: 'select',
      index: true,
      defaultValue: 'desktop',
      options: [
        { label: 'Desktop', value: 'desktop' },
        { label: 'Mobile', value: 'mobile' },
        { label: 'Tablet', value: 'tablet' },
        { label: 'Bot', value: 'bot' },
      ],
    },
    {
      name: 'isBot',
      type: 'checkbox',
      index: true,
      defaultValue: false,
      admin: {
        description:
          'Crawlers are recorded but flagged, so the reports can exclude them without losing the fact that they came.',
      },
    },
    {
      name: 'visitorHash',
      type: 'text',
      index: true,
      admin: {
        description:
          'Salted per-day digest of IP + user agent. Counts unique visitors; identifies nobody, and cannot be reversed to an IP.',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'users',
      index: true,
      admin: { description: 'Set when the visitor was signed in.' },
    },
  ],
  timestamps: true,
}
