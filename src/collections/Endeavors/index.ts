/**
 * Endeavors Collection
 *
 * The constitutional identity of an Enterprise — what it is, what it does,
 * and what it stands for. Think of it as the "Articles of Incorporation"
 * for an Angel OS Enterprise.
 *
 * One Endeavor per Enterprise. Created during the Leo Wizard (wizard step 1).
 * Contains constitution signing data and federation network status.
 *
 * This is NOT a replacement for Products/Bookings/Events — those remain
 * separate collections. The Endeavor is the meta-object that declares
 * what kind of value-creation this Enterprise is organized around.
 *
 * Constitutional Reference: "An Endeavor is ONE constitutional object that
 * configures itself as a business, cause, creator channel, community, or
 * media presence. The Endeavor owner decides. The platform does not."
 */

import type { CollectionConfig } from 'payload'

export const Endeavors: CollectionConfig = {
  slug: 'endeavors',
  admin: {
    group: 'Angel OS',
    useAsTitle: 'name',
    defaultColumns: ['name', 'endeavorType', 'status', 'updatedAt'],
    description:
      'The constitutional identity of an Enterprise — what it is, what it does, and what it stands for.',
  },
  access: {
    // Network-visible for federation catalog (filter by federation.networkVisible)
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
    // ── Identity ──────────────────────────────────────────────────
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Official name of this Endeavor / Enterprise',
        placeholder: 'e.g., Clearwater Cruisin\' Ministries',
      },
    },
    {
      name: 'tagline',
      type: 'text',
      admin: {
        description: 'One-sentence mission statement',
        placeholder: 'e.g., "Connecting the community through music and faith"',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      admin: {
        description: 'Full description of what this Enterprise does and stands for',
        rows: 4,
      },
    },
    {
      name: 'endeavorType',
      type: 'select',
      required: true,
      options: [
        { label: 'Service Provider', value: 'service-provider' },
        { label: 'Retail & Commerce', value: 'retail-commerce' },
        { label: 'Creator & Content', value: 'creator-content' },
        { label: 'Booking & Scheduling', value: 'booking-based' },
        { label: 'Custom', value: 'custom' },
      ],
      admin: {
        description: 'The primary operational model of this Enterprise',
      },
    },
    // ── Holon Types (Sprint 20) ────────────────────────────────────
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
      ],
      admin: {
        description:
          'Federation holon type(s). Determines marketplace behavior, revenue flow, and federation visibility. Set during Leo Wizard step 5.',
      },
    },
    {
      name: 'missionStatement',
      type: 'textarea',
      admin: {
        description: 'What does this Enterprise serve? Set during Leo Wizard step 5.',
        rows: 3,
        placeholder: 'e.g., "Connecting Gulf Coast creators with the world"',
      },
    },

    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'forming',
      options: [
        {
          label: 'Forming',
          value: 'forming',
          // Leo Wizard in progress
        },
        {
          label: 'Active',
          value: 'active',
          // Wizard complete, Enterprise is operating
        },
        {
          label: 'Suspended',
          value: 'suspended',
          // Constitutional violation — human review required
        },
        {
          label: 'Retired',
          value: 'retired',
          // Gracefully wound down; suitcase exported
        },
      ],
      admin: {
        description:
          '"Forming" during Leo Wizard setup. "Active" once the Enterprise is live and federated.',
      },
    },

    // ── Relationships ─────────────────────────────────────────────
    // Note: 'tenant' field is added automatically by the multi-tenant plugin
    {
      name: 'primarySpace',
      type: 'relationship',
      relationTo: 'spaces',
      admin: {
        description: 'The main community space for this Endeavor — created during Leo Wizard step 3',
      },
    },

    // ── Operator ─────────────────────────────────────────────────
    {
      name: 'operator',
      type: 'group',
      admin: {
        description: 'The human who runs this Enterprise',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          admin: { placeholder: 'Full name' },
        },
        {
          name: 'email',
          type: 'email',
        },
        {
          name: 'role',
          type: 'text',
          admin: {
            description: 'e.g., "Founder", "Chapter Lead", "Community Manager"',
          },
        },
      ],
    },

    // ── Capabilities ─────────────────────────────────────────────
    {
      name: 'capabilities',
      type: 'array',
      admin: {
        description: 'What this Enterprise can offer to the network (visible in federation catalog)',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'skill',
          type: 'text',
          required: true,
          admin: { placeholder: 'e.g., "Custom music production"' },
        },
        {
          name: 'description',
          type: 'text',
          admin: { placeholder: 'Brief description' },
        },
      ],
    },

    // ── Federation ────────────────────────────────────────────────
    {
      name: 'federation',
      type: 'group',
      admin: {
        description: 'Network participation and constitutional commitment',
      },
      fields: [
        {
          name: 'networkVisible',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'Appear in the Angel OS network catalog. Enable after Leo Wizard is complete.',
          },
        },
        {
          name: 'ministryStatus',
          type: 'select',
          defaultValue: 'applicant',
          options: [
            { label: 'Applicant', value: 'applicant' },
            { label: 'Probation (90 days)', value: 'probation' },
            { label: 'Active Member', value: 'active' },
            { label: 'Suspended', value: 'suspended' },
          ],
          admin: {
            description:
              'Federation trust level. Starts as "applicant" after first ping. Advances to "active" after 90-day probation and 2 vouches.',
          },
        },
        {
          name: 'constitutionVersion',
          type: 'text',
          defaultValue: '1.1',
          admin: {
            description: 'Version of the Angel OS Constitution that was signed',
            readOnly: true,
          },
        },
        {
          name: 'constitutionSignedAt',
          type: 'date',
          admin: {
            description: 'When the operator signed the Angel OS Constitution',
            readOnly: true,
          },
        },
        {
          name: 'constitutionSignature',
          type: 'text',
          admin: {
            description:
              'Ed25519 signature of the constitution signing event (hex-encoded, first 32 chars shown)',
            readOnly: true,
          },
        },
        {
          name: 'federationId',
          type: 'text',
          admin: {
            description:
              'Unique UUID assigned at constitution signing — the Enterprise\'s immutable identity in the federation network',
            readOnly: true,
          },
        },
        {
          name: 'lastPingAt',
          type: 'date',
          admin: {
            description: 'When this Enterprise last pinged the federation registry',
            readOnly: true,
          },
        },
      ],
    },

    // ── Branding ──────────────────────────────────────────────────
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Primary logo for network catalog display',
      },
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Cover image for the network catalog card',
      },
    },

    // ── Region ────────────────────────────────────────────────────
    {
      name: 'region',
      type: 'group',
      admin: {
        description: 'Geographic region for network discovery and routing',
      },
      fields: [
        { name: 'city', type: 'text' },
        { name: 'state', type: 'text' },
        {
          name: 'country',
          type: 'text',
          defaultValue: 'US',
        },
      ],
    },
  ],
}
