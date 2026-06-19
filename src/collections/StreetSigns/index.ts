/**
 * StreetSigns Collection — Federation Marketplace Discovery
 *
 * Street Signs are lightweight cross-holon content references.
 * When a product, post, or event resonates within one Enterprise,
 * it can be surfaced across the federation via a Street Sign —
 * always crediting and compensating the source.
 *
 * Constitutional Reference: "Popular content within one Enterprise
 * becomes discoverable across the federation through street signs —
 * lightweight references that point to the source holon."
 *
 * A Street Sign is NOT a copy. It is a pointer with attribution.
 * The source Enterprise retains sovereignty over the content.
 *
 * @see docs/planning/20260224 FEDERATION.md — Street Signs architecture
 */

import type { CollectionConfig } from 'payload'

export const StreetSigns: CollectionConfig = {
  slug: 'street-signs',
  admin: {
    group: 'Federation',
    useAsTitle: 'title',
    defaultColumns: ['title', 'contentType', 'sourceEnterprise', 'status', 'impressions'],
    description:
      'Cross-holon content references — lightweight pointers that surface content across the federation.',
  },
  access: {
    // Public read for federation marketplace discovery
    read: () => true,
    create: ({ req: { user } }) => Boolean(user),
    update: ({ req: { user } }) => Boolean(user),
    delete: ({ req: { user } }) => {
      if (!user) return false
      const roles = (user as { roles?: string[] }).roles ?? []
      return roles.includes('super_admin') || roles.includes('admin')
    },
  },

  fields: [
    // ── Content Reference ──────────────────────────────────────────
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Display title for this street sign (may differ from source content title)',
        placeholder: 'e.g., "Gulf Coast Sunset Photography Collection"',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Brief description shown in federation search results',
        rows: 3,
      },
    },
    {
      name: 'contentType',
      type: 'select',
      index: true,
      required: true,
      options: [
        { label: 'Product', value: 'product' },
        { label: 'Post / Article', value: 'post' },
        { label: 'Event', value: 'event' },
        { label: 'Endeavor', value: 'endeavor' },
        { label: 'Creator Portfolio', value: 'portfolio' },
        { label: 'Service', value: 'service' },
      ],
      admin: {
        description: 'What kind of content this street sign points to',
      },
    },

    // ── Source Pointer ──────────────────────────────────────────────
    {
      name: 'source',
      type: 'group',
      admin: {
        description: 'Where this content lives — the source of truth',
      },
      fields: [
        {
          name: 'dioceseName',
          type: 'text',
          required: true,
          admin: {
            description: 'Name of the source Enterprise (e.g., "Clearwater Cruisin")',
          },
        },
        {
          name: 'dioceseDomain',
          type: 'text',
          required: true,
          admin: {
            description: 'Domain of the source Enterprise (e.g., "clearwatercruisin.com")',
          },
        },
        {
          name: 'federationId',
          type: 'text',
          required: true,
          admin: {
            description: 'Federation UUID of the source Enterprise',
          },
        },
        {
          name: 'contentId',
          type: 'text',
          required: true,
          admin: {
            description: 'ID of the content at the source Enterprise',
          },
        },
        {
          name: 'contentUrl',
          type: 'text',
          admin: {
            description: 'Direct URL to the content at the source Enterprise',
          },
        },
        {
          name: 'creatorName',
          type: 'text',
          admin: {
            description: 'Name of the content creator (for attribution)',
          },
        },
      ],
    },

    // ── Discovery Tags ─────────────────────────────────────────────
    {
      name: 'tags',
      type: 'array',
      admin: {
        description: 'Tags for federation search and discovery',
      },
      fields: [
        {
          name: 'tag',
          type: 'text',
          required: true,
          admin: {
            placeholder: 'e.g., "photography", "gulf-coast", "art"',
          },
        },
      ],
    },
    {
      name: 'holonTypes',
      type: 'select',
      hasMany: true,
      options: [
        { label: 'Manufacturer', value: 'manufacturer' },
        { label: 'Retailer', value: 'retailer' },
        { label: 'Creator', value: 'creator' },
        { label: 'Community', value: 'community' },
        { label: 'Guardian Angel', value: 'guardian-angel' },
        // Mirror of Endeavors.holonTypes economic roles (Sprint 26).
        { label: 'Service Provider', value: 'service-provider' },
        { label: 'Marketing (lead capture / reseller)', value: 'marketing' },
        { label: 'Fulfillment (does the work)', value: 'fulfillment' },
      ],
      admin: {
        description: 'Which holon types should see this street sign',
      },
    },
    {
      name: 'region',
      type: 'text',
      admin: {
        description: 'Geographic region tag (e.g., "us-east", "gulf-coast")',
      },
    },

    // ── Display ────────────────────────────────────────────────────
    {
      name: 'thumbnail',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Thumbnail image for federation catalog display',
      },
    },
    {
      name: 'price',
      type: 'number',
      admin: {
        description: 'Price in cents (if applicable — for product street signs)',
      },
    },
    {
      name: 'currency',
      type: 'text',
      defaultValue: 'usd',
      admin: {
        description: 'Currency code (e.g., "usd")',
      },
    },

    // ── Status & Metrics ───────────────────────────────────────────
    {
      name: 'status',
      type: 'select',
      index: true,
      required: true,
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Expired', value: 'expired' },
        { label: 'Revoked', value: 'revoked' },
      ],
      admin: {
        description: 'Active signs appear in federation search. Revoked = source Enterprise removed content.',
      },
    },
    {
      name: 'impressions',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'How many times this street sign has been shown in search results',
        readOnly: true,
      },
    },
    {
      name: 'clickThroughs',
      type: 'number',
      defaultValue: 0,
      admin: {
        description: 'How many times users clicked through to the source content',
        readOnly: true,
      },
    },
    {
      name: 'lastSyncedAt',
      type: 'date',
      admin: {
        description: 'When this street sign was last verified against the source Enterprise',
        readOnly: true,
      },
    },
    {
      name: 'expiresAt',
      type: 'date',
      admin: {
        description: 'Optional expiration date (e.g., for time-limited events)',
      },
    },
  ],
}
