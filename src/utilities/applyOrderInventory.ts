/**
 * markOrderPaidAndDecrementInventory — the safety-critical money/goods step.
 *
 * On the FIRST transition to paid, decrement each line item's product inventory
 * (clamped at 0; products with no numeric inventory = unlimited/digital are
 * skipped), then mark the order paid. Idempotent via the order's status: a
 * Stripe `payment_intent.succeeded` retry (which fires for both direct AND
 * platform charges) sees status==='paid' and does nothing — no double-decrement.
 *
 * Inventory is the single source of truth across every channel (online, kiosk,
 * QR self-checkout, Nimue POS) — this is what prevents overselling Hays's 100
 * dish gardens.
 *
 * Caveat: read-modify-write per item (Payload has no atomic decrement). Fine for
 * market/roadside volume; a true high-concurrency seller would want row locking.
 */
import type { Payload } from 'payload'

interface OrderItem {
  product?: number | string | { id: number | string; inventory?: number | null }
  quantity?: number
}

export async function markOrderPaidAndDecrementInventory(
  payload: Payload,
  orderId: string | number,
): Promise<{ applied: boolean; decremented: Array<{ product: number | string; from: number; to: number }> }> {
  const order = (await payload
    .findByID({ collection: 'orders', id: orderId, depth: 1, overrideAccess: true })
    .catch(() => null)) as { status?: string; items?: OrderItem[] } | null

  if (!order) return { applied: false, decremented: [] }
  // Already paid → inventory was applied on the first event. Idempotent no-op.
  if (order.status === 'paid') return { applied: false, decremented: [] }

  const items = Array.isArray(order.items) ? order.items : []
  const decremented: Array<{ product: number | string; from: number; to: number }> = []

  for (const item of items) {
    const raw = item?.product
    const productId = raw && typeof raw === 'object' ? raw.id : raw
    if (productId == null) continue

    // Current inventory: from the populated product, else fetch it.
    let current: number | null = null
    if (raw && typeof raw === 'object' && typeof raw.inventory === 'number') {
      current = raw.inventory
    } else {
      const p = (await payload
        .findByID({ collection: 'products', id: productId, depth: 0, overrideAccess: true })
        .catch(() => null)) as { inventory?: number | null } | null
      current = typeof p?.inventory === 'number' ? p.inventory : null
    }
    if (current == null) continue // not inventory-tracked (unlimited/digital)

    const qty = Number(item?.quantity) > 0 ? Number(item.quantity) : 1
    const next = Math.max(0, current - qty)
    await payload
      .update({ collection: 'products', id: productId, data: { inventory: next }, overrideAccess: true })
      .catch(() => {})
    decremented.push({ product: productId, from: current, to: next })
  }

  await payload.update({ collection: 'orders', id: orderId, data: { status: 'paid' } as never, overrideAccess: true })
  return { applied: true, decremented }
}
