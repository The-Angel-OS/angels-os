/**
 * Retired Stripe Webhook Endpoint — POST /api/stripe/webhooks
 *
 * Replaced by provider-agnostic dual-rail webhooks:
 *   - POST /api/payment-ops/webhooks/square
 *   - POST /api/payment-ops/webhooks/paypal
 *
 * Keeps `resolveSubscriptionMember` exported cleanly (without Stripe SDK calls)
 * for legacy callers and unit tests.
 */
import type { PayloadHandler } from 'payload'
import { findOrCreateInvitedUser } from '@/utilities/findOrCreateInvitedUser'
import { logError } from '@/utilities/logError'

export const stripeWebhooksHandler: PayloadHandler = async () => {
  return Response.json(
    {
      error: 'Stripe webhooks have been retired. Use Square or PayPal payment webhooks.',
      replacements: [
        '/api/payment-ops/webhooks/square',
        '/api/payment-ops/webhooks/paypal',
      ],
    },
    { status: 410 },
  )
}

export async function resolveSubscriptionMember(
  payload: Parameters<PayloadHandler>[0]['payload'],
  input: {
    subscriptionId: string
    tenantId?: string
    customerId?: string
    memberUserId?: number
    memberEmail?: string
    memberName?: string
  },
): Promise<{ memberUserId?: number; memberEmail: string }> {
  let memberUserId = input.memberUserId
  const memberEmail = input.memberEmail || ''
  const tenantId = input.tenantId ? Number(input.tenantId) : undefined

  if (!memberUserId && memberEmail) {
    try {
      const resolved = await findOrCreateInvitedUser(payload, {
        email: memberEmail,
        name: input.memberName || null,
      })
      memberUserId = Number(resolved.userId)
    } catch (err) {
      void logError({
        level: 'warning',
        source: 'stripe-webhooks/attachMember',
        message: `Could not attach subscription ${input.subscriptionId} to a user (${memberEmail}): ${err instanceof Error ? err.message : String(err)}`,
        tenantId,
      })
    }
  }

  if (!memberUserId) {
    void logError({
      level: 'warning',
      source: 'stripe-webhooks/attachMember',
      message: `Subscription ${input.subscriptionId} has no member — this customer is paying but cannot access what they bought.`,
      tenantId,
    })
  }

  return { memberUserId, memberEmail }
}
