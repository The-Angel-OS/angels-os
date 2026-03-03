/**
 * form-schemas — Unit Tests
 *
 * Zod schema validation: tenantProvisionSchema, spaceCreationSchema,
 * paymentRequestSchema, inventoryUpdateSchema, contactFormSchema,
 * karmaInviteSchema, voicePromptFormSchema, productCreationSchema
 */
import { describe, it, expect } from 'vitest'

import {
  tenantProvisionSchema,
  spaceCreationSchema,
  paymentRequestSchema,
  inventoryUpdateSchema,
  contactFormSchema,
  karmaInviteSchema,
  voicePromptFormSchema,
  productCreationSchema,
} from '@/utilities/form-schemas'

// ── tenantProvisionSchema ──────────────────────────────────────────────────────

describe('tenantProvisionSchema', () => {
  const valid = {
    name: 'Acme Corp',
    businessType: 'service' as const,
  }

  it('accepts a minimal valid object', () => {
    const result = tenantProvisionSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rejects name shorter than 2 characters', () => {
    const result = tenantProvisionSchema.safeParse({ ...valid, name: 'A' })
    expect(result.success).toBe(false)
  })

  it('rejects name longer than 50 characters', () => {
    const result = tenantProvisionSchema.safeParse({ ...valid, name: 'A'.repeat(51) })
    expect(result.success).toBe(false)
  })

  it('rejects invalid businessType', () => {
    const result = tenantProvisionSchema.safeParse({ ...valid, businessType: 'invalid' })
    expect(result.success).toBe(false)
  })

  it('applies theme default of "business"', () => {
    const result = tenantProvisionSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.theme).toBe('business')
  })

  it('applies features default', () => {
    const result = tenantProvisionSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(Array.isArray(result.data.features)).toBe(true)
  })

  it('rejects slug with uppercase letters', () => {
    const result = tenantProvisionSchema.safeParse({ ...valid, slug: 'MySlug' })
    expect(result.success).toBe(false)
  })

  it('accepts slug with lowercase letters, numbers, hyphens', () => {
    const result = tenantProvisionSchema.safeParse({ ...valid, slug: 'my-slug-123' })
    expect(result.success).toBe(true)
  })
})

// ── spaceCreationSchema ────────────────────────────────────────────────────────

describe('spaceCreationSchema', () => {
  const valid = {
    name: 'My Space',
    businessType: 'ecommerce' as const,
    features: { ecommerce: true, booking: false, blog: true, crm: false, analytics: true },
    branding: { primaryColor: '#123456', secondaryColor: '#ABCDEF' },
  }

  it('accepts a valid object', () => {
    const result = spaceCreationSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rejects invalid hex color', () => {
    const result = spaceCreationSchema.safeParse({
      ...valid,
      branding: { ...valid.branding, primaryColor: 'notacolor' },
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid businessType', () => {
    const result = spaceCreationSchema.safeParse({ ...valid, businessType: 'unknown' })
    expect(result.success).toBe(false)
  })

  it('rejects name shorter than 2 characters', () => {
    const result = spaceCreationSchema.safeParse({ ...valid, name: 'X' })
    expect(result.success).toBe(false)
  })
})

// ── paymentRequestSchema ───────────────────────────────────────────────────────

describe('paymentRequestSchema', () => {
  const valid = {
    amount: 49.99,
    recipient: 'user@example.com',
    description: 'Invoice for services rendered',
  }

  it('accepts a valid payment request', () => {
    const result = paymentRequestSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('defaults currency to USD', () => {
    const result = paymentRequestSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.currency).toBe('USD')
  })

  it('rejects negative amount', () => {
    const result = paymentRequestSchema.safeParse({ ...valid, amount: -10 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email recipient', () => {
    const result = paymentRequestSchema.safeParse({ ...valid, recipient: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects description shorter than 5 characters', () => {
    const result = paymentRequestSchema.safeParse({ ...valid, description: 'Hi' })
    expect(result.success).toBe(false)
  })
})

// ── inventoryUpdateSchema ──────────────────────────────────────────────────────

describe('inventoryUpdateSchema', () => {
  const valid = {
    items: [
      {
        productId: 'prod_1',
        name: 'Widget',
        currentCount: 10,
        adjustedCount: 8,
        reason: 'sale' as const,
      },
    ],
  }

  it('accepts a valid inventory update', () => {
    const result = inventoryUpdateSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('defaults analyzedBy to "human"', () => {
    const result = inventoryUpdateSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.analyzedBy).toBe('human')
  })

  it('rejects negative currentCount', () => {
    const result = inventoryUpdateSchema.safeParse({
      items: [{ ...valid.items[0], currentCount: -1 }],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid reason', () => {
    const result = inventoryUpdateSchema.safeParse({
      items: [{ ...valid.items[0], reason: 'lost' }],
    })
    expect(result.success).toBe(false)
  })
})

// ── contactFormSchema ──────────────────────────────────────────────────────────

describe('contactFormSchema', () => {
  const valid = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    message: 'Hello, I am interested in your services!',
  }

  it('accepts a valid contact form', () => {
    const result = contactFormSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rejects empty firstName', () => {
    const result = contactFormSchema.safeParse({ ...valid, firstName: '' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = contactFormSchema.safeParse({ ...valid, email: 'not-email' })
    expect(result.success).toBe(false)
  })

  it('rejects message shorter than 10 characters', () => {
    const result = contactFormSchema.safeParse({ ...valid, message: 'Short' })
    expect(result.success).toBe(false)
  })

  it('defaults source to "website"', () => {
    const result = contactFormSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.source).toBe('website')
  })
})

// ── karmaInviteSchema ──────────────────────────────────────────────────────────

describe('karmaInviteSchema', () => {
  const valid = {
    inviterEmail: 'alice@example.com',
    inviteeEmail: 'bob@example.com',
  }

  it('accepts a valid karma invite', () => {
    const result = karmaInviteSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('defaults referralLevels to 3', () => {
    const result = karmaInviteSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.referralLevels).toBe(3)
  })

  it('defaults bonusPoints to 100', () => {
    const result = karmaInviteSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.bonusPoints).toBe(100)
  })

  it('rejects referralLevels above 5', () => {
    const result = karmaInviteSchema.safeParse({ ...valid, referralLevels: 6 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid invitee email', () => {
    const result = karmaInviteSchema.safeParse({ ...valid, inviteeEmail: 'notvalid' })
    expect(result.success).toBe(false)
  })
})

// ── productCreationSchema ──────────────────────────────────────────────────────

describe('productCreationSchema', () => {
  const valid = {
    name: 'Cool Widget',
    description: 'A very cool widget for all your needs',
    price: 29.99,
    category: 'accessories',
    images: ['https://example.com/img.jpg'],
  }

  it('accepts a valid product', () => {
    const result = productCreationSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it('rejects when no images are provided', () => {
    const result = productCreationSchema.safeParse({ ...valid, images: [] })
    expect(result.success).toBe(false)
  })

  it('rejects negative price', () => {
    const result = productCreationSchema.safeParse({ ...valid, price: -5 })
    expect(result.success).toBe(false)
  })

  it('rejects short description', () => {
    const result = productCreationSchema.safeParse({ ...valid, description: 'Short' })
    expect(result.success).toBe(false)
  })

  it('rejects non-URL image', () => {
    const result = productCreationSchema.safeParse({ ...valid, images: ['not-a-url'] })
    expect(result.success).toBe(false)
  })
})
