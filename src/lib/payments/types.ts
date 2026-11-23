/**
 * Provider-Agnostic Dual-Rail Payment Core — Shared Types
 *
 * Supports Square (Cards, Apple Pay, Google Pay, Cash App Pay + Multi-Tenant OAuth)
 * and PayPal (PayPal Wallet, Venmo, Pay Later, Cards).
 */

export type PaymentProviderId = 'square' | 'paypal'
export type PaymentEnvironment = 'sandbox' | 'production'

export type CheckoutKind =
  | 'donation'
  | 'membership'
  | 'order'
  | 'booking'
  | 'portal_plan'
  | 'guardian_angel'
  | 'event_ticket'

export interface ConnectedSquareAccount {
  connected: boolean
  merchantId: string
  merchantName?: string
  locationId: string
  environment: PaymentEnvironment
  /** AES-256-GCM encrypted at rest via @/utilities/encryption */
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  connectedAt: string
}

export interface DecryptedSquareCredentials {
  merchantId: string
  merchantName?: string
  locationId: string
  environment: PaymentEnvironment
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  connectedAt: string
}

export interface TenantPaymentSettings {
  preferredProvider?: PaymentProviderId
  square?: ConnectedSquareAccount | null
}

export interface CheckoutIntentRecord {
  ref: string
  provider: PaymentProviderId
  environment: PaymentEnvironment
  kind: CheckoutKind
  status: 'pending' | 'completed' | 'canceled' | 'failed'
  amountCents: number
  currency: string
  tenantId?: number
  tenantSlug?: string
  recipientName?: string
  chargeModel: 'platform' | 'direct'
  applicationFeeCents?: number
  connectedMerchantId?: string
  connectedLocationId?: string
  externalId?: string
  /** Optional kind-specific fields */
  cartId?: string | number
  orderId?: string | number
  bookingId?: string | number
  eventId?: string | number
  registrationId?: string | number
  ticketCount?: number
  eventTitle?: string
  attendanceMode?: string
  planId?: string
  planName?: string
  interval?: 'month' | 'year'
  portalPlan?: 'creator' | 'site' | 'business'
  memberUserId?: number | string
  memberEmail?: string
  memberName?: string
  donorName?: string
  donorEmail?: string
  message?: string
  customerEmail?: string
  customerName?: string
  intentData?: Record<string, unknown>
  fulfillmentMethod?: 'ship' | 'pickup'
  shippingAddress?: Record<string, unknown>
  billingAddress?: Record<string, unknown>
  createdAt: string
  updatedAt?: string
}

export interface CheckoutSessionRequest {
  ref: string
  provider?: PaymentProviderId
  kind: CheckoutKind
  title: string
  description?: string
  amountCents: number
  currency?: string
  interval?: 'month' | 'year'
  planKey?: string
  tenantId?: number
  tenantSlug?: string
  tenantName?: string
  recipientName?: string
  chargeModel?: 'platform' | 'direct'
  applicationFeeCents?: number
  connectedSquare?: DecryptedSquareCredentials | null
  customerEmail?: string
  customerName?: string
  collectShippingAddress?: boolean
  returnUrl: string
  cancelUrl: string
  /** Extra metadata persisted on CheckoutIntentRecord */
  intentData?: Partial<CheckoutIntentRecord>
}

export interface CheckoutSessionResult {
  provider: PaymentProviderId
  environment: PaymentEnvironment
  checkoutUrl: string
  externalId: string
  ref: string
}

export interface VerifiedPaymentResult {
  verified: boolean
  provider: PaymentProviderId
  externalId: string
  transactionId?: string
  subscriptionId?: string
  customerId?: string
  payerEmail?: string
  payerName?: string
  status: 'completed' | 'active' | 'pending' | 'canceled' | 'past_due' | 'failed'
  amountCents?: number
  currentPeriodEnd?: string
  rawStatus?: string
}

export interface ParsedWebhookEvent {
  eventId: string
  eventType: string
  provider: PaymentProviderId
  ref?: string
  externalId?: string
  subscriptionId?: string
  customerId?: string
  payerEmail?: string
  amountCents?: number
  status?: 'completed' | 'active' | 'canceled' | 'past_due' | 'refunded' | 'failed'
  currentPeriodEnd?: string
}

export interface ProviderSelfTestResult {
  provider: PaymentProviderId
  configured: boolean
  healthy: boolean
  environment: PaymentEnvironment
  detectedEnvironmentMismatch?: PaymentEnvironment
  merchantOrAppName?: string
  locationId?: string
  webhookConfigured: boolean
  errors: string[]
  warnings: string[]
}

export interface AvailableProviderInfo {
  id: PaymentProviderId
  label: string
  subtitle: string
  environment: PaymentEnvironment
  supportsSubscriptions: boolean
  supportsConnectSplit: boolean
}
