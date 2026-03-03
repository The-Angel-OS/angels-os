/**
 * gtagEcommerce — Unit Tests
 *
 * GA4 e-commerce event helpers — all functions are no-ops when gtag is absent.
 * Tests verify they do not throw and, when gtag is mocked, call it correctly.
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

const mockItem = { item_id: 'prod_123', item_name: 'Widget', price: 9.99 }

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
      items: [mockItem],
    }))
  })

  it('trackAddToCart fires add_to_cart event', () => {
    trackAddToCart([mockItem], 9.99)
    expect(gtagMock).toHaveBeenCalledWith('event', 'add_to_cart', expect.objectContaining({
      value: 9.99,
    }))
  })

  it('trackPurchase includes transactionId', () => {
    trackPurchase({ transactionId: 'order_42', value: 99, items: [mockItem] })
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
