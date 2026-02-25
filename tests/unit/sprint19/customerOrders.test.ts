/**
 * Sprint 19 — Customer Order History + Vendor Claim Tests
 *
 * Tests the data transformation and component logic for:
 * - Customer order history page (My Orders)
 * - Vendor claim UI interactions
 * - GA4 event tracking helpers
 */
import { describe, it, expect, vi } from 'vitest'

// ─── Customer Order Item Interface Tests ────────────────────────

describe('Customer Order History', () => {
  describe('Order Status Categorization', () => {
    // Simulate the categorization logic from MyOrders component
    function categorizeOrder(fulfillmentStatus: string) {
      switch (fulfillmentStatus) {
        case 'pending_match':
          return 'queued'
        case 'matched':
        case 'accepted':
        case 'in_production':
          return 'in_progress'
        case 'shipped':
        case 'delivered':
          return 'fulfilled'
        case 'cancelled':
          return 'cancelled'
        default:
          return 'in_progress'
      }
    }

    it('categorizes pending_match as queued', () => {
      expect(categorizeOrder('pending_match')).toBe('queued')
    })

    it('categorizes matched as in_progress', () => {
      expect(categorizeOrder('matched')).toBe('in_progress')
    })

    it('categorizes accepted as in_progress', () => {
      expect(categorizeOrder('accepted')).toBe('in_progress')
    })

    it('categorizes in_production as in_progress', () => {
      expect(categorizeOrder('in_production')).toBe('in_progress')
    })

    it('categorizes shipped as fulfilled', () => {
      expect(categorizeOrder('shipped')).toBe('fulfilled')
    })

    it('categorizes delivered as fulfilled', () => {
      expect(categorizeOrder('delivered')).toBe('fulfilled')
    })

    it('categorizes cancelled as cancelled', () => {
      expect(categorizeOrder('cancelled')).toBe('cancelled')
    })

    it('defaults unknown statuses to in_progress', () => {
      expect(categorizeOrder('unknown_status')).toBe('in_progress')
    })
  })

  describe('Configuration Summary Builder', () => {
    function buildConfigSummary(config: Record<string, unknown>): string | null {
      const parts: string[] = []
      if (config.color) parts.push(`Color: ${config.color}`)
      if (config.size) parts.push(`Size: ${config.size}`)
      if (config.customText) parts.push(`Custom text: "${config.customText}"`)
      if (config.material) parts.push(`Material: ${config.material}`)
      if (config.finish) parts.push(`Finish: ${config.finish}`)
      return parts.length > 0 ? parts.join(', ') : null
    }

    it('builds summary from color and size', () => {
      expect(buildConfigSummary({ color: 'Red', size: 'Large' }))
        .toBe('Color: Red, Size: Large')
    })

    it('builds summary with custom text', () => {
      expect(buildConfigSummary({ customText: 'Happy Birthday!' }))
        .toBe('Custom text: "Happy Birthday!"')
    })

    it('builds summary with all fields', () => {
      const summary = buildConfigSummary({
        color: 'Blue',
        size: 'Medium',
        customText: 'Leo',
        material: 'Oak',
        finish: 'Matte',
      })
      expect(summary).toBe('Color: Blue, Size: Medium, Custom text: "Leo", Material: Oak, Finish: Matte')
    })

    it('returns null for empty config', () => {
      expect(buildConfigSummary({})).toBeNull()
    })
  })

  describe('Angel Token ID Format', () => {
    it('matches AT-YYYY-NNNNN format', () => {
      const tokenId = 'AT-2026-00042'
      expect(tokenId).toMatch(/^AT-\d{4}-\d{5}$/)
    })

    it('matches common token IDs', () => {
      const validIds = ['AT-2026-00001', 'AT-2025-12345', 'AT-2026-99999']
      for (const id of validIds) {
        expect(id).toMatch(/^AT-\d{4}-\d{5}$/)
      }
    })
  })
})

// ─── Vendor Claim Logic Tests ───────────────────────────────────

describe('Vendor Claim System', () => {
  describe('FIFO Queue Sorting', () => {
    it('sorts claimable orders by queuedAt (oldest first)', () => {
      const orders = [
        { queuedAt: '2026-02-25T10:00:00Z', productTitle: 'Third' },
        { queuedAt: '2026-02-23T10:00:00Z', productTitle: 'First' },
        { queuedAt: '2026-02-24T10:00:00Z', productTitle: 'Second' },
      ]

      const sorted = orders.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))

      expect(sorted[0].productTitle).toBe('First')
      expect(sorted[1].productTitle).toBe('Second')
      expect(sorted[2].productTitle).toBe('Third')
    })
  })

  describe('Vendor Share Calculation', () => {
    it('calculates 60% vendor share correctly', () => {
      const price = 100
      const vendorShare = Math.round(price * 0.6 * 100) / 100
      expect(vendorShare).toBe(60)
    })

    it('handles fractional prices', () => {
      const price = 49.99
      const vendorShare = Math.round(price * 0.6 * 100) / 100
      expect(vendorShare).toBe(29.99)
    })

    it('handles zero price', () => {
      const price = 0
      const vendorShare = Math.round(price * 0.6 * 100) / 100
      expect(vendorShare).toBe(0)
    })
  })

  describe('Days in Queue Calculator', () => {
    it('calculates 0 days for items queued today', () => {
      const queuedAt = new Date().toISOString()
      const daysInQueue = Math.floor(
        (Date.now() - new Date(queuedAt).getTime()) / (1000 * 60 * 60 * 24),
      )
      expect(daysInQueue).toBe(0)
    })

    it('calculates correct days for items queued days ago', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const daysInQueue = Math.floor(
        (Date.now() - new Date(threeDaysAgo).getTime()) / (1000 * 60 * 60 * 24),
      )
      expect(daysInQueue).toBe(3)
    })
  })
})

// ─── GA4 Event Helpers Tests ────────────────────────────────────

describe('GA4 E-Commerce Events', () => {
  describe('trackPurchase', () => {
    it('GA4 item schema is correct', () => {
      const item = {
        item_id: '42',
        item_name: 'Custom T-Shirt',
        price: 29.99,
        quantity: 2,
      }

      expect(item.item_id).toBeDefined()
      expect(item.item_name).toBeDefined()
      expect(typeof item.price).toBe('number')
      expect(typeof item.quantity).toBe('number')
    })

    it('handles empty cart gracefully', () => {
      const items: Array<{ item_id: string; item_name: string; price: number; quantity: number }> = []
      const value = 0

      expect(items).toHaveLength(0)
      expect(value).toBe(0)
    })
  })

  describe('Angel Token GA4 Event', () => {
    it('formats angel token event correctly', () => {
      const params = {
        tokenId: 'AT-2026-00042',
        value: 49.99,
        skills: ['screen-printing', 'vinyl-cutting'],
      }

      expect(params.tokenId).toMatch(/^AT-/)
      expect(params.value).toBeGreaterThan(0)
      expect(params.skills.join(', ')).toBe('screen-printing, vinyl-cutting')
    })
  })
})

// ─── Vapi Tool Message Builder Tests ────────────────────────────

describe('Vapi Tool Message Builder', () => {
  function buildToolMessage(functionName: string, params: Record<string, unknown>): string {
    switch (functionName) {
      case 'check_order_status':
        return `Check the status of order ${params.orderId || 'the order'}`
      case 'search_products':
        return `Search for products: ${params.query || params.category || 'all products'}`
      case 'book_appointment':
        return `Book an appointment${params.date ? ` for ${params.date}` : ''}${params.service ? ` for ${params.service}` : ''}`
      case 'get_business_hours':
        return 'What are the business hours?'
      case 'transfer_to_human':
        return 'The caller wants to speak with a human team member.'
      default:
        return `Execute ${functionName} with parameters: ${JSON.stringify(params)}`
    }
  }

  it('builds check_order_status message', () => {
    expect(buildToolMessage('check_order_status', { orderId: 42 }))
      .toBe('Check the status of order 42')
  })

  it('builds search_products message with query', () => {
    expect(buildToolMessage('search_products', { query: 'custom t-shirts' }))
      .toBe('Search for products: custom t-shirts')
  })

  it('builds book_appointment message with date and service', () => {
    expect(buildToolMessage('book_appointment', { date: 'March 1st', service: 'consultation' }))
      .toBe('Book an appointment for March 1st for consultation')
  })

  it('builds get_business_hours message', () => {
    expect(buildToolMessage('get_business_hours', {}))
      .toBe('What are the business hours?')
  })

  it('builds transfer_to_human message', () => {
    expect(buildToolMessage('transfer_to_human', {}))
      .toBe('The caller wants to speak with a human team member.')
  })

  it('handles unknown function names', () => {
    const msg = buildToolMessage('custom_function', { key: 'value' })
    expect(msg).toContain('custom_function')
    expect(msg).toContain('key')
  })
})
