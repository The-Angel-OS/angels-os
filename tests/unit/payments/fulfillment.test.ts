/**
 * Unified Dual-Rail Payment Fulfillment — Unit Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const settingStore = new Map<string, string>()

vi.mock('@/utilities/logError', () => ({ logError: vi.fn(async () => {}) }))
vi.mock('@/utilities/applyOrderInventory', () => ({
  markOrderPaidAndDecrementInventory: vi.fn(async () => {}),
}))
vi.mock('@/utilities/ensureTenantMembership', () => ({
  ensureTenantMembershipForUser: vi.fn(async () => {}),
}))
vi.mock('@/utilities/findOrCreateInvitedUser', () => ({
  findOrCreateInvitedUser: vi.fn(async (_p: unknown, opts: { email: string }) => ({
    userId: 77,
    email: opts.email,
    created: true,
  })),
}))
vi.mock('@/utilities/markContactPurchased', () => ({
  markContactPurchased: vi.fn(async () => {}),
}))
vi.mock('@/utilities/sendOrderConfirmationEmail', () => ({
  sendOrderConfirmationEmail: vi.fn(async () => {}),
}))
vi.mock('@/utilities/guardianEntitlement', () => ({
  upgradeToGuardian: vi.fn(async () => {}),
  downgradeToSubscriber: vi.fn(async () => {}),
  isGuardianSubscription: vi.fn(() => false),
}))
vi.mock('@/services/SettingService', () => ({
  getSetting: vi.fn(async (_p: unknown, _t: unknown, k: string) => settingStore.get(k) ?? null),
  setSetting: vi.fn(async (_p: unknown, _t: unknown, k: string, v: string) => {
    settingStore.set(k, v)
  }),
  deleteSetting: vi.fn(async (_p: unknown, _t: unknown, k: string) => {
    settingStore.delete(k)
  }),
}))

import { fulfillVerifiedPayment } from '@/lib/payments/fulfillment'
import { markOrderPaidAndDecrementInventory } from '@/utilities/applyOrderInventory'
import { sendOrderConfirmationEmail } from '@/utilities/sendOrderConfirmationEmail'

describe('fulfillVerifiedPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settingStore.clear()
  })

  it('prevents duplicate fulfillment via processed-stripe-events idempotency', async () => {
    const payload = {
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'processed-stripe-events') {
          return { docs: [{ id: 1, eventId: 'oneoff:ref_dup' }] }
        }
        return { docs: [] }
      }),
      create: vi.fn(),
      update: vi.fn(),
    } as any

    const res = await fulfillVerifiedPayment(payload, {
      idempotencyKey: 'confirm:ref_dup',
      intent: {
        ref: 'ref_dup',
        provider: 'square',
        environment: 'production',
        kind: 'donation',
        status: 'pending',
        amountCents: 2500,
        currency: 'USD',
        chargeModel: 'platform',
        createdAt: '2026-11-22T00:00:00Z',
      },
      verified: {
        verified: true,
        provider: 'square',
        externalId: 'ORD_1',
        status: 'completed',
        amountCents: 2500,
      },
    })

    expect(res.alreadyProcessed).toBe(true)
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('records 5% Justice Fund allocation on direct-split endeavor donation', async () => {
    const createMock = vi.fn(async () => ({ id: 10 }))
    const payload = {
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'tenants') return { docs: [{ id: 1, type: 'platform' }] }
        return { docs: [] }
      }),
      create: createMock,
      update: vi.fn(async () => ({})),
    } as any

    await fulfillVerifiedPayment(payload, {
      idempotencyKey: 'confirm:ref_don',
      intent: {
        ref: 'ref_don',
        provider: 'square',
        environment: 'production',
        kind: 'donation',
        status: 'pending',
        amountCents: 10000,
        currency: 'USD',
        tenantId: 5,
        chargeModel: 'direct',
        donorName: 'Kenneth',
        createdAt: '2026-11-22T00:00:00Z',
      },
      verified: {
        verified: true,
        provider: 'square',
        externalId: 'ORD_D1',
        transactionId: 'PAY_D1',
        status: 'completed',
        amountCents: 10000,
      },
    })

    const jfCall = createMock.mock.calls.find(
      (c: any) => c[0].collection === 'justice-fund-transactions',
    )
    expect(jfCall).toBeDefined()
    expect(jfCall![0].data).toMatchObject({
      type: 'allocation',
      amountCents: 500,
      sourceTotalCents: 10000,
      percentage: 5,
      sourcePaymentIntentId: 'square:PAY_D1',
      status: 'completed',
    })
  })

  it('confirms pending booking and logs platform fee allocation', async () => {
    const createMock = vi.fn(async () => ({ id: 20 }))
    const updateMock = vi.fn(async () => ({}))
    const payload = {
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'tenants') return { docs: [{ id: 1, type: 'platform' }] }
        return { docs: [] }
      }),
      create: createMock,
      update: updateMock,
    } as any

    const res = await fulfillVerifiedPayment(payload, {
      idempotencyKey: 'confirm:ref_bk',
      intent: {
        ref: 'ref_bk',
        provider: 'paypal',
        environment: 'sandbox',
        kind: 'booking',
        status: 'pending',
        amountCents: 5000,
        currency: 'USD',
        tenantId: 9,
        bookingId: 88,
        chargeModel: 'direct',
        applicationFeeCents: 250,
        createdAt: '2026-11-22T00:00:00Z',
      },
      verified: {
        verified: true,
        provider: 'paypal',
        externalId: 'PP_ORD_88',
        transactionId: 'CAP_88',
        status: 'completed',
      },
    })

    expect(res).toMatchObject({ fulfilled: true, bookingId: 88 })
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'bookings',
        id: 88,
        data: expect.objectContaining({ status: 'confirmed', holdExpiresAt: null }),
      }),
    )
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'justice-fund-transactions',
        data: expect.objectContaining({ amountCents: 250 }),
      }),
    )
  })

  it('creates shop order, marks inventory paid, and sends confirmation email', async () => {
    const createMock = vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'orders') return { id: 555 }
      return { id: 1 }
    })
    const updateMock = vi.fn(async () => ({}))
    const payload = {
      find: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'tenants') return { docs: [{ id: 1, type: 'platform' }] }
        return { docs: [] }
      }),
      findByID: vi.fn(async ({ collection }: { collection: string }) => {
        if (collection === 'carts') {
          return {
            id: 42,
            subtotal: 3000,
            tenant: 3,
            items: [{ product: { id: 10, title: 'Shirt' }, quantity: 1 }],
          }
        }
        return null
      }),
      create: createMock,
      update: updateMock,
    } as any

    const res = await fulfillVerifiedPayment(payload, {
      idempotencyKey: 'confirm:ref_ord',
      intent: {
        ref: 'ref_ord',
        provider: 'square',
        environment: 'production',
        kind: 'order',
        status: 'pending',
        amountCents: 3000,
        currency: 'USD',
        tenantId: 3,
        cartId: 42,
        customerEmail: 'shopper@example.com',
        chargeModel: 'platform',
        fulfillmentMethod: 'pickup',
        createdAt: '2026-11-22T00:00:00Z',
      },
      verified: {
        verified: true,
        provider: 'square',
        externalId: 'SQ_ORD_42',
        transactionId: 'SQ_PAY_42',
        status: 'completed',
      },
    })

    expect(res).toMatchObject({ fulfilled: true, orderId: 555 })
    expect(markOrderPaidAndDecrementInventory).toHaveBeenCalledWith(payload, 555)
    expect(sendOrderConfirmationEmail).toHaveBeenCalled()
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'carts',
        id: 42,
        data: expect.objectContaining({ status: 'purchased' }),
      }),
    )
  })
})
