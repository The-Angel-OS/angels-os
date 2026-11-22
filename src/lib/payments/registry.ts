/**
 * Provider-Agnostic Payment Registry & Hosted Checkout Orchestrator
 *
 * Dual-rail router across Square (Cards/Apple Pay/Google Pay + OAuth Connect)
 * and PayPal (PayPal/Venmo/Pay Later).
 */
import type { Payload } from 'payload'
import {
  generateCheckoutRef,
  getConnectedSquareCredentials,
  getPlatformPayPalEnv,
  getPlatformSquareEnv,
  getTenantPaymentSettings,
  isPayPalConfigured,
  isSquareConfigured,
  saveCheckoutIntent,
  updateCheckoutIntent,
} from './config'
import {
  captureOrVerifyPayPalCheckout,
  createPayPalCheckout,
} from './providers/paypal'
import {
  createSquareCheckout,
  refreshSquareOAuthTokenIfNeeded,
  verifySquareCheckout,
} from './providers/square'
import type {
  AvailableProviderInfo,
  CheckoutIntentRecord,
  CheckoutSessionRequest,
  CheckoutSessionResult,
  DecryptedSquareCredentials,
  PaymentProviderId,
  VerifiedPaymentResult,
} from './types'

export async function getAvailableProviders(
  payload: Payload,
  tenantId?: number | string | null,
): Promise<{
  providers: AvailableProviderInfo[]
  defaultProvider: PaymentProviderId | null
  hasConnectedSquare: boolean
}> {
  const providers: AvailableProviderInfo[] = []
  let hasConnectedSquare = false
  let preferred: PaymentProviderId | undefined
  let connectedSquareEnv: 'sandbox' | 'production' | undefined

  if (tenantId != null) {
    const settings = await getTenantPaymentSettings(payload, tenantId)
    preferred = settings.preferredProvider
    const sqCreds = await getConnectedSquareCredentials(payload, tenantId)
    if (sqCreds) {
      hasConnectedSquare = true
      connectedSquareEnv = sqCreds.environment
    }
  }

  const sqEnv = getPlatformSquareEnv()
  if (isSquareConfigured() || hasConnectedSquare) {
    providers.push({
      id: 'square',
      label: 'Card / Apple Pay / Google Pay',
      subtitle: 'Processed securely by Square',
      environment: connectedSquareEnv || sqEnv.environment,
      supportsSubscriptions: true,
      supportsConnectSplit: true,
    })
  }

  const ppEnv = getPlatformPayPalEnv()
  if (isPayPalConfigured()) {
    providers.push({
      id: 'paypal',
      label: 'PayPal / Venmo',
      subtitle: 'Pay with PayPal, Venmo, Pay Later, or Card',
      environment: ppEnv.environment,
      supportsSubscriptions: true,
      supportsConnectSplit: false,
    })
  }

  let defaultProvider: PaymentProviderId | null = providers[0]?.id ?? null
  if (preferred && providers.some((p) => p.id === preferred)) {
    defaultProvider = preferred
  }

  return { providers, defaultProvider, hasConnectedSquare }
}

export async function resolveProvider(
  payload: Payload,
  requested?: string | null,
  tenantId?: number | string | null,
): Promise<PaymentProviderId> {
  const { providers, defaultProvider } = await getAvailableProviders(payload, tenantId)
  if (providers.length === 0 || !defaultProvider) {
    throw new Error(
      'Online payments are not configured yet on this node (set Square or PayPal credentials).',
    )
  }

  if (requested) {
    const normalized = requested.trim().toLowerCase() as PaymentProviderId
    if (providers.some((p) => p.id === normalized)) {
      return normalized
    }
    throw new Error(`Payment provider "${requested}" is not configured or unavailable.`)
  }

  return defaultProvider
}

export async function resolveConnectedSquareForTenant(
  payload: Payload,
  tenantId?: number | string | null,
): Promise<DecryptedSquareCredentials | null> {
  if (tenantId == null) return null
  const creds = await getConnectedSquareCredentials(payload, tenantId)
  if (!creds) return null
  return refreshSquareOAuthTokenIfNeeded(payload, tenantId, creds)
}

export async function startHostedCheckout(
  payload: Payload,
  input: Omit<CheckoutSessionRequest, 'ref'> & { ref?: string },
): Promise<CheckoutSessionResult> {
  const ref = input.ref || generateCheckoutRef()
  const provider = await resolveProvider(payload, input.provider, input.tenantId)
  const currency = (input.currency || 'USD').toUpperCase()

  const connectedSquare =
    input.connectedSquare !== undefined
      ? input.connectedSquare
      : provider === 'square' && input.tenantId != null
        ? await resolveConnectedSquareForTenant(payload, input.tenantId)
        : null

  const environment =
    provider === 'square'
      ? connectedSquare?.environment || getPlatformSquareEnv().environment
      : getPlatformPayPalEnv().environment

  const intentRecord: CheckoutIntentRecord = {
    ref,
    provider,
    environment,
    kind: input.kind,
    status: 'pending',
    amountCents: input.amountCents,
    currency,
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    recipientName: input.recipientName,
    chargeModel: input.chargeModel || (connectedSquare ? 'direct' : 'platform'),
    applicationFeeCents: input.applicationFeeCents,
    connectedMerchantId: connectedSquare?.merchantId,
    connectedLocationId: connectedSquare?.locationId,
    customerEmail: input.customerEmail,
    ...(input.intentData || {}),
    createdAt: new Date().toISOString(),
  }

  await saveCheckoutIntent(payload, intentRecord)

  const sessionReq: CheckoutSessionRequest = {
    ...input,
    ref,
    provider,
    currency,
    connectedSquare,
  }

  const session =
    provider === 'square'
      ? await createSquareCheckout(payload, sessionReq)
      : await createPayPalCheckout(payload, sessionReq)

  await updateCheckoutIntent(payload, ref, {
    externalId: session.externalId,
    environment: session.environment,
  }).catch(() => {})

  return session
}

export async function verifyOrCaptureCheckout(
  payload: Payload,
  input: {
    provider: PaymentProviderId
    intent: CheckoutIntentRecord
    orderId?: string
    transactionId?: string
    subscriptionId?: string
  },
): Promise<VerifiedPaymentResult> {
  const { provider, intent } = input
  if (provider === 'square') {
    const connectedSquare =
      intent.connectedMerchantId && intent.tenantId != null
        ? await resolveConnectedSquareForTenant(payload, intent.tenantId)
        : null
    return verifySquareCheckout(payload, {
      orderId: input.orderId || intent.externalId,
      transactionId: input.transactionId,
      connectedSquare,
    })
  }

  const isRecurring =
    intent.kind === 'membership' ||
    intent.kind === 'portal_plan' ||
    intent.kind === 'guardian_angel'

  return captureOrVerifyPayPalCheckout({
    orderId: isRecurring ? undefined : input.orderId || intent.externalId,
    subscriptionId: isRecurring
      ? input.subscriptionId || intent.externalId
      : input.subscriptionId,
  })
}
