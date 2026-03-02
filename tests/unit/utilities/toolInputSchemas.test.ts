import { describe, it, expect } from 'vitest'
import {
  sendEmailSchema,
  sendWhatsAppSchema,
  sendTelegramSchema,
  sendSmsSchema,
  createProductSchema,
  updateProductSchema,
  createBookingSchema,
  createPostSchema,
  validateToolInput,
} from '@/utilities/toolInputSchemas'

// ─── send_email ──────────────────────────────────────────────

describe('sendEmailSchema', () => {
  it('accepts valid input', () => {
    const result = sendEmailSchema.safeParse({
      to: 'user@example.com',
      subject: 'Hello',
      body: 'World',
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional replyTo', () => {
    const result = sendEmailSchema.safeParse({
      to: 'user@example.com',
      subject: 'Hello',
      body: 'World',
      replyTo: 'reply@example.com',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing to', () => {
    const result = sendEmailSchema.safeParse({ subject: 'Hello', body: 'World' })
    expect(result.success).toBe(false)
  })

  it('rejects empty subject', () => {
    const result = sendEmailSchema.safeParse({ to: 'x@y.com', subject: '', body: 'Hi' })
    expect(result.success).toBe(false)
  })

  it('rejects missing body', () => {
    const result = sendEmailSchema.safeParse({ to: 'x@y.com', subject: 'Hi' })
    expect(result.success).toBe(false)
  })
})

// ─── send_whatsapp ───────────────────────────────────────────

describe('sendWhatsAppSchema', () => {
  it('accepts text message', () => {
    const result = sendWhatsAppSchema.safeParse({ to: '15551234567', text: 'Hello' })
    expect(result.success).toBe(true)
  })

  it('accepts template message', () => {
    const result = sendWhatsAppSchema.safeParse({
      to: '15551234567',
      templateName: 'welcome',
      templateParameters: ['John'],
    })
    expect(result.success).toBe(true)
  })

  it('accepts both text and template', () => {
    const result = sendWhatsAppSchema.safeParse({
      to: '15551234567',
      text: 'Hi',
      templateName: 'welcome',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing to', () => {
    const result = sendWhatsAppSchema.safeParse({ text: 'Hello' })
    expect(result.success).toBe(false)
  })

  it('rejects missing both text and templateName', () => {
    const result = sendWhatsAppSchema.safeParse({ to: '15551234567' })
    expect(result.success).toBe(false)
  })
})

// ─── send_telegram ───────────────────────────────────────────

describe('sendTelegramSchema', () => {
  it('accepts valid input', () => {
    const result = sendTelegramSchema.safeParse({ chatId: '123456', text: 'Hello' })
    expect(result.success).toBe(true)
  })

  it('rejects missing chatId', () => {
    const result = sendTelegramSchema.safeParse({ text: 'Hello' })
    expect(result.success).toBe(false)
  })

  it('rejects empty text', () => {
    const result = sendTelegramSchema.safeParse({ chatId: '123', text: '' })
    expect(result.success).toBe(false)
  })
})

// ─── send_sms ────────────────────────────────────────────────

describe('sendSmsSchema', () => {
  it('accepts valid input', () => {
    const result = sendSmsSchema.safeParse({ to: '+15551234567', body: 'Hello' })
    expect(result.success).toBe(true)
  })

  it('rejects missing to', () => {
    const result = sendSmsSchema.safeParse({ body: 'Hello' })
    expect(result.success).toBe(false)
  })

  it('rejects body over 1600 chars', () => {
    const result = sendSmsSchema.safeParse({ to: '+1555', body: 'a'.repeat(1601) })
    expect(result.success).toBe(false)
  })

  it('accepts body at exactly 1600 chars', () => {
    const result = sendSmsSchema.safeParse({ to: '+1555', body: 'a'.repeat(1600) })
    expect(result.success).toBe(true)
  })
})

// ─── create_product ──────────────────────────────────────────

describe('createProductSchema', () => {
  it('accepts minimal valid input', () => {
    const result = createProductSchema.safeParse({ title: 'Widget', price: 9.99 })
    expect(result.success).toBe(true)
  })

  it('accepts full valid input', () => {
    const result = createProductSchema.safeParse({
      title: 'Widget',
      price: 9.99,
      description: 'A great widget',
      category: 'Electronics',
      inventory: 50,
      status: 'published',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing title', () => {
    const result = createProductSchema.safeParse({ price: 10 })
    expect(result.success).toBe(false)
  })

  it('rejects zero price', () => {
    const result = createProductSchema.safeParse({ title: 'Widget', price: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative price', () => {
    const result = createProductSchema.safeParse({ title: 'Widget', price: -5 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status', () => {
    const result = createProductSchema.safeParse({ title: 'Widget', price: 10, status: 'archived' })
    expect(result.success).toBe(false)
  })

  it('rejects negative inventory', () => {
    const result = createProductSchema.safeParse({ title: 'Widget', price: 10, inventory: -1 })
    expect(result.success).toBe(false)
  })
})

// ─── update_product ──────────────────────────────────────────

describe('updateProductSchema', () => {
  it('accepts productId only', () => {
    const result = updateProductSchema.safeParse({ productId: 42 })
    expect(result.success).toBe(true)
  })

  it('accepts productId with optional fields', () => {
    const result = updateProductSchema.safeParse({
      productId: 42,
      title: 'New Title',
      price: 19.99,
      status: 'published',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing productId', () => {
    const result = updateProductSchema.safeParse({ title: 'New Title' })
    expect(result.success).toBe(false)
  })

  it('rejects zero productId', () => {
    const result = updateProductSchema.safeParse({ productId: 0 })
    expect(result.success).toBe(false)
  })
})

// ─── create_booking ──────────────────────────────────────────

describe('createBookingSchema', () => {
  it('accepts valid input', () => {
    const result = createBookingSchema.safeParse({
      title: 'Massage Session',
      bookingType: 'service',
      startDateTime: '2026-03-10T14:00:00Z',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all optional fields', () => {
    const result = createBookingSchema.safeParse({
      title: 'Massage Session',
      bookingType: 'service',
      startDateTime: '2026-03-10T14:00:00Z',
      providerId: 5,
      duration: 90,
      description: 'Deep tissue',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing title', () => {
    const result = createBookingSchema.safeParse({
      bookingType: 'service',
      startDateTime: '2026-03-10T14:00:00Z',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid bookingType', () => {
    const result = createBookingSchema.safeParse({
      title: 'Session',
      bookingType: 'invalid',
      startDateTime: '2026-03-10T14:00:00Z',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing startDateTime', () => {
    const result = createBookingSchema.safeParse({
      title: 'Session',
      bookingType: 'service',
    })
    expect(result.success).toBe(false)
  })
})

// ─── create_post ─────────────────────────────────────────────

describe('createPostSchema', () => {
  it('accepts minimal input', () => {
    const result = createPostSchema.safeParse({ title: 'My Post' })
    expect(result.success).toBe(true)
  })

  it('accepts full input', () => {
    const result = createPostSchema.safeParse({
      title: 'My Post',
      content: 'Some content',
      excerpt: 'Brief summary',
      status: 'published',
      categories: ['Tech', 'News'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing title', () => {
    const result = createPostSchema.safeParse({ content: 'No title' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid status', () => {
    const result = createPostSchema.safeParse({ title: 'Post', status: 'archived' })
    expect(result.success).toBe(false)
  })
})

// ─── validateToolInput ───────────────────────────────────────

describe('validateToolInput', () => {
  it('returns null for valid send_email input', () => {
    const result = validateToolInput('send_email', {
      to: 'user@example.com',
      subject: 'Hello',
      body: 'World',
    })
    expect(result).toBeNull()
  })

  it('returns error string for invalid send_email input', () => {
    const result = validateToolInput('send_email', { to: '' })
    expect(result).toContain('Input validation failed')
    expect(result).toContain('send_email')
  })

  it('returns null for unknown tool (no schema)', () => {
    const result = validateToolInput('query_products', { search: 'widget' })
    expect(result).toBeNull()
  })

  it('includes field-level details in error message', () => {
    const result = validateToolInput('create_product', { title: '', price: -5 })
    expect(result).not.toBeNull()
    expect(result).toContain('price')
  })

  it('validates all 8 registered tools', () => {
    const tools = [
      'send_email', 'send_whatsapp', 'send_telegram', 'send_sms',
      'create_product', 'update_product', 'create_booking', 'create_post',
    ]
    for (const tool of tools) {
      // Empty object should fail for all 8 tools
      const result = validateToolInput(tool, {})
      expect(result).not.toBeNull()
    }
  })
})
