/**
 * Sprint 6 — Commerce Engine Tests
 *
 * Tests for the Sprint 6 deliverables:
 * - Stripe Connect configuration & fee calculation
 * - Justice Fund transaction recording
 * - Invitation email generation
 * - Tenant storefront configuration
 * - BYOAI key resolution
 * - Business setup tool
 * - Error boundary and empty state patterns
 *
 * @see docs/planning/SPRINT_NEXT_COMMERCE_ENGINE.md
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// 1. Stripe Connect Fee Calculation
// ---------------------------------------------------------------------------

import {
  calculateUltimateFairSplit,
  getPlatformApplicationFeePercent,
  ULTIMATE_FAIR_SPLIT,
} from '@/lib/ultimate-fair-split'

import { getStripeApplicationFeeCents } from '@/lib/stripe-connect-config'

describe('Stripe Connect Fee Calculation', () => {
  describe('getStripeApplicationFeeCents (deprecated path)', () => {
    // These once asserted 40% and PASSED, while the code fed that 40% straight
    // into Stripe application_fee_amount on real deposits. Live callers now read
    // the configured rate; this helper is kept only so stragglers are findable.
    it('reports the default 5%, not the 40% it used to charge', () => {
      expect(getStripeApplicationFeeCents(10000)).toBe(500)
      expect(getStripeApplicationFeeCents(100)).toBe(5)
    })

    it('returns 0 for $0', () => {
      expect(getStripeApplicationFeeCents(0)).toBe(0)
    })

    it('rounds to the nearest cent', () => {
      expect(getStripeApplicationFeeCents(333)).toBe(17) // 5% of 333 = 16.65
    })

    it('agrees with getPlatformApplicationFeePercent', () => {
      expect(getPlatformApplicationFeePercent()).toBeCloseTo(0.05, 10)
    })
  })

  describe('calculateUltimateFairSplit', () => {
    it('splits $100 between the provider and the platform', () => {
      const splits = calculateUltimateFairSplit(10000)
      expect(splits).toHaveLength(2)
      expect(splits.find((s) => s.recipient === 'PROVIDER')?.amount).toBe(9500)
      expect(splits.find((s) => s.recipient === 'PLATFORM')?.amount).toBe(500)
    })

    it('all splits sum to the original amount exactly', () => {
      const amount = 9999
      const splits = calculateUltimateFairSplit(amount)
      expect(splits.reduce((acc, s) => acc + s.amount, 0)).toBe(amount)
    })

    it('includes percentage metadata', () => {
      const splits = calculateUltimateFairSplit(10000)
      expect(splits.find((s) => s.recipient === 'PLATFORM')?.percentage).toBe(0.05)
    })
  })

  describe('ULTIMATE_FAIR_SPLIT constants', () => {
    it('sums to 100%', () => {
      expect(ULTIMATE_FAIR_SPLIT.PROVIDER + ULTIMATE_FAIR_SPLIT.PLATFORM).toBeCloseTo(1, 10)
    })

    it('provider gets 95%', () => {
      expect(ULTIMATE_FAIR_SPLIT.PROVIDER).toBeCloseTo(0.95, 10)
    })

    it('platform gets 5%', () => {
      expect(ULTIMATE_FAIR_SPLIT.PLATFORM).toBeCloseTo(0.05, 10)
    })
  })
})

// ---------------------------------------------------------------------------
// 2. Invitation Email Generation
// ---------------------------------------------------------------------------

describe('Invitation Email Utility', () => {
  // We test the utility function signature and template structure
  it('sendInvitationEmail module exists', async () => {
    const mod = await import('@/utilities/sendInvitationEmail')
    expect(mod.sendInvitationEmail).toBeDefined()
    expect(typeof mod.sendInvitationEmail).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// 3. Invitation System (existing tests extended)
// ---------------------------------------------------------------------------

import {
  generateInvitationToken,
  calculateExpiration,
  isValidEmail,
  maskEmail,
  generateInviteUrl,
  DEFAULT_EXPIRY_DAYS,
  INVITABLE_ROLES,
  INVITE_CAPABLE_ROLES,
} from '@/utilities/invitationSystem'

describe('Invitation System — Sprint 6 Extensions', () => {
  describe('generateInviteUrl', () => {
    it('generates URL with base', () => {
      const url = generateInviteUrl('abc123', 'https://example.com')
      expect(url).toBe('https://example.com/invite/abc123')
    })

    it('generates URL without base (relative)', () => {
      const url = generateInviteUrl('abc123')
      expect(url).toBe('/invite/abc123')
    })
  })

  describe('maskEmail', () => {
    it('masks middle characters', () => {
      expect(maskEmail('john@example.com')).toBe('j**n@example.com')
    })

    it('handles short local part', () => {
      expect(maskEmail('jo@example.com')).toBe('j*@example.com')
    })
  })

  describe('INVITABLE_ROLES', () => {
    it('includes member, moderator, guest', () => {
      expect(INVITABLE_ROLES).toContain('member')
      expect(INVITABLE_ROLES).toContain('moderator')
      expect(INVITABLE_ROLES).toContain('guest')
    })

    it('does NOT include space_admin', () => {
      expect(INVITABLE_ROLES).not.toContain('space_admin')
    })
  })

  describe('INVITE_CAPABLE_ROLES', () => {
    it('includes space_admin and moderator', () => {
      expect(INVITE_CAPABLE_ROLES).toContain('space_admin')
      expect(INVITE_CAPABLE_ROLES).toContain('moderator')
    })
  })
})

// ---------------------------------------------------------------------------
// 4. Tenant Schema Validation (Storefront, Commerce, StripeConnect, AI)
// ---------------------------------------------------------------------------

describe('Tenant Collection Schema — Sprint 6 Fields', () => {
  // Import the collection config
  let TenantFields: any[]

  beforeEach(async () => {
    const mod = await import('@/collections/Tenants/index')
    TenantFields = mod.Tenants.fields as any[]
  })

  it('has businessType select field', () => {
    const field = TenantFields.find((f: any) => f.name === 'businessType')
    expect(field).toBeDefined()
    expect(field.type).toBe('select')
    expect(field.options.length).toBeGreaterThanOrEqual(6)
    expect(field.options.map((o: any) => o.value)).toContain('retail')
    expect(field.options.map((o: any) => o.value)).toContain('service')
    expect(field.options.map((o: any) => o.value)).toContain('nonprofit')
    expect(field.options.map((o: any) => o.value)).toContain('gift_shop')
    expect(field.options.map((o: any) => o.value)).toContain('ministry')
  })

  it('has storefront group with description, coverImage, contact, social, hours', () => {
    const field = TenantFields.find((f: any) => f.name === 'storefront')
    expect(field).toBeDefined()
    expect(field.type).toBe('group')
    const subFields = field.fields.map((f: any) => f.name)
    expect(subFields).toContain('description')
    expect(subFields).toContain('coverImage')
    expect(subFields).toContain('contactEmail')
    expect(subFields).toContain('contactPhone')
    expect(subFields).toContain('socialLinks')
    expect(subFields).toContain('businessHours')
  })

  it('has commerce group with currency, tax, and feature toggles', () => {
    const field = TenantFields.find((f: any) => f.name === 'commerce')
    expect(field).toBeDefined()
    expect(field.type).toBe('group')
    const subFields = field.fields.map((f: any) => f.name)
    expect(subFields).toContain('currency')
    expect(subFields).toContain('taxRate')
    expect(subFields).toContain('shippingEnabled')
    expect(subFields).toContain('bookingsEnabled')
    expect(subFields).toContain('eventsEnabled')
    expect(subFields).toContain('digitalProductsEnabled')
  })

  it('has stripeConnect group with account fields', () => {
    const field = TenantFields.find((f: any) => f.name === 'stripeConnect')
    expect(field).toBeDefined()
    expect(field.type).toBe('group')
    const subFields = field.fields.map((f: any) => f.name)
    expect(subFields).toContain('stripeAccountId')
    expect(subFields).toContain('stripeOnboardingComplete')
    expect(subFields).toContain('stripePayoutsEnabled')
    expect(subFields).toContain('stripeChargesEnabled')
    expect(subFields).toContain('connectedAt')
  })

  it('has aiConfig group with API keys', () => {
    const field = TenantFields.find((f: any) => f.name === 'aiConfig')
    expect(field).toBeDefined()
    expect(field.type).toBe('group')
    const subFields = field.fields.map((f: any) => f.name)
    expect(subFields).toContain('anthropicApiKey')
    expect(subFields).toContain('openrouterApiKey')
  })

  it('retains existing branding group', () => {
    const field = TenantFields.find((f: any) => f.name === 'branding')
    expect(field).toBeDefined()
    expect(field.type).toBe('group')
    const subFields = field.fields.map((f: any) => f.name)
    expect(subFields).toContain('logo')
    expect(subFields).toContain('primaryColor')
    expect(subFields).toContain('headingFont')
  })
})

// ---------------------------------------------------------------------------
// 5. Justice Fund Transactions Collection
// ---------------------------------------------------------------------------

describe('Justice Fund Transactions Collection', () => {
  it('has correct slug', async () => {
    const mod = await import('@/collections/JusticeFundTransactions/index')
    expect(mod.JusticeFundTransactions.slug).toBe('justice-fund-transactions')
  })

  it('has type, amountCents, status, and processedAt fields', async () => {
    const mod = await import('@/collections/JusticeFundTransactions/index')
    const fields = mod.JusticeFundTransactions.fields as any[]
    const fieldNames = fields.map((f: any) => f.name)

    expect(fieldNames).toContain('type')
    expect(fieldNames).toContain('amountCents')
    expect(fieldNames).toContain('status')
    expect(fieldNames).toContain('processedAt')
    expect(fieldNames).toContain('sourcePaymentIntentId')
    expect(fieldNames).toContain('percentage')
  })

  it('type field has allocation and disbursement options', async () => {
    const mod = await import('@/collections/JusticeFundTransactions/index')
    const typeField = (mod.JusticeFundTransactions.fields as any[]).find(
      (f: any) => f.name === 'type',
    )
    const values = typeField.options.map((o: any) => o.value)
    expect(values).toContain('allocation')
    expect(values).toContain('disbursement')
  })
})

// ---------------------------------------------------------------------------
// 6. LEO Business Setup Tool Definitions
// ---------------------------------------------------------------------------

describe('LEO Sprint 6 Tool Definitions', () => {
  it('includes configure_business tool', async () => {
    const mod = await import('@/utilities/leo-data-tools')
    const tool = mod.LEO_TOOLS.find((t: any) => t.name === 'configure_business')
    expect(tool).toBeDefined()
    expect(tool?.input_schema.properties).toHaveProperty('businessType')
    expect(tool?.input_schema.properties).toHaveProperty('businessName')
    expect(tool?.input_schema.properties).toHaveProperty('bookingsEnabled')
    // businessType is no longer required — partial updates are supported
    expect(tool?.input_schema.required).toEqual([])
  })

  it('includes connect_stripe_account tool', async () => {
    const mod = await import('@/utilities/leo-data-tools')
    const tool = mod.LEO_TOOLS.find((t: any) => t.name === 'connect_stripe_account')
    expect(tool).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// 7. BYOAI Key Support
// ---------------------------------------------------------------------------

describe('BYOAI Key Support', () => {
  it('isImageGenerationAvailable accepts optional tenant key', async () => {
    const mod = await import('@/utilities/imageGeneration')
    // With no env key and no tenant key → false
    const origKey = process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_API_KEY
    expect(mod.isImageGenerationAvailable()).toBe(false)
    // With tenant key → true
    expect(mod.isImageGenerationAvailable('sk-tenant-key')).toBe(true)
    // Restore
    if (origKey) process.env.OPENROUTER_API_KEY = origKey
  })
})

// ---------------------------------------------------------------------------
// 8. Stripe Connect Config
// ---------------------------------------------------------------------------

describe('Stripe Connect Config', () => {
  it('STRIPE_CONNECT_MODE is direct', async () => {
    const mod = await import('@/lib/stripe-connect-config')
    expect(mod.STRIPE_CONNECT_MODE).toBe('direct')
  })

  it('getStripeApplicationFeeCents is exported', async () => {
    const mod = await import('@/lib/stripe-connect-config')
    expect(typeof mod.getStripeApplicationFeeCents).toBe('function')
  })
})
