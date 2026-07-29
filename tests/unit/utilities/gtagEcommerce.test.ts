/**
 * gtagEcommerce — Unit Tests
 *
 * GA4 e-commerce event helpers — all functions are no-ops when gtag is absent.
 * Tests verify they do not throw and, when gtag is mocked, call it correctly.
 *
 * 260728: the helpers now take CENTS and convert to major units on the way out,
 * because every call site in the app passes cents (priceInUSD 59900 = $599) and
 * GA4 wants dollars — so every event reported 100×. The fixtures below moved to
 * cents with it; the money-unit block at the bottom is the guard.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  trackViewItem,
  trackAddToCart,
  trackBeginCheckout,
  trackAddShippingInfo,
  trackAddPaymentInfo,
  trackPurchase,
  trackAngelTokenIssued,
} from '@/utilities/gtagEcommerce'

/** price in CENTS — $9.99 */
const mockItem = { item_id: 'prod_123', item_name: 'Widget', price: 999 }
/** the same item as it should appear ON THE WIRE */
const wireItem = { ...mockItem, price: 9.99 }

describe('gtagEcommerce — no gtag installed (no-op)', () => {
  it('trackViewItem does not throw when gtag is absent', () => {
    expect(() => trackViewItem(mockItem)).not.toThrow()
  })

  it('trackAddToCart does not throw when gtag is absent', () => {
    expect(() => trackAddToCart([mockItem], 9.99)).not.toThrow()
  })

  it('trackBeginCheckout does not throw when gtag is absent', () => {
    expect(() => trackBeginCheckout([mockItem], 9.99)).not.toThrow()
  })

  it('trackAddShippingInfo does not throw when gtag is absent', () => {
    expect(() => trackAddShippingInfo([mockItem], 9.99)).not.toThrow()
  })

  it('trackAddPaymentInfo does not throw when gtag is absent', () => {
    expect(() => trackAddPaymentInfo([mockItem], 9.99)).not.toThrow()
  })

  it('trackPurchase does not throw when gtag is absent', () => {
    expect(() =>
      trackPurchase({ transactionId: 'txn_1', value: 9.99, items: [mockItem] }),
    ).not.toThrow()
  })

  it('trackAngelTokenIssued does not throw when gtag is absent', () => {
    expect(() =>
      trackAngelTokenIssued({ tokenId: 'tok_1', value: 50, skills: ['welding'] }),
    ).not.toThrow()
  })
})

describe('gtagEcommerce — with gtag mock', () => {
  const gtagMock = vi.fn()

  beforeEach(() => {
    ;(window as any).gtag = gtagMock
  })

  afterEach(() => {
    delete (window as any).gtag
    gtagMock.mockClear()
  })

  it('trackViewItem fires view_item event', () => {
    trackViewItem(mockItem)
    expect(gtagMock).toHaveBeenCalledWith('event', 'view_item', expect.objectContaining({
      items: [wireItem],
    }))
  })

  it('trackAddToCart fires add_to_cart event', () => {
    trackAddToCart([mockItem], 999)
    expect(gtagMock).toHaveBeenCalledWith('event', 'add_to_cart', expect.objectContaining({
      value: 9.99,
    }))
  })

  it('trackPurchase includes transactionId', () => {
    trackPurchase({ transactionId: 'order_42', value: 9900, items: [mockItem] })
    expect(gtagMock).toHaveBeenCalledWith('event', 'purchase', expect.objectContaining({
      transaction_id: 'order_42',
    }))
  })

  it('trackAngelTokenIssued fires angel_token_issued event', () => {
    trackAngelTokenIssued({ tokenId: 'tok_999', value: 100, skills: ['design', 'coding'] })
    expect(gtagMock).toHaveBeenCalledWith('event', 'angel_token_issued', expect.objectContaining({
      angel_token_id: 'tok_999',
    }))
  })
})


/**
 * Money units — the reason the fixtures above are in cents.
 *
 * Every call site passes cents; GA4 wants dollars. Passing cents through would
 * report a $599 sale as $59,900, and an ad platform importing those conversions
 * optimizes against a fiction with real money. The conversion happens once, in
 * the helpers. These pin it there.
 */
describe('gtagEcommerce — money units (cents in, dollars out)', () => {
  const gtagMock = vi.fn()

  beforeEach(() => {
    ;(window as any).gtag = gtagMock
  })

  afterEach(() => {
    delete (window as any).gtag
    gtagMock.mockClear()
  })

  const payload = () => gtagMock.mock.calls[0]?.[2] as Record<string, any>

  it('view_item reports dollars for a $599 product, not 59900', () => {
    trackViewItem({ item_id: '72', item_name: 'Belt', price: 59900 })
    expect(payload().value).toBe(599)
    expect(payload().items[0].price).toBe(599)
  })

  it('add_to_cart converts the total AND each item', () => {
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
      transactionId: 'o1', value: 64700, tax: 4200, shipping: 600,
      items: [{ item_id: '72', item_name: 'Belt', price: 59900 }],
    })
    expect(payload().value).toBe(647)
    expect(payload().tax).toBe(42)
    expect(payload().shipping).toBe(6)
  })

  it('handles odd cents without float drift', () => {
    trackViewItem({ item_id: '1', item_name: 'x', price: 1999 })
    expect(payload().value).toBe(19.99)
  })
})
