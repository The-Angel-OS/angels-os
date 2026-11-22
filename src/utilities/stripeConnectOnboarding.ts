/**
 * Square OAuth Onboarding Link Helper (replaces legacy Stripe Connect onboarding)
 *
 * Shared by LEO's `connect_stripe_account` conversational tool and legacy callers
 * that want a single helper returning the merchant authorization URL or current
 * connection state.
 *
 * @see src/endpoints/payment-ops.ts (/api/payment-ops/square/connect & callback)
 */
import crypto from 'node:crypto'
import type { Payload } from 'payload'
import {
  getConnectedSquareCredentials,
  getPlatformSquareEnv,
} from '@/lib/payments/config'
import { squareBaseUrl } from '@/lib/payments/providers/square'
import { getServerSideURL } from '@/utilities/getURL'

const SQUARE_OAUTH_SCOPES = [
  'PAYMENTS_WRITE',
  'ORDERS_WRITE',
  'CUSTOMERS_READ',
  'CUSTOMERS_WRITE',
  'SUBSCRIPTIONS_WRITE',
  'MERCHANT_PROFILE_READ',
].join(' ')

export interface ConnectOnboardingResult {
  alreadyComplete: boolean
  onboardingUrl?: string
  stripeAccountId?: string
  chargesEnabled?: boolean
  payoutsEnabled?: boolean
}

function signOAuthState(payloadObj: Record<string, unknown>): string {
  const secret = process.env.PAYLOAD_SECRET || process.env.ENCRYPTION_SECRET || 'angel-os-oauth'
  const b64 = Buffer.from(JSON.stringify(payloadObj)).toString('base64url')
  const sig = crypto.createHmac('sha256', secret).update(b64).digest('base64url')
  return `${b64}.${sig}`
}

export async function createConnectOnboardingLink(
  payload: Payload,
  tenantId: number | string,
): Promise<ConnectOnboardingResult> {
  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId as number,
    depth: 0,
    overrideAccess: true,
  })
  if (!tenant) throw new Error(`Tenant ${tenantId} not found`)

  const sq = await getConnectedSquareCredentials(payload, tenantId)
  if (sq) {
    return {
      alreadyComplete: true,
      stripeAccountId: sq.merchantId,
      chargesEnabled: true,
      payoutsEnabled: true,
    }
  }

  const cfg = getPlatformSquareEnv()
  if (!cfg.applicationId || !cfg.applicationSecret) {
    throw new Error(
      'Square OAuth is not configured yet (SQUARE_APPLICATION_ID / SQUARE_APPLICATION_SECRET missing).',
    )
  }

  const baseUrl = getServerSideURL()
  const state = signOAuthState({
    tenantId: Number(tenantId),
    userId: null,
    origin: baseUrl,
    ts: Date.now(),
  })

  const params = new URLSearchParams({
    client_id: cfg.applicationId,
    scope: SQUARE_OAUTH_SCOPES,
    session: 'false',
    state,
    redirect_uri: `${baseUrl}/api/payment-ops/square/callback`,
  })

  const authUrl = `${squareBaseUrl(cfg.environment)}/oauth2/authorize?${params.toString()}`
  return {
    alreadyComplete: false,
    onboardingUrl: authUrl,
  }
}
