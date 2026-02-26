import type { CollectionConfig } from 'payload'

import { checkRole } from '@/access/utilities'

/**
 * Tenants collection for multi-domain routing (Finly pattern).
 * Each tenant = one Angel/LEO for the Endeavor; exposes MCP interface.
 * Middleware injects x-tenant-id based on request hostname.
 * Visible in admin only to super_admin.
 */
export const Tenants: CollectionConfig = {
  slug: 'tenants',
  admin: {
    group: 'Angel OS',
    useAsTitle: 'name',
    defaultColumns: ['name', 'slug', 'domain', 'status'],
    hidden: ({ user }) => !(user && 'roles' in user && Array.isArray(user.roles) && user.roles.includes('super_admin')),
  },
  access: {
    read: () => true, // Public for hostname resolution
    create: ({ req: { user } }) => Boolean(checkRole(['super_admin'], user)),
    update: ({ req: { user } }) => Boolean(checkRole(['super_admin'], user)),
    delete: ({ req: { user } }) => Boolean(checkRole(['super_admin'], user)),
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      options: [
        { label: 'Platform', value: 'platform' },
        { label: 'Tenant', value: 'tenant' },
        { label: 'Ministry', value: 'ministry' },
      ],
      defaultValue: 'tenant',
      required: true,
      admin: {
        description: 'Platform tenant is the special singleton for Angel OS infrastructure',
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      label: 'Tenant Name',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Used in x-tenant-id header and URLs (e.g., hays-cactus)',
      },
    },
    {
      name: 'domain',
      type: 'text',
      required: true,
      admin: {
        description: 'Primary domain (e.g., hays-cactus.com). Used for hostname routing.',
      },
    },
    {
      name: 'domains',
      type: 'array',
      label: 'Additional Domains',
      admin: {
        description: 'Alias domains that resolve to this tenant',
      },
      fields: [
        {
          name: 'domain',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'active',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Provisioning', value: 'provisioning' },
      ],
    },
    {
      name: 'branding',
      type: 'group',
      admin: {
        description: 'Site branding (Zubricks-style)',
      },
      fields: [
        {
          name: 'logo',
          type: 'upload',
          relationTo: 'media',
        },
        {
          name: 'siteName',
          type: 'text',
        },
        {
          name: 'tagline',
          type: 'text',
        },
        {
          name: 'primaryColor',
          type: 'text',
          admin: { description: 'Hex (e.g. #10B981)', placeholder: '#10B981' },
        },
        {
          name: 'secondaryColor',
          type: 'text',
          admin: { placeholder: '#0078D4' },
        },
        {
          name: 'accentColor',
          type: 'text',
          admin: { placeholder: '#FF6B35' },
        },
        {
          name: 'backgroundColor',
          type: 'text',
          admin: { placeholder: '#FFFFFF' },
        },
        {
          name: 'foregroundColor',
          type: 'text',
          admin: { placeholder: '#1A1A1A' },
        },
        {
          name: 'borderColor',
          type: 'text',
          admin: { placeholder: '#E5E7EB' },
        },
        {
          name: 'headingFont',
          type: 'select',
          defaultValue: 'inter',
          options: [
            { label: 'Inter', value: 'inter' },
            { label: 'Playfair Display', value: 'playfair-display' },
            { label: 'Montserrat', value: 'montserrat' },
            { label: 'Raleway', value: 'raleway' },
            { label: 'Poppins', value: 'poppins' },
          ],
        },
        {
          name: 'bodyFont',
          type: 'select',
          defaultValue: 'inter',
          options: [
            { label: 'Inter', value: 'inter' },
            { label: 'Open Sans', value: 'open-sans' },
            { label: 'Lato', value: 'lato' },
            { label: 'Roboto', value: 'roboto' },
            { label: 'Source Sans 3', value: 'source-sans-3' },
          ],
        },
      ],
    },
    // ─── Storefront Configuration (Sprint 6) ────────────────────
    {
      name: 'businessType',
      type: 'select',
      admin: {
        description: 'What kind of endeavor is this tenant?',
      },
      options: [
        { label: 'Retail / E-Commerce', value: 'retail' },
        { label: 'Service Business', value: 'service' },
        { label: 'Content Creator', value: 'content_creator' },
        { label: 'Nonprofit / Ministry', value: 'nonprofit' },
        { label: 'Professional Services', value: 'professional_services' },
        { label: 'Custom / Other', value: 'custom' },
      ],
    },
    {
      name: 'storefront',
      type: 'group',
      admin: {
        description: 'Public-facing storefront configuration',
      },
      fields: [
        {
          name: 'description',
          type: 'textarea',
          admin: { description: 'A short description of the business (shown on storefront)' },
        },
        {
          name: 'coverImage',
          type: 'upload',
          relationTo: 'media',
          admin: { description: 'Hero/cover image for the storefront' },
        },
        {
          name: 'contactEmail',
          type: 'email',
        },
        {
          name: 'contactPhone',
          type: 'text',
        },
        {
          name: 'socialLinks',
          type: 'array',
          admin: { description: 'Social media links' },
          fields: [
            {
              name: 'platform',
              type: 'select',
              required: true,
              options: [
                { label: 'Facebook', value: 'facebook' },
                { label: 'Instagram', value: 'instagram' },
                { label: 'Twitter / X', value: 'twitter' },
                { label: 'YouTube', value: 'youtube' },
                { label: 'TikTok', value: 'tiktok' },
                { label: 'LinkedIn', value: 'linkedin' },
                { label: 'Website', value: 'website' },
              ],
            },
            {
              name: 'url',
              type: 'text',
              required: true,
            },
          ],
        },
        {
          name: 'businessHours',
          type: 'array',
          admin: { description: 'Weekly business hours' },
          fields: [
            {
              name: 'day',
              type: 'select',
              required: true,
              options: [
                { label: 'Monday', value: 'monday' },
                { label: 'Tuesday', value: 'tuesday' },
                { label: 'Wednesday', value: 'wednesday' },
                { label: 'Thursday', value: 'thursday' },
                { label: 'Friday', value: 'friday' },
                { label: 'Saturday', value: 'saturday' },
                { label: 'Sunday', value: 'sunday' },
              ],
            },
            {
              name: 'open',
              type: 'text',
              required: true,
              admin: { placeholder: '09:00', description: '24-hour format (e.g. 09:00)' },
            },
            {
              name: 'close',
              type: 'text',
              required: true,
              admin: { placeholder: '17:00', description: '24-hour format (e.g. 17:00)' },
            },
          ],
        },
      ],
    },
    // ─── Commerce Configuration (Sprint 6) ──────────────────────
    {
      name: 'commerce',
      type: 'group',
      admin: {
        description: 'Commerce settings for this tenant',
      },
      fields: [
        {
          name: 'currency',
          type: 'select',
          defaultValue: 'usd',
          options: [
            { label: 'USD ($)', value: 'usd' },
            { label: 'CAD (C$)', value: 'cad' },
            { label: 'EUR (\u20AC)', value: 'eur' },
            { label: 'GBP (\u00A3)', value: 'gbp' },
            { label: 'AUD (A$)', value: 'aud' },
          ],
        },
        {
          name: 'taxRate',
          type: 'number',
          admin: { description: 'Tax rate as percentage (e.g. 8.25 for 8.25%)' },
          min: 0,
          max: 100,
        },
        {
          name: 'shippingEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Enable physical product shipping' },
        },
        {
          name: 'bookingsEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Enable appointment/service bookings' },
        },
        {
          name: 'eventsEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Enable event management and registration' },
        },
        {
          name: 'digitalProductsEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Enable digital product delivery' },
        },
        {
          name: 'isTaxExempt',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Tax-exempt organization (e.g. 501(c)(3) ministry, nonprofit)' },
        },
        {
          name: 'taxExemptId',
          type: 'text',
          admin: {
            description: 'Tax exemption ID / EIN',
            condition: (_, siblingData) => siblingData?.isTaxExempt === true,
          },
        },
      ],
    },
    // ─── Stripe Connect (Sprint 6) ──────────────────────────────
    {
      name: 'stripeConnect',
      type: 'group',
      admin: {
        description: 'Stripe Connect account for receiving payments',
      },
      fields: [
        {
          name: 'stripeAccountId',
          type: 'text',
          admin: { description: 'Stripe Connected Account ID (acct_xxx)', readOnly: true },
        },
        {
          name: 'stripeOnboardingComplete',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Whether Stripe onboarding is complete', readOnly: true },
        },
        {
          name: 'stripePayoutsEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Whether Stripe payouts are enabled', readOnly: true },
        },
        {
          name: 'stripeChargesEnabled',
          type: 'checkbox',
          defaultValue: false,
          admin: { description: 'Whether Stripe charges are enabled', readOnly: true },
        },
        {
          name: 'connectedAt',
          type: 'date',
          admin: { readOnly: true },
        },
      ],
    },
    // ─── AI Configuration (Sprint 6) ────────────────────────────
    {
      name: 'aiConfig',
      type: 'group',
      admin: {
        description: 'Bring-your-own AI keys for LEO and image generation',
      },
      fields: [
        {
          name: 'anthropicApiKey',
          type: 'text',
          admin: {
            description: 'Anthropic API key (encrypted at rest). Leave blank to use platform key.',
          },
        },
        {
          name: 'openrouterApiKey',
          type: 'text',
          admin: {
            description: 'OpenRouter API key (encrypted at rest). Leave blank to use platform key.',
          },
        },
      ],
    },
    // ─── Vapi Voice AI (Sprint 19) ─────────────────────────────────
    {
      name: 'vapi',
      type: 'group',
      admin: {
        description: 'Vapi Voice AI configuration — phone-based LEO access for this Enterprise',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Enable Vapi voice AI for this tenant',
          },
        },
        {
          name: 'phoneNumber',
          type: 'text',
          admin: {
            description:
              'Vapi phone number assigned to this tenant (E.164 format, e.g. +17274408797). Used to route inbound calls to the correct Enterprise.',
            condition: (_, siblingData) => siblingData?.enabled === true,
          },
        },
        {
          name: 'assistantId',
          type: 'text',
          admin: {
            description:
              'Optional: Vapi Assistant ID override. If blank, the default LEO voice config is used.',
            condition: (_, siblingData) => siblingData?.enabled === true,
          },
        },
        {
          name: 'voiceId',
          type: 'text',
          admin: {
            description:
              'Optional: ElevenLabs voice ID override. Default: Adam (pNInz6obpgDQGcFmaJgB)',
            condition: (_, siblingData) => siblingData?.enabled === true,
          },
        },
        {
          name: 'greeting',
          type: 'textarea',
          admin: {
            description:
              'Custom first message when the phone is answered. Leave blank for default LEO greeting.',
            condition: (_, siblingData) => siblingData?.enabled === true,
          },
        },
      ],
    },
    // ─── Agent Wallet (Federation Sprint) ──────────────────────────
    {
      name: 'agentWallet',
      type: 'group',
      admin: {
        description: 'LEO agent wallet for federation skill spending/earning. Structural guardrails the agent CANNOT override.',
      },
      fields: [
        {
          name: 'enabled',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Enable the agent wallet for federation commerce',
          },
        },
        {
          name: 'monthlyBudgetCents',
          type: 'number',
          defaultValue: 0,
          admin: {
            description: 'Monthly spending budget in cents (e.g., 10000 = $100.00)',
          },
        },
        {
          name: 'spentThisMonthCents',
          type: 'number',
          defaultValue: 0,
          admin: {
            description: 'Amount spent this month in cents (auto-tracked)',
            readOnly: true,
          },
        },
        {
          name: 'lifetimeSpentCents',
          type: 'number',
          defaultValue: 0,
          admin: {
            description: 'Total lifetime spending in cents (auto-tracked)',
            readOnly: true,
          },
        },
        {
          name: 'lifetimeEarnedCents',
          type: 'number',
          defaultValue: 0,
          admin: {
            description: 'Total lifetime earnings from federation skills in cents (auto-tracked)',
            readOnly: true,
          },
        },
        {
          name: 'lastResetAt',
          type: 'date',
          admin: {
            description: 'When the monthly budget was last reset',
            readOnly: true,
          },
        },
        {
          name: 'spendingRules',
          type: 'json',
          admin: {
            description: 'Structural spending guardrails: { maxPerTransactionCents, maxDailySpendCents, allowedCategories, humanApprovalThresholdCents }. The agent CANNOT modify these.',
          },
        },
      ],
    },
    // ─── Enterprise Setup / Leo Wizard (Sprint 17) ─────────────────
    {
      name: 'setup',
      type: 'group',
      admin: {
        description: 'Leo Wizard progress and federation identity for this Enterprise',
      },
      fields: [
        {
          name: 'wizardComplete',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'Set to true when the Leo Wizard (Enterprise Setup) has been completed. Hides the "Enterprise Setup" nav link.',
          },
        },
        {
          name: 'wizardProgress',
          type: 'json',
          admin: {
            description:
              'Persisted wizard state — current step, completed steps, and encrypted Ed25519 key pair. Managed by Leo Wizard actions.',
          },
        },
        {
          name: 'constitutionSignedAt',
          type: 'date',
          admin: {
            description: 'When the operator signed the Angel OS Constitution (set by Leo Wizard step 7)',
            readOnly: true,
          },
        },
        {
          name: 'constitutionSignature',
          type: 'text',
          admin: {
            description:
              'Ed25519 signature of the constitution signing event (hex-encoded). Set by Leo Wizard step 7.',
            readOnly: true,
          },
        },
        {
          name: 'federationId',
          type: 'text',
          admin: {
            description:
              "The Enterprise's immutable UUID in the Angel OS federation network. Assigned at constitution signing.",
            readOnly: true,
          },
        },
      ],
    },
    // ─── Bootstrap-Phase Platform Fees ────────────────────────────
    // All tenants start with free access. After the free tier threshold,
    // a platform fee kicks in. ALL fees collected during bootstrap are
    // tracked with a binding refund promise — when the bootstrap phase
    // ends, every cent is returned. Goal: cover expenses + maximize
    // startup capital while keeping the constitutional promise of fairness.
    {
      name: 'bootstrapFees',
      type: 'group',
      admin: {
        description:
          'Bootstrap-phase platform fee tracking. Fees collected during bootstrap are promised for full refund when the phase ends.',
      },
      fields: [
        {
          name: 'tier',
          type: 'select',
          defaultValue: 'free',
          options: [
            { label: 'Free (within free tier)', value: 'free' },
            { label: 'Bootstrap (fee active, refund promised)', value: 'bootstrap' },
            { label: 'Standard (post-bootstrap, UltimateFairSplit)', value: 'standard' },
          ],
          admin: {
            description: 'Current fee tier. Transitions: free → bootstrap → standard.',
          },
        },
        {
          name: 'freeTransactionsUsed',
          type: 'number',
          defaultValue: 0,
          admin: {
            description:
              'Number of fee-free transactions used. After threshold, tier auto-promotes to bootstrap.',
            readOnly: true,
          },
        },
        {
          name: 'freeTransactionLimit',
          type: 'number',
          defaultValue: 50,
          admin: {
            description:
              'Maximum number of free transactions before bootstrap fee kicks in.',
          },
        },
        {
          name: 'freeGmvCents',
          type: 'number',
          defaultValue: 0,
          admin: {
            description:
              'Gross Merchandise Value processed for free (in cents). Auto-tracked.',
            readOnly: true,
          },
        },
        {
          name: 'freeGmvLimitCents',
          type: 'number',
          defaultValue: 500000,
          admin: {
            description:
              'GMV ceiling before bootstrap fee activates (in cents). Default: $5,000.',
          },
        },
        {
          name: 'bootstrapFeePercent',
          type: 'number',
          defaultValue: 5,
          min: 0,
          max: 15,
          admin: {
            description:
              'Bootstrap-phase fee as percentage of transaction (default: 5%). Added on top of standard split.',
          },
        },
        {
          name: 'totalFeesCollectedCents',
          type: 'number',
          defaultValue: 0,
          admin: {
            description:
              'Total bootstrap fees collected to date (in cents). This is the refund liability.',
            readOnly: true,
          },
        },
        {
          name: 'refundPromised',
          type: 'checkbox',
          defaultValue: true,
          admin: {
            description:
              'Binding commitment: all bootstrap fees will be fully refunded when the bootstrap phase ends.',
            readOnly: true,
          },
        },
        {
          name: 'refundStatus',
          type: 'select',
          defaultValue: 'accruing',
          options: [
            { label: 'Accruing (fees being collected)', value: 'accruing' },
            { label: 'Refund Processing', value: 'processing' },
            { label: 'Refund Complete', value: 'completed' },
            { label: 'Waived (tenant opted out of refund)', value: 'waived' },
          ],
          admin: {
            description: 'Status of the bootstrap fee refund promise.',
          },
        },
        {
          name: 'bootstrapStartedAt',
          type: 'date',
          admin: {
            description: 'When the tenant entered bootstrap fee tier.',
            readOnly: true,
          },
        },
        {
          name: 'bootstrapEndedAt',
          type: 'date',
          admin: {
            description: 'When the bootstrap phase ended for this tenant.',
            readOnly: true,
          },
        },
      ],
    },
  ],
}
