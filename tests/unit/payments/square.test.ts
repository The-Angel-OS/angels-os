/**
 * Square Payment Provider — Unit Tests
 */
import crypto from 'node:crypto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const settingStore = new Map<string, string>()

vi.mock('@/utilities/logError', () => ({
  logError: vi.fn(async () => {}),
}))

vi.mock('@/services/SettingService', () => ({
  getSetting: vi.fn(async (_payload: unknown, _tenantId: unknown, name: string) =>
    settingStore.get(name) ?? null,
  ),
  setSetting: vi.fn(async (_payload: unknown, _tenantId: unknown, name: string, value: string) => {
    settingStore.set(name, value)
  }),
  deleteSetting: vi.fn(async (_payload: unknown, _tenantId: unknown, name: string) => {
    settingStore.delete(name)
  }),
}))

import {
  createSquareCheckout,
  parseSquareWebhookEvent,
  verifySquareCheckout,
  verifySquareWebhookSignature,
} from '@/lib/payments/providers/square'

const fakePayload = {
  find: vi.fn(async () => ({ docs: [{ id: 1, type: 'platform', slug: 'platform' }] })),
} as any

const originalFetch = globalThis.fetch

describe('Square Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settingStore.clear()
    process.env.SQUARE_ACCESS_TOKEN = 'sq_test_tok'
    process.env.SQUARE_ENVIRONMENT = 'sandbox'
    process.env.SQUARE_LOCATION_ID = 'LOC_123'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('creates one-time payment link with app_fee_money for connected Square OAuth', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          payment_link: {
            id: 'PL_1',
            url: 'https://square.link/u/abc123',
            order_id: 'ORD_1',
          },
        }),
        { status: 200 },
      ),
    )
    globalThis.fetch = fetchMock as any

    const res = await createSquareCheckout(fakePayload, {
      ref: 'ref1234567890abcdef',
      kind: 'donation',
      title: 'Donation to Clearwater',
      amountCents: 2500,
      applicationFeeCents: 125,
      connectedSquare: {
        merchantId: 'MERCH_1',
        locationId: 'CON_LOC_1',
        environment: 'sandbox',
        accessToken: 'oauth_tok_1',
        connectedAt: '2026-11-22T00:00:00Z',
      },
      returnUrl: 'https://spacesangels.com/donate?success=true&ref=ref1234567890abcdef',
      cancelUrl: 'https://spacesangels.com/donate?cancelled=true',
    })

    expect(res.provider).toBe('square')
    expect(res.checkoutUrl).toBe('https://square.link/u/abc123')
    expect(res.externalId).toBe('ORD_1')

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://connect.squareupsandbox.com/v2/online-checkout/payment-links')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer oauth_tok_1')
    const sent = JSON.parse(init.body as string)
    expect(sent.order.location_id).toBe('CON_LOC_1')
    expect(sent.checkout_options.app_fee_money).toEqual({ amount: 125, currency: 'USD' })
  })

  it('creates recurring subscription plan variation and quick_pay checkout link', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id_mappings: [{ client_object_id: '#var_m_1_gold', object_id: 'VAR_999' }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            payment_link: {
              id: 'PL_SUB',
              url: 'https://square.link/u/sub123',
              order_id: 'ORD_SUB',
            },
          }),
          { status: 200 },
        ),
      )
    globalThis.fetch = fetchMock as any

    const res = await createSquareCheckout(fakePayload, {
      ref: 'refsub1234567890ab',
      kind: 'membership',
      planKey: 'm_1_gold',
      title: 'Gold Crew — Clearwater',
      amountCents: 1500,
      interval: 'month',
      returnUrl: 'https://spacesangels.com/?membership=success',
      cancelUrl: 'https://spacesangels.com/?membership=cancelled',
    })

    expect(res.checkoutUrl).toBe('https://square.link/u/sub123')
    const firstBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string)
    expect(firstBody.object.present_at_all_locations).toBe(true)
    expect(firstBody.object.present_at_location_ids).toBeUndefined()
    const secondBody = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string)
    expect(secondBody.checkout_options.subscription_plan_id).toBe('VAR_999')
    expect(secondBody.quick_pay.price_money.amount).toBe(1500)
    expect(secondBody.payment_note).toBe('ref:refsub1234567890ab')
  })

  it('verifies completed Square order + payment status', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            order: {
              id: 'ORD_1',
              location_id: 'LOC_123',
              customer_id: 'CUST_1',
              state: 'COMPLETED',
              total_money: { amount: 2500 },
              tenders: [{ id: 'T_1', payment_id: 'PAY_1' }],
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            payment: {
              id: 'PAY_1',
              status: 'COMPLETED',
              amount_money: { amount: 2500 },
              customer_id: 'CUST_1',
              buyer_email_address: 'donor@example.com',
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ subscriptions: [] }), { status: 200 }))
    globalThis.fetch = fetchMock as any

    const verified = await verifySquareCheckout(fakePayload, { orderId: 'ORD_1' })
    expect(verified.verified).toBe(true)
    expect(verified.status).toBe('completed')
    expect(verified.transactionId).toBe('PAY_1')
    expect(verified.amountCents).toBe(2500)
    expect(verified.payerEmail).toBe('donor@example.com')
  })

  it('verifies HMAC-SHA256 Square webhook signature and parses events', () => {
    const webhookUrl = 'https://spacesangels.com/api/payment-ops/webhooks/square'
    const key = 'sq_sig_secret'
    const rawBody = JSON.stringify({
      event_id: 'evt_sq_1',
      type: 'payment.completed',
      data: {
        object: {
          payment: {
            id: 'PAY_1',
            order_id: 'ORD_1',
            status: 'COMPLETED',
            note: 'ref:abcdef1234567890abcdef12',
            amount_money: { amount: 5000 },
            buyer_email_address: 'buyer@example.com',
          },
        },
      },
    })

    const expectedSig = crypto
      .createHmac('sha256', key)
      .update(webhookUrl + rawBody)
      .digest('base64')

    expect(verifySquareWebhookSignature(rawBody, expectedSig, webhookUrl, key)).toBe(true)
    expect(verifySquareWebhookSignature(rawBody, 'invalid==', webhookUrl, key)).toBe(false)

    const parsed = parseSquareWebhookEvent(rawBody)
    expect(parsed).toMatchObject({
      eventId: 'evt_sq_1',
      provider: 'square',
      ref: 'abcdef1234567890abcdef12',
      status: 'completed',
      amountCents: 5000,
    })
  })
})
