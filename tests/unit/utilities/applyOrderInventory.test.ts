/**
 * markOrderPaidAndDecrementInventory — the no-oversell guarantee. Must decrement
 * once on the first settlement, never double-decrement on a webhook retry,
 * and leave untracked products alone.
 */
import { describe, it, expect, vi } from 'vitest'
import { markOrderPaidAndDecrementInventory } from '@/utilities/applyOrderInventory'

function makePayload(order: unknown) {
  const updates: Array<{ collection: string; id: unknown; data: any }> = []
  const payload: any = {
    updates,
    findByID: vi.fn(async ({ collection }: { collection: string }) =>
      collection === 'orders' ? order : null,
    ),
    update: vi.fn(async ({ collection, id, data }: { collection: string; id: unknown; data: any }) => {
      updates.push({ collection, id, data })
      return { id, ...data }
    }),
  }
  return payload
}

describe('markOrderPaidAndDecrementInventory', () => {
  it('decrements each tracked product by its quantity, then completes the order', async () => {
    const payload = makePayload({
      status: 'pending',
      items: [
        { product: { id: 10, inventory: 100 }, quantity: 3 },
        { product: { id: 20, inventory: 5 }, quantity: 1 },
      ],
    })
    const res = await markOrderPaidAndDecrementInventory(payload, 1)

    expect(res.applied).toBe(true)
    const p10 = payload.updates.find((u: any) => u.collection === 'products' && u.id === 10)
    const p20 = payload.updates.find((u: any) => u.collection === 'products' && u.id === 20)
    expect(p10.data.inventory).toBe(97)
    expect(p20.data.inventory).toBe(4)
    expect(payload.updates.find((u: any) => u.collection === 'orders')?.data.status).toBe('completed')
  })

  it('clamps inventory at 0 (never negative)', async () => {
    const payload = makePayload({ status: 'pending', items: [{ product: { id: 10, inventory: 2 }, quantity: 5 }] })
    await markOrderPaidAndDecrementInventory(payload, 1)
    expect(payload.updates.find((u: any) => u.collection === 'products')?.data.inventory).toBe(0)
  })

  it('is idempotent — an already-completed order does nothing (no double-decrement)', async () => {
    const payload = makePayload({ status: 'completed', items: [{ product: { id: 10, inventory: 50 }, quantity: 1 }] })
    const res = await markOrderPaidAndDecrementInventory(payload, 1)
    expect(res.applied).toBe(false)
    expect(payload.updates.length).toBe(0)
  })

  it('skips untracked (unlimited/digital) products', async () => {
    const payload = makePayload({ status: 'pending', items: [{ product: { id: 10, inventory: null }, quantity: 2 }] })
    const res = await markOrderPaidAndDecrementInventory(payload, 1)
    expect(res.decremented).toEqual([])
    // order already completed, so no product update
    expect(payload.updates.filter((u: any) => u.collection === 'products').length).toBe(0)
    expect(payload.updates.find((u: any) => u.collection === 'orders')?.data.status).toBe('completed')
  })
})
