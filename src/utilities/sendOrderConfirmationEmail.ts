/**
 * Order Confirmation Email Sender
 *
 * Sends transactional email after successful payment.
 * Called from stripe-webhooks.ts on payment_intent.succeeded.
 *
 * @see src/utilities/sendTenantInvitationEmail.ts — template pattern
 * @see src/endpoints/stripe-webhooks.ts — webhook caller
 */
import type { Payload } from 'payload'
import { getServerSideURL } from '@/utilities/getURL'

export interface OrderEmailOptions {
  payload: Payload
  customerEmail: string
  customerName?: string
  orderId: string
  orderItems: Array<{
    title: string
    quantity: number
    priceInUSD: number
  }>
  totalCents: number
  currency?: string
  stripeReceiptUrl?: string
}

/** Escape user-supplied values for safe HTML interpolation */
function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function sendOrderConfirmationEmail(
  opts: OrderEmailOptions,
): Promise<boolean> {
  const {
    payload,
    customerEmail,
    customerName,
    orderId,
    orderItems,
    totalCents,
    currency = 'usd',
    stripeReceiptUrl,
  } = opts

  const baseUrl = getServerSideURL()
  const orderUrl = `${baseUrl}/orders/${orderId}`
  const totalFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(totalCents / 100)

  const safeName = esc(customerName || 'there')
  const safeOrderId = esc(orderId)
  const safeOrderUrl = esc(orderUrl)

  const itemRowsHtml = orderItems
    .map((item) => {
      const itemTotal = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
      }).format(item.priceInUSD * item.quantity)
      return `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${esc(item.title)}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #eee; text-align: right;">${itemTotal}</td>
        </tr>`
    })
    .join('')

  const itemsTextList = orderItems
    .map((item) => `  - ${item.title} x${item.quantity} ($${(item.priceInUSD * item.quantity).toFixed(2)})`)
    .join('\n')

  const subject = `Order Confirmed — #${orderId.slice(-8).toUpperCase()}`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1a1a1a;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: #10B981; color: white; width: 48px; height: 48px; border-radius: 12px; line-height: 48px; font-size: 20px; font-weight: bold;">A</div>
          <p style="margin: 8px 0 0; font-size: 14px; color: #666;">Order Confirmation</p>
        </div>

        <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 16px;">Thank you, ${safeName}!</h1>

        <p style="font-size: 16px; line-height: 1.5; color: #333;">
          Your order <strong>#${safeOrderId.slice(-8).toUpperCase()}</strong> has been confirmed and payment received.
        </p>

        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 24px 0;">
          <h2 style="font-size: 16px; margin: 0 0 12px; color: #333;">Order Summary</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="color: #666;">
                <th style="text-align: left; padding-bottom: 8px; border-bottom: 2px solid #ddd;">Item</th>
                <th style="text-align: center; padding-bottom: 8px; border-bottom: 2px solid #ddd;">Qty</th>
                <th style="text-align: right; padding-bottom: 8px; border-bottom: 2px solid #ddd;">Price</th>
              </tr>
            </thead>
            <tbody>
              ${itemRowsHtml}
            </tbody>
            <tfoot>
              <tr>
                <td colspan="2" style="padding-top: 12px; font-weight: 600; font-size: 16px;">Total</td>
                <td style="padding-top: 12px; font-weight: 600; font-size: 16px; text-align: right;">${totalFormatted}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${safeOrderUrl}"
             style="display: inline-block; background: #10B981; color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
            View Your Order
          </a>
        </div>

        ${
          stripeReceiptUrl
            ? `
        <p style="font-size: 13px; color: #999; text-align: center;">
          <a href="${esc(stripeReceiptUrl)}" style="color: #10B981;">View payment receipt</a>
        </p>
        `
            : ''
        }

        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;">

        <p style="font-size: 12px; color: #999; text-align: center;">
          Powered by Angel OS — Everyone gets an Angel.
        </p>
      </body>
    </html>
  `

  const text = `Thank you${customerName ? `, ${customerName}` : ''}!\n\nYour order #${orderId.slice(-8).toUpperCase()} has been confirmed.\n\nOrder Summary:\n${itemsTextList}\n\nTotal: ${totalFormatted}\n\nView your order: ${orderUrl}\n${stripeReceiptUrl ? `Payment receipt: ${stripeReceiptUrl}\n` : ''}\nPowered by Angel OS — Everyone gets an Angel.`

  try {
    await payload.sendEmail({
      to: customerEmail,
      subject,
      html,
      text,
    })
    console.log(`[Order Email] Confirmation sent to ${customerEmail} for order ${orderId}`)
    return true
  } catch (err) {
    console.warn(
      `[Order Email] Could not send to ${customerEmail} for order ${orderId}. Order URL: ${orderUrl}`,
      err instanceof Error ? err.message : err,
    )
    return false
  }
}
