/**
 * Model A Creator-Owned Print-on-Demand (POD) Fulfillment Types
 *
 * Supports creator-owned Printful (OAuth 2.0 + Private API Token, primary)
 * and Printify (API Token, secondary) accounts stored encrypted per tenant
 * in SettingService with zero Postgres schema migrations.
 */

export type PODProviderId = 'printful' | 'printify'
export type PODAuthMode = 'oauth' | 'private_token'

export interface ConnectedPrintfulAccount {
  connected: boolean
  authMode: PODAuthMode
  storeId?: string
  storeName?: string
  storeType?: string
  /** AES-256-GCM encrypted at rest via @/utilities/encryption */
  accessToken: string
  refreshToken?: string
  expiresAt?: string
  webhookSecret?: string
  connectedAt: string
}

export interface ConnectedPrintifyAccount {
  connected: boolean
  shopId?: string
  shopTitle?: string
  salesChannel?: string
  /** AES-256-GCM encrypted at rest via @/utilities/encryption */
  apiToken: string
  webhookSecret?: string
  connectedAt: string
}

export interface TenantPODSettings {
  activeProvider?: PODProviderId
  autoConfirmOrders?: boolean
  packingSlipMessage?: string
  packingSlipPhone?: string
  lastSyncAt?: string
  syncedProductCount?: number
  printful?: ConnectedPrintfulAccount | null
  printify?: ConnectedPrintifyAccount | null
}

export type DecryptedPODCredentials =
  | {
      provider: 'printful'
      authMode: PODAuthMode
      storeId?: string
      storeName?: string
      accessToken: string
      refreshToken?: string
      expiresAt?: string
      webhookSecret?: string
      connectedAt: string
    }
  | {
      provider: 'printify'
      shopId?: string
      shopTitle?: string
      apiToken: string
      webhookSecret?: string
      connectedAt: string
    }

export interface SanitizedPODStatus {
  activeProvider: PODProviderId | null
  autoConfirmOrders: boolean
  packingSlipMessage: string
  packingSlipPhone: string
  lastSyncAt: string | null
  syncedProductCount: number
  oauthAvailable: boolean
  printful: {
    connected: boolean
    authMode: PODAuthMode | null
    storeId: string | null
    storeName: string | null
    storeType: string | null
    connectedAt: string | null
    hasWebhookSecret: boolean
  }
  printify: {
    connected: boolean
    shopId: string | null
    shopTitle: string | null
    connectedAt: string | null
    hasWebhookSecret: boolean
  }
}

export interface PODSyncVariant {
  externalVariantId: string
  syncVariantId?: number
  blueprintId?: number
  printProviderId?: number
  sku?: string
  name: string
  size?: string
  color?: string
  retailPriceCents: number
  currency: string
  previewUrl?: string
  inStock?: boolean
}

export interface PODSyncProduct {
  provider: PODProviderId
  externalProductId: string
  title: string
  thumbnailUrl?: string
  variants: PODSyncVariant[]
}

export interface PODRecipientAddress {
  name: string
  email?: string
  phone?: string
  address1: string
  address2?: string
  city: string
  stateCode?: string
  countryCode: string
  zip: string
}

export interface PODShippingRateRequestItem {
  syncVariantId?: number | string
  externalVariantId?: string
  variantId?: number | string
  quantity: number
}

export interface PODShippingRateOption {
  id: string
  name: string
  rateCents: number
  currency: string
  minDeliveryDays?: number
  maxDeliveryDays?: number
}

export interface PODOrderSubmitItem {
  syncVariantId?: number
  externalVariantId?: string
  variantId?: number
  sku?: string
  name: string
  quantity: number
  retailPriceCents?: number
  files?: Array<{
    type?: string
    url: string
  }>
  printAreas?: Record<string, string>
}

export interface PODOrderSubmitRequest {
  externalOrderId: string
  recipient: PODRecipientAddress
  items: PODOrderSubmitItem[]
  autoConfirm?: boolean
  packingSlip?: {
    email?: string
    phone?: string
    message?: string
  }
}

export interface PODOrderSubmitResult {
  ok: boolean
  provider: PODProviderId
  externalOrderId: string
  providerOrderId?: string
  status: 'draft' | 'pending' | 'in_production' | 'failed'
  autoConfirmed: boolean
  error?: string
  raw?: unknown
}

export interface PODNormalizedWebhookEvent {
  provider: PODProviderId
  eventType: string
  externalOrderId?: string
  providerOrderId?: string
  status: 'in_production' | 'shipped' | 'delivered' | 'cancelled' | 'rejected' | 'pending_match'
  carrier?: string
  trackingNumber?: string
  trackingUrl?: string
  shippedAt?: string
  failureReason?: string
}
