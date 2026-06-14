/**
 * stripeConnectOnboarding — the one way to mint a Stripe Connect onboarding link.
 *
 * Create (or reuse) a tenant's Stripe Express account and return a hosted
 * onboarding URL — the parish/endeavor admin completes Stripe's flow to connect
 * their bank. Shared by the dashboard button (POST /api/stripe/connect/onboard) and
 * LEO's connect_stripe_account tool, so "connect my bank" works the same whether you
 * click it or ask for it. Status syncs back via the connect-callback + the
 * account.updated webhook.
 *
 * @see src/endpoints/stripe-connect-onboard.ts
 * @see src/endpoints/stripe-webhooks.ts (account.updated)
 */
import type { Payload } from 'payload'
import Stripe from 'stripe'
import { getServerSideURL } from '@/utilities/getURL'

let _stripe: Stripe | null = null
function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not configured')
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-08-27.basil' })
  }
  return _stripe
}

export interface ConnectOnboardingResult {
  /** True when the account is already fully onboarded — no link needed. */
  alreadyComplete: boolean
  /** The Stripe hosted onboarding URL (absent when alreadyComplete). */
  onboardingUrl?: string
  stripeAccountId?: string
  chargesEnabled?: boolean
  payoutsEnabled?: boolean
}

/**
 * Create or reuse the tenant's Express account and return a fresh onboarding link.
 * Idempotent on the account (reuses an existing stripeAccountId); the account link
 * itself is single-use/short-lived by Stripe's design, so this is called each time.
 */
export async function createConnectOnboardingLink(
  payload: Payload,
  tenantId: number | string,
): Promise<ConnectOnboardingResult> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = (await payload.findByID({ collection: 'tenants', id: tenantId as number, depth: 0 })) as any
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`)

  const connect = tenant.stripeConnect as Record<string, unknown> | undefined
  if (connect?.stripeAccountId && connect?.stripeOnboardingComplete) {
    return {
      alreadyComplete: true,
      stripeAccountId: connect.stripeAccountId as string,
      chargesEnabled: Boolean(connect.stripeChargesEnabled),
      payoutsEnabled: Boolean(connect.stripePayoutsEnabled),
    }
  }

  // Create the Express account on first run; reuse it on subsequent attempts.
  let accountId = connect?.stripeAccountId as string | undefined
  if (!accountId) {
    const account = await getStripe().accounts.create({
      type: 'express',
      metadata: { tenantId: String(tenantId), tenantSlug: tenant.slug, platform: 'angel-os' },
    })
    accountId = account.id
    await payload.update({
      collection: 'tenants',
      id: tenantId,
      data: {
        stripeConnect: {
          stripeAccountId: accountId,
          stripeOnboardingComplete: false,
          stripePayoutsEnabled: false,
          stripeChargesEnabled: false,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      overrideAccess: true,
    })
  }

  const baseUrl = getServerSideURL()
  const accountLink = await getStripe().accountLinks.create({
    account: accountId,
    refresh_url: `${baseUrl}/dashboard/admin/payments?refresh=true`,
    return_url: `${baseUrl}/dashboard/admin/payments?onboarding=complete`,
    type: 'account_onboarding',
  })

  return { alreadyComplete: false, onboardingUrl: accountLink.url, stripeAccountId: accountId }
}
