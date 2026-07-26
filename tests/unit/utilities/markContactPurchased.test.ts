/**
 * The CRM↔till join. The failure this prevents is specific and expensive:
 * a clearance sequence emailing a discount to someone who already paid full
 * price. That's a refund request and a lost customer in one send.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { markContactPurchased, PURCHASED_TAG } from '@/utilities/markContactPurchased'

function makePayload(docs: unknown[] = []) {
  return {
    find: vi.fn().mockResolvedValue({ docs }),
    update: vi.fn().mockResolvedValue({ id: 1 }),
  } as never
}

beforeEach(() => vi.clearAllMocks())

describe('markContactPurchased', () => {
  it('tags the matching contact and keeps existing tags', async () => {
    const payload = makePayload([{ id: 7, tags: ['web-capture', 'campaign:clearout'] }])
    const ok = await markContactPurchased(payload, { tenantId: 42, email: 'Buyer@Example.com' })

    expect(ok).toBe(true)
    const call = (payload as unknown as { update: ReturnType<typeof vi.fn> }).update.mock.calls[0]![0]
    expect(call.data.tags).toEqual(['web-capture', 'campaign:clearout', PURCHASED_TAG])
  })

  it('matches on a lowercased email — capture normalises, Stripe does not', async () => {
    const payload = makePayload([{ id: 7, tags: [] }])
    await markContactPurchased(payload, { tenantId: 42, email: '  Buyer@Example.COM ' })
    const where = (payload as unknown as { find: ReturnType<typeof vi.fn> }).find.mock.calls[0]![0].where
    expect(JSON.stringify(where)).toContain('buyer@example.com')
  })

  it('is idempotent — a second webhook does not write again', async () => {
    const payload = makePayload([{ id: 7, tags: [PURCHASED_TAG] }])
    const ok = await markContactPurchased(payload, { tenantId: 42, email: 'b@example.com' })
    expect(ok).toBe(true)
    expect((payload as unknown as { update: ReturnType<typeof vi.fn> }).update).not.toHaveBeenCalled()
  })

  it('is silent when the buyer never came through capture — that is normal', async () => {
    const payload = makePayload([])
    const ok = await markContactPurchased(payload, { tenantId: 42, email: 'walkin@example.com' })
    expect(ok).toBe(false)
    expect((payload as unknown as { update: ReturnType<typeof vi.fn> }).update).not.toHaveBeenCalled()
  })

  it('does nothing without an email or a tenant', async () => {
    const payload = makePayload([{ id: 7, tags: [] }])
    expect(await markContactPurchased(payload, { tenantId: 42, email: null })).toBe(false)
    expect(await markContactPurchased(payload, { tenantId: '', email: 'a@b.com' })).toBe(false)
    expect((payload as unknown as { find: ReturnType<typeof vi.fn> }).find).not.toHaveBeenCalled()
  })

  it('never throws into the payment path', async () => {
    const payload = {
      find: vi.fn().mockRejectedValue(new Error('DB down')),
      update: vi.fn(),
    } as never
    await expect(
      markContactPurchased(payload, { tenantId: 42, email: 'a@b.com' }),
    ).resolves.toBe(false)
  })

  it('passes req through so the write joins the caller connection', async () => {
    const payload = makePayload([{ id: 7, tags: [] }])
    const req = { id: 'req-1' } as never
    await markContactPurchased(payload, { tenantId: 42, email: 'a@b.com', req })
    expect((payload as unknown as { find: ReturnType<typeof vi.fn> }).find.mock.calls[0]![0].req).toBe(req)
    expect((payload as unknown as { update: ReturnType<typeof vi.fn> }).update.mock.calls[0]![0].req).toBe(req)
  })
})
