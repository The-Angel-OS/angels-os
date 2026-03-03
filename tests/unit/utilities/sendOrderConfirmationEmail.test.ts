/**
 * sendOrderConfirmationEmail — Unit Tests
 *
 * Tests the email composition and dispatch logic for order confirmations.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('@/utilities/resolveEmailSender', () => ({
  resolveEmailSender: vi.fn(),
  markConnectorError: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/utilities/getURL', () => ({
  getServerSideURL: vi.fn(() => 'https://shop.example.com'),
}))

import { sendOrderConfirmationEmail } from '@/utilities/sendOrderConfirmationEmail'
import { resolveEmailSender } from '@/utilities/resolveEmailSender'

const mockResolveEmailSender = vi.mocked(resolveEmailSender)

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeSendEmail() {
  return vi.fn().mockResolvedValue(undefined)
}

function makeSender(sendEmail = makeSendEmail()) {
  return {
    sendEmail,
    fromAddress: 'orders@example.com',
    fromName: 'Angel OS',
    provider: 'payload-default' as const,
  }
}

const PAYLOAD = {} as any

const BASE_OPTS = {
  payload: PAYLOAD,
  tenantId: 1,
  customerEmail: 'buyer@example.com',
  customerName: 'Bob',
  orderId: 'order-123',
  orderItems: [{ title: 'T-Shirt', quantity: 2, priceInUSD: 19.99 }],
  totalCents: 3998,
  currency: 'usd',
}

// ── sendOrderConfirmationEmail ─────────────────────────────────────────────────

describe('sendOrderConfirmationEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveEmailSender.mockResolvedValue(makeSender())
  })

  it('returns true when email sends successfully', async () => {
    const result = await sendOrderConfirmationEmail(BASE_OPTS)
    expect(result).toBe(true)
  })

  it('returns false when sendEmail throws', async () => {
    const sender = makeSender(vi.fn().mockRejectedValue(new Error('transport error')))
    mockResolveEmailSender.mockResolvedValue(sender)
    const result = await sendOrderConfirmationEmail(BASE_OPTS)
    expect(result).toBe(false)
  })

  it('sends to the customer email address', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendOrderConfirmationEmail(BASE_OPTS)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'buyer@example.com' }),
    )
  })

  it('HTML contains order ID', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendOrderConfirmationEmail(BASE_OPTS)
    const { html } = sendEmail.mock.calls[0][0]
    expect(html).toContain('order-123')
  })

  it('HTML contains product name from order items', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendOrderConfirmationEmail(BASE_OPTS)
    const { html } = sendEmail.mock.calls[0][0]
    expect(html).toContain('T-Shirt')
  })

  it('HTML escapes XSS in customer name', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendOrderConfirmationEmail({
      ...BASE_OPTS,
      customerName: '<script>alert(1)</script>',
    })
    const { html } = sendEmail.mock.calls[0][0]
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('HTML escapes XSS in product title', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendOrderConfirmationEmail({
      ...BASE_OPTS,
      orderItems: [{ title: '"><img src=x>', quantity: 1, priceInUSD: 9.99 }],
    })
    const { html } = sendEmail.mock.calls[0][0]
    expect(html).not.toContain('<img')
  })

  it('includes order URL in HTML based on server URL', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendOrderConfirmationEmail(BASE_OPTS)
    const { html } = sendEmail.mock.calls[0][0]
    expect(html).toContain('https://shop.example.com/orders/order-123')
  })

  it('calls resolveEmailSender with payload and tenantId', async () => {
    await sendOrderConfirmationEmail(BASE_OPTS)
    expect(mockResolveEmailSender).toHaveBeenCalledWith(PAYLOAD, 1)
  })

  it('includes stripe receipt URL in HTML when provided', async () => {
    const sendEmail = makeSendEmail()
    mockResolveEmailSender.mockResolvedValue(makeSender(sendEmail))
    await sendOrderConfirmationEmail({
      ...BASE_OPTS,
      stripeReceiptUrl: 'https://pay.stripe.com/receipts/abc',
    })
    const { html } = sendEmail.mock.calls[0][0]
    expect(html).toContain('pay.stripe.com')
  })
})
