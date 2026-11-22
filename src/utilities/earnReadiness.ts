/**
 * earnReadiness — single source of truth for "can this endeavor take a real dollar yet?"
 * Uses the provider-agnostic Square + PayPal dual-rail state.
 */
import type { Payload, Where } from 'payload'
import {
  getConnectedSquareCredentials,
  getPlatformPayPalEnv,
  getPlatformSquareEnv,
  isPayPalConfigured,
  isSquareConfigured,
} from '@/lib/payments/config'
import { getMembershipPlans } from '@/utilities/membershipPlans'
import { getBillingMode } from '@/utilities/billingMode'

export interface EarnReadiness {
  ok: boolean
  error?: string
  tenantSlug?: string
  tenantName?: string
  ready: boolean
  billingMode: string
  checks: {
    connectRequired: boolean
    connectOnboarded: boolean
    chargesEnabled: boolean
    planCount: number
    planIds: Array<string | number>
    webhookConfigured: boolean
    providersConfigured: boolean
  }
  nextAction: string
}

export async function getEarnReadiness(
  payload: Payload,
  ref: { tenantId?: number | string; slug?: string },
): Promise<EarnReadiness> {
  const empty: EarnReadiness['checks'] = {
    connectRequired: false,
    connectOnboarded: false,
    chargesEnabled: false,
    planCount: 0,
    planIds: [],
    webhookConfigured: false,
    providersConfigured: false,
  }

  const where: Where =
    ref.tenantId != null
      ? { id: { equals: ref.tenantId } }
      : { slug: { equals: ref.slug || '' } }

  const tenants = await payload.find({
    collection: 'tenants',
    where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenant = tenants.docs?.[0] as any
  if (!tenant) {
    return {
      ok: false,
      error: 'tenant not found',
      ready: false,
      billingMode: 'unknown',
      checks: empty,
      nextAction: 'Endeavor not found.',
    }
  }

  const tenantSlug = tenant.slug as string
  const tenantName = (tenant.name as string) || tenantSlug

  const billingMode = await getBillingMode(payload, tenant.id)
  const sqCreds = await getConnectedSquareCredentials(payload, tenant.id).catch(() => null)
  const connectOnboarded = Boolean(sqCreds?.merchantId)
  const chargesEnabled = Boolean(sqCreds?.merchantId && sqCreds?.locationId)
  const needsConnect = billingMode === 'connect'
  const connectReady = !needsConnect || (connectOnboarded && chargesEnabled)

  const plans = await getMembershipPlans(payload, tenant.id)
  const activePlans = plans.filter((p) => p.active !== false)

  const squareReady = isSquareConfigured()
  const paypalReady = isPayPalConfigured()
  const providersConfigured = squareReady || paypalReady || chargesEnabled
  const webhookConfigured = Boolean(
    (squareReady && getPlatformSquareEnv().webhookSignatureKey) ||
      (paypalReady && getPlatformPayPalEnv().webhookId),
  )

  let nextAction: string
  if (!providersConfigured) {
    nextAction =
      'Configure Square or PayPal credentials on the platform (run node scripts/setup-payments.mjs) so online checkout is enabled.'
  } else if (needsConnect && !connectOnboarded) {
    nextAction = `Connect ${tenantName}'s Square account via Payments Settings — this endeavor is in connect mode (third-party payouts).`
  } else if (activePlans.length === 0) {
    nextAction =
      'Create a membership plan — ask LEO "create a $1/month plan called Founding Dollar" or POST /api/membership-ops/plans.'
  } else if (!webhookConfigured) {
    nextAction =
      'Register Square / PayPal webhooks via /api/payment-ops/setup (or scripts/setup-payments.mjs) so renewals sync automatically.'
  } else {
    nextAction = `Ready to earn (${billingMode}). Start a checkout: POST /api/membership-ops/checkout { planId: "${activePlans[0].id}" } with x-tenant-id: ${tenantSlug}.`
  }

  const ready = providersConfigured && connectReady && activePlans.length > 0

  return {
    ok: true,
    tenantSlug,
    tenantName,
    ready,
    billingMode,
    checks: {
      connectRequired: needsConnect,
      connectOnboarded,
      chargesEnabled,
      planCount: activePlans.length,
      planIds: activePlans.map((p) => p.id),
      webhookConfigured,
      providersConfigured,
    },
    nextAction,
  }
}
