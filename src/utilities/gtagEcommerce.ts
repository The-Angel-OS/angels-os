/**
 * Google Analytics 4 — E-Commerce Event Helpers
 *
 * Typed wrappers for the standard GA4 e-commerce events.
 * Fires through gtag() when configured, no-ops gracefully when not.
 *
 * Gated by NEXT_PUBLIC_GA_MEASUREMENT_ID — no ID means no tracking.
 *
 * ⚠️ MONEY UNITS. Everything in this codebase stores money in CENTS
 * (priceInUSD 59900 = $599.00), and every call site here was passing those
 * cents straight through as GA4's `value`. GA4 wants MAJOR units, so every
 * event would have reported 100× — a $599 sale as $59,900 — and any ad platform
 * importing those conversions would have optimized against a fiction. These
 * helpers now take CENTS (matching the rest of the codebase) and convert once,
 * here, where it cannot be got wrong per call site.
 *
 * @see https://developers.google.com/analytics/devguides/collection/ga4/ecommerce
 */

// ---------------------------------------------------------------------------
// Types (GA4 standard schema)
// ---------------------------------------------------------------------------

interface GA4Item {
  item_id: string
  item_name: string
  /** CENTS — converted to major units on the way out. */
  price?: number
  quantity?: number
  item_category?: string
  item_variant?: string
  currency?: string
}

// ---------------------------------------------------------------------------
// Safe gtag accessor
// ---------------------------------------------------------------------------

/** Cents → major units, the only place this conversion happens. */
const major = (cents: number | undefined): number =>
  Math.round(((cents ?? 0) / 100) * 100) / 100

/** Item with its price converted for the wire. */
const wireItem = (item: GA4Item): GA4Item => ({ ...item, price: major(item.price) })

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
    value: major(item.price),
    items: [wireItem(item)],
  })
}

/** Fire when a user adds an item to their cart. */
export function trackAddToCart(items: GA4Item[], value: number /* cents */): void {
  safeGtag('event', 'add_to_cart', {
    currency: 'USD',
    value: major(value),
    items: items.map(wireItem),
  })
}

/** Fire when the user begins checkout. */
export function trackBeginCheckout(items: GA4Item[], value: number /* cents */): void {
  safeGtag('event', 'begin_checkout', {
    currency: 'USD',
    value: major(value),
    items: items.map(wireItem),
  })
}

/** Fire when the user adds shipping information. */
export function trackAddShippingInfo(items: GA4Item[], value: number /* cents */): void {
  safeGtag('event', 'add_shipping_info', {
    currency: 'USD',
    value: major(value),
    items: items.map(wireItem),
    shipping_tier: 'standard',
  })
}

/** Fire when the user adds payment information. */
export function trackAddPaymentInfo(items: GA4Item[], value: number /* cents */): void {
  safeGtag('event', 'add_payment_info', {
    currency: 'USD',
    value: major(value),
    items: items.map(wireItem),
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
    value: major(params.value),
    tax: major(params.tax),
    shipping: major(params.shipping),
    items: params.items.map(wireItem),
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
