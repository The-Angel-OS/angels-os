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
 * Beneficiaries (Sprint 25):
 * An Endeavor can designate beneficiaries — people the Endeavor serves who
 * may not yet be on the platform. Each beneficiary receives a claimToken
 * (a unique UUID). When the beneficiary onboards and presents their claim
 * token, the system links their user account to the beneficiary record,
 * marking them as verified. This enables use cases like "Help DNA Free
 * Ernesto Behrens" where the beneficiary isn't yet an Angel OS user.
 *
 * Constitutional Reference: "An Endeavor is ONE constitutional object that
 * configures itself as a business, cause, creator channel, community, or
 * media presence. The Endeavor owner decides. The platform does not."
 */

import type { CollectionConfig } from 'payload'
import { publicWithTenantScope } from '@/access/publicWithTenantScope'
import { generateBeneficiaryTokens } from './hooks/generateBeneficiaryTokens'

export const Endeavors: CollectionConfig = {
  slug: 'endeavors',
  hooks: {
    beforeChange: [generateBeneficiaryTokens],
  },
  admin: {
    group: 'Federation',
    useAsTitle: 'name',
    defaultColumns: ['name', 'endeavorType', 'status', 'updatedAt'],
    description:
      'The constitutional identity of an Enterprise — what it is, what it does, and what it stands for.',
  },
  access: {
    // Network-visible for federation catalog, scoped to current tenant for REST API
    read: publicWithTenantScope,
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
      index: true,
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
        {
          name: 'domain',
          type: 'text',
          admin: {
            description:
              'The FQDN of this peer Enterprise (persisted from heartbeat senderDomain)',
            readOnly: true,
          },
        },
        // ── Commissioning (Sprint 42) ──────────────────────────────
        {
          name: 'commissionedAt',
          type: 'date',
          admin: {
            description: 'When this Endeavor was formally commissioned and activated in the federation',
            readOnly: true,
          },
        },
        {
          name: 'commissionedBy',
          type: 'text',
          admin: {
            description: 'Who performed the commissioning (e.g., "Archangel LEO", "Kenneth Courtney")',
            readOnly: true,
          },
        },
      ],
    },

    // ── Beneficiaries (Sprint 25) ──────────────────────────────────
    {
      name: 'beneficiaries',
      type: 'array',
      admin: {
        description:
          'People this Endeavor serves — may be pre-registered before they onboard. ' +
          'Each beneficiary gets a unique claim token. When they create an account and ' +
          'present the token, they are verified and linked.',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: { placeholder: 'e.g., "Ernesto Behrens"' },
        },
        {
          name: 'email',
          type: 'email',
          admin: {
            description: 'Contact email if known — used for matching during onboarding',
          },
        },
        {
          name: 'role',
          type: 'text',
          admin: {
            description: 'Their role in this Endeavor',
            placeholder: 'e.g., "Beneficiary", "Recipient", "Subject"',
          },
        },
        {
          name: 'description',
          type: 'textarea',
          admin: {
            description: 'Why this person is a beneficiary of this Endeavor',
            rows: 2,
          },
        },
        {
          name: 'claimToken',
          type: 'text',
          unique: true,
          admin: {
            description:
              'Unique verification token (UUID). Share with the beneficiary so they can ' +
              'claim their account when they onboard. Auto-generated on creation.',
            readOnly: true,
          },
        },
        {
          name: 'verificationStatus',
          type: 'select',
          defaultValue: 'pending',
          options: [
            { label: 'Pending', value: 'pending' },       // designated but not yet onboarded
            { label: 'Invited', value: 'invited' },        // invitation sent
            { label: 'Verified', value: 'verified' },      // onboarded and claimed
            { label: 'Declined', value: 'declined' },      // opted out
          ],
          admin: {
            description: 'Lifecycle: pending → invited → verified (or declined)',
          },
        },
        {
          name: 'linkedUser',
          type: 'relationship',
          relationTo: 'users',
          admin: {
            description: 'Linked user account — set when beneficiary onboards and verifies',
            readOnly: true,
          },
        },
        {
          name: 'verifiedAt',
          type: 'date',
          admin: {
            description: 'When the beneficiary verified their identity and linked their account',
            readOnly: true,
          },
        },
        {
          name: 'designatedAt',
          type: 'date',
          admin: {
            description: 'When this person was designated as a beneficiary',
            readOnly: true,
          },
        },
      ],
    },

    // ── Crew Configuration (Sprint 40) ────────────────────────────
    {
      name: 'crew',
      type: 'group',
      admin: {
        description:
          'Ship crew configuration — departments, command structure, watch rotation. ' +
          'The Endeavor is the ship; CrewAssignments are the duty roster.',
      },
      fields: [
        {
          name: 'activeDepartments',
          type: 'select',
          hasMany: true,
          options: [
            { label: 'Bridge (Command)', value: 'bridge' },
            { label: 'Engineering', value: 'engineering' },
            { label: 'Operations', value: 'operations' },
            { label: 'Science', value: 'science' },
            { label: 'Communications', value: 'communications' },
            { label: 'Medical', value: 'medical' },
            { label: 'Security', value: 'security' },
            { label: 'Logistics', value: 'logistics' },
          ],
          admin: {
            description: 'Which departments are active on this ship',
          },
        },
        {
          name: 'maxCrewSize',
          type: 'number',
          defaultValue: 0,
          admin: {
            description: 'Maximum crew complement (0 = unlimited)',
          },
        },
        {
          name: 'watchRotation',
          type: 'select',
          defaultValue: 'flexible',
          options: [
            { label: 'Fixed (assigned watches)', value: 'fixed' },
            { label: 'Rotating (auto-cycle)', value: 'rotating' },
            { label: 'Flexible (self-schedule)', value: 'flexible' },
          ],
          admin: {
            description: 'How watch/shift rotation is managed',
          },
        },
        {
          name: 'commandingOfficer',
          type: 'relationship',
          relationTo: 'crew-assignments' as any,
          admin: {
            description: 'The Captain — commanding officer of this vessel',
          },
        },
        {
          name: 'executiveOfficer',
          type: 'relationship',
          relationTo: 'crew-assignments' as any,
          admin: {
            description: 'First Officer — executive officer / second in command',
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
