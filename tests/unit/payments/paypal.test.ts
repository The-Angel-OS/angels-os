/**
 * PayPal & Venmo Provider — Unit Tests
 */
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
  captureOrVerifyPayPalCheckout,
  createPayPalCheckout,
  parsePayPalWebhookEvent,
  verifyPayPalWebhookSignature,
} from '@/lib/payments/providers/paypal'

const fakePayload = {
  find: vi.fn(async () => ({ docs: [{ id: 1, type: 'platform', slug: 'platform' }] })),
} as any

const originalFetch = globalThis.fetch

describe('PayPal Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settingStore.clear()
    process.env.PAYPAL_CLIENT_ID = 'pp_client_1'
    process.env.PAYPAL_CLIENT_SECRET = 'pp_secret_1'
    process.env.PAYPAL_ENVIRONMENT = 'sandbox'
    process.env.PAYPAL_WEBHOOK_ID = 'WH_123'
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('creates one-time PayPal Orders v2 checkout link', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'tok_pp_1', expires_in: 3600 }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'PP_ORD_1',
            links: [
              { rel: 'self', href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/PP_ORD_1' },
              { rel: 'approve', href: 'https://www.sandbox.paypal.com/checkoutnow?token=PP_ORD_1' },
            ],
          }),
          { status: 201 },
        ),
      )
    globalThis.fetch = fetchMock as any

    const res = await createPayPalCheckout(fakePayload, {
      ref: 'refpp1234567890ab',
      kind: 'order',
      title: 'T-Shirt x2',
      amountCents: 4500,
      returnUrl: 'https://spacesangels.com/checkout/confirm-order?ref=refpp1234567890ab',
      cancelUrl: 'https://spacesangels.com/checkout?cancelled=1',
    })

    expect(res.provider).toBe('paypal')
    expect(res.externalId).toBe('PP_ORD_1')
    expect(res.checkoutUrl).toBe('https://www.sandbox.paypal.com/checkoutnow?token=PP_ORD_1')
    const orderBody = JSON.parse((fetchMock.mock.calls[1]![1] as RequestInit).body as string)
    expect(orderBody.purchase_units[0].amount.value).toBe('45.00')
    expect(orderBody.application_context.user_action).toBe('PAY_NOW')
  })

  it('creates recurring PayPal subscription checkout with cached token', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'PROD_1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'PLAN_1' }), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'I-SUB123',
            links: [{ rel: 'approve', href: 'https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA_1' }],
          }),
          { status: 201 },
        ),
      )
    globalThis.fetch = fetchMock as any

    const res = await createPayPalCheckout(fakePayload, {
      ref: 'refsubpp12345678',
      kind: 'portal_plan',
      planKey: 'portal_business',
      title: 'Business — Clear',
      amountCents: 3900,
      interval: 'month',
      returnUrl: 'https://spacesangels.com/dashboard/plan?upgraded=1',
      cancelUrl: 'https://spacesangels.com/dashboard/plan?cancelled=1',
    })

    expect(res.externalId).toBe('I-SUB123')
    expect(res.checkoutUrl).toContain('ba_token=BA_1')
  })

  it('captures PayPal order and handles 422 already-captured fallback', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ name: 'ORDER_ALREADY_CAPTURED' }), { status: 422 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'PP_ORD_1',
            status: 'COMPLETED',
            payer: { email_address: 'buyer@example.com' },
            purchase_units: [
              {
                payments: {
                  captures: [{ id: 'CAP_1', status: 'COMPLETED', amount: { value: '45.00' } }],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
    globalThis.fetch = fetchMock as any

    const res = await captureOrVerifyPayPalCheckout({ orderId: 'PP_ORD_1' })
    expect(res.verified).toBe(true)
    expect(res.status).toBe('completed')
    expect(res.transactionId).toBe('CAP_1')
    expect(res.amountCents).toBe(4500)
  })

  it('verifies PayPal webhook headers and parses capture + subscription webhooks', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ verification_status: 'SUCCESS' }), { status: 200 }),
    ) as any

    const rawBody = JSON.stringify({
      id: 'WH_EVT_1',
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'CAP_99',
        custom_id: 'refpp1234567890ab',
        amount: { value: '25.00' },
        supplementary_data: { related_ids: { order_id: 'PP_ORD_99' } },
      },
    })

    const headers = new Headers({
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://api.sandbox.paypal.com/cert.pem',
      'paypal-transmission-id': 'tr_1',
      'paypal-transmission-sig': 'sig_1',
      'paypal-transmission-time': '2026-11-22T00:00:00Z',
    })

    expect(await verifyPayPalWebhookSignature(rawBody, headers)).toBe(true)
    expect(await verifyPayPalWebhookSignature(rawBody, new Headers())).toBe(false)

    const parsed = parsePayPalWebhookEvent(rawBody)
    expect(parsed).toMatchObject({
      eventId: 'WH_EVT_1',
      provider: 'paypal',
      ref: 'refpp1234567890ab',
      externalId: 'PP_ORD_99',
      status: 'completed',
      amountCents: 2500,
    })
  })
})
