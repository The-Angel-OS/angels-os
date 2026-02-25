/**
 * Google Analytics 4 — E-Commerce Event Helpers
 *
 * Typed wrappers for the standard GA4 e-commerce events.
 * Fires through gtag() when configured, no-ops gracefully when not.
 *
 * Gated by NEXT_PUBLIC_GA_MEASUREMENT_ID — no ID means no tracking.
 *
 * @see https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
 */

// ---------------------------------------------------------------------------
// Types (GA4 standard schema)
// ---------------------------------------------------------------------------

interface GA4Item {
  item_id: string
  item_name: string
  price?: number
  quantity?: number
  item_category?: string
  item_variant?: string
  currency?: string
}

// ---------------------------------------------------------------------------
// Safe gtag accessor
// ---------------------------------------------------------------------------

function safeGtag(...args: unknown[]): void {
  if (typeof window !== 'undefined' && typeof (window as any).gtag === 'function') {
    ;(window as any).gtag(...args)
  }
}

// ---------------------------------------------------------------------------
// E-Commerce Events
// ---------------------------------------------------------------------------

/** Fire when a user views a product detail page. */
export function trackViewItem(item: GA4Item): void {
  safeGtag('event', 'view_item', {
    currency: item.currency || 'USD',
    value: item.price || 0,
    items: [item],
  })
}

/** Fire when a user adds an item to their cart. */
export function trackAddToCart(items: GA4Item[], value: number): void {
  safeGtag('event', 'add_to_cart', {
    currency: 'USD',
    value,
    items,
  })
}

/** Fire when the user begins checkout. */
export function trackBeginCheckout(items: GA4Item[], value: number): void {
  safeGtag('event', 'begin_checkout', {
    currency: 'USD',
    value,
    items,
  })
}

/** Fire when the user adds shipping information. */
export function trackAddShippingInfo(items: GA4Item[], value: number): void {
  safeGtag('event', 'add_shipping_info', {
    currency: 'USD',
    value,
    items,
    shipping_tier: 'standard',
  })
}

/** Fire when the user adds payment information. */
export function trackAddPaymentInfo(items: GA4Item[], value: number): void {
  safeGtag('event', 'add_payment_info', {
    currency: 'USD',
    value,
    items,
    payment_type: 'credit_card',
  })
}

/** Fire on successful purchase/order confirmation. */
export function trackPurchase(params: {
  transactionId: string
  value: number
  items: GA4Item[]
  tax?: number
  shipping?: number
}): void {
  safeGtag('event', 'purchase', {
    transaction_id: params.transactionId,
    currency: 'USD',
    value: params.value,
    tax: params.tax || 0,
    shipping: params.shipping || 0,
    items: params.items,
  })
}

/** Fire when an Angel Token is issued (custom event). */
export function trackAngelTokenIssued(params: {
  tokenId: string
  value: number
  skills: string[]
}): void {
  safeGtag('event', 'angel_token_issued', {
    currency: 'USD',
    value: params.value,
    angel_token_id: params.tokenId,
    required_skills: params.skills.join(', '),
  })
}
