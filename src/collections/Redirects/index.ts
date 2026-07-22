import type { CollectionConfig } from 'payload'
import { checkRole } from '@/access/utilities'

/**
 * Redirects — database-configured URL mapping, per tenant.
 *
 * Purpose: when a business migrates its old site onto its portal (e.g.
 * NeuroCare Pro's ~112-page WordPress site), every old URL keeps working:
 * `/product/red-light-panel` on the old site 301s to the right place on the
 * portal. Rows are seeded from the old site's sitemap (see
 * scripts/_local/import-*-redirects.ts) and editable in the admin UI.
 *
 * Lookup happens in the frontend catch-all (see app/[locale]/(app)/[slug] and
 * the [...missing] catch-all): unmatched paths consult this collection for the
 * request's tenant before 404ing. Deliberately our own 5-field collection
 * rather than @payloadcms/plugin-redirects — same admin UI, one table, no
 * plugin schema to hand-migrate, and tenant scoping via the standard map.
 */
export const Redirects: CollectionConfig = {
  slug: 'redirects',
  admin: {
    useAsTitle: 'from',
    group: 'Content',
    description: 'Old-site URL → new destination. Applied when a visitor hits a path that no longer exists.',
    defaultColumns: ['from', 'to', 'enabled', 'updatedAt'],
  },
  access: {
    read: () => true, // consulted by the public 404 path; rows contain no secrets
    create: ({ req: { user } }) => Boolean(user && checkRole(['super_admin', 'admin'], user)),
    update: ({ req: { user } }) => Boolean(user && checkRole(['super_admin', 'admin'], user)),
    delete: ({ req: { user } }) => Boolean(user && checkRole(['super_admin', 'admin'], user)),
  },
  fields: [
    {
      name: 'from',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Old path, starting with / (e.g. /product/red-light-panel). Query strings are ignored at match time.',
      },
      hooks: {
        beforeValidate: [
          ({ value }) => {
            if (typeof value !== 'string') return value
            // Normalize: path only, no trailing slash (except root), lowercase.
            let v = value.trim()
            try {
              if (/^https?:\/\//i.test(v)) v = new URL(v).pathname
            } catch {
              /* keep as-is */
            }
            v = v.split('?')[0].split('#')[0]
            if (v.length > 1 && v.endsWith('/')) v = v.slice(0, -1)
            return v.toLowerCase()
          },
        ],
      },
    },
    {
      name: 'to',
      type: 'text',
      required: true,
      admin: {
        description: 'Destination: a portal path (/shop, /posts/my-post) or a full URL.',
      },
    },
    {
      name: 'enabled',
      type: 'checkbox',
      defaultValue: true,
      index: true,
    },
    {
      name: 'note',
      type: 'text',
      admin: { description: 'Where this mapping came from (e.g. "old sitemap import 260722").' },
    },
  ],
}
