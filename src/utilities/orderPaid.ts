/**
 * What "this order was paid for" actually means in this database.
 *
 * There is no `paid` order status and there never was — `enum_orders_status` is
 * the ecommerce plugin's four values: processing · completed · cancelled ·
 * refunded. Five places in this codebase read or wrote `'paid'` anyway, so every
 * one of them was a silent no-op: `hasPaidFor` could never grant a purchased
 * training, `markOrderPaidAndDecrementInventory` would have failed select
 * validation, and the payouts dashboard summed an always-empty list.
 *
 * The plugin only creates an order AFTER Stripe reports the PaymentIntent
 * `succeeded`, so an order that exists at `processing` has already been paid.
 * That makes a fifth status redundant — this list is the vocabulary instead.
 *
 * ponytail: a list, not a migration. Add a real `paid` value only if an order
 * can ever exist before the money does (invoicing, net-30) — then this is the
 * one place that changes.
 */
export const PAID_ORDER_STATUSES = ['processing', 'completed'] as const

/** Statuses past the point of needing inventory decremented or being cancellable. */
export const SETTLED_ORDER_STATUSES = ['processing', 'completed', 'cancelled', 'refunded'] as const

export const isOrderPaid = (status?: string | null): boolean =>
  !!status && (PAID_ORDER_STATUSES as readonly string[]).includes(status)
