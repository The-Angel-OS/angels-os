import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  trackViewItem,
  trackAddToCart,
  trackBeginCheckout,
  trackPurchase,
} from '@/utilities/gtagEcommerce'

/**
 * Money units. The codebase stores cents; GA4 wants dollars. Every call site
 * used to pass cents straight through, so a $599 sale reported as $59,900 —
 * and any ad platform importing those conversions optimizes against a fiction.
 * These assert the conversion happens exactly once, on the way out.
 */
describe('gtagEcommerce money units', () => {
  let calls: unknown[][]

  beforeEach(() => {
    calls = []
    ;(globalThis as any).window = globalThis
    ;(globalThis as any).gtag = (...args: unknown[]) => calls.push(args)
  })

  const payload = () => calls[0]?.[2] as Record<string, any>

  it('view_item reports dollars, not cents', () => {
    trackViewItem({ item_id: '72', item_name: 'Belt', price: 59900 })
    expect(payload().value).toBe(599)
    expect(payload().items[0].price).toBe(599)
  })

  it('add_to_cart converts both the value and each item', () => {
    trackAddToCart([{ item_id: '72', item_name: 'Belt', price: 59900 }], 119800)
    expect(payload().value).toBe(1198)
    expect(payload().items[0].price).toBe(599)
  })

  it('begin_checkout converts', () => {
    trackBeginCheckout([{ item_id: '72', item_name: 'Belt', price: 59900 }], 59900)
    expect(payload().value).toBe(599)
  })

  it('purchase converts value, tax and shipping', () => {
    trackPurchase({
      transactionId: 'o1',
      value: 64700,
      tax: 4200,
      shipping: 600,
      items: [{ item_id: '72', item_name: 'Belt', price: 59900 }],
    })
    expect(payload().value).toBe(647)
    expect(payload().tax).toBe(42)
    expect(payload().shipping).toBe(6)
    expect(payload().items[0].price).toBe(599)
  })

  it('handles odd cents without float drift', () => {
    trackViewItem({ item_id: '1', item_name: 'x', price: 1999 })
    expect(payload().value).toBe(19.99)
  })

  it('is a no-op with no gtag on the page — no ID, no tracking, no throw', () => {
    delete (globalThis as any).gtag
    expect(() => trackViewItem({ item_id: '1', item_name: 'x', price: 100 })).not.toThrow()
  })
})
