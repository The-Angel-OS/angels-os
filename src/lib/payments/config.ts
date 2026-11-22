/**
 * Payment Configuration, Token Encryption & SettingService Persistence
 *
 * Zero Postgres schema migrations: stores connected tenant credentials,
 * auto-discovered catalog IDs, and checkout intents in SettingService.
 */
import crypto from 'node:crypto'
import type { Payload } from 'payload'
import { getJsonSetting, setJsonSetting } from '@/services/SettingService'
import { encrypt, safeDecrypt } from '@/utilities/encryption'
import type {
  CheckoutIntentRecord,
  ConnectedSquareAccount,
  DecryptedSquareCredentials,
  PaymentEnvironment,
  TenantPaymentSettings,
} from './types'

const ENTITY_PROVIDERS = 'payment-providers'
const ENTITY_PROVIDERS_ID = 'config'
const SETTING_PROVIDERS = 'providers'

const ENTITY_CATALOG = 'payment-catalog'
const ENTITY_CATALOG_ID = 'cache'

const ENTITY_INTENTS = 'payment-intents'
const SETTING_INTENT = 'intent'

const PLATFORM_STRIPE_KEYS = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOKS_SIGNING_SECRET',
  'STRIPE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
] as const

export interface PlatformSquareEnv {
  accessToken: string
  environment: PaymentEnvironment
  locationId: string
  applicationId: string
  applicationSecret: string
  webhookSignatureKey: string
}

export interface PlatformPayPalEnv {
  clientId: string
  clientSecret: string
  environment: PaymentEnvironment
  webhookId: string
}

export function normalizePaymentEnvironment(raw?: string | null): PaymentEnvironment {
  return raw?.trim().toLowerCase() === 'production' ? 'production' : 'sandbox'
}

export function getPlatformSquareEnv(): PlatformSquareEnv {
  return {
    accessToken: (process.env.SQUARE_ACCESS_TOKEN || '').trim(),
    environment: normalizePaymentEnvironment(process.env.SQUARE_ENVIRONMENT),
    locationId: (process.env.SQUARE_LOCATION_ID || '').trim(),
    applicationId: (process.env.SQUARE_APPLICATION_ID || '').trim(),
    applicationSecret: (process.env.SQUARE_APPLICATION_SECRET || '').trim(),
    webhookSignatureKey: (process.env.SQUARE_WEBHOOK_SIGNATURE_KEY || '').trim(),
  }
}

export function getPlatformPayPalEnv(): PlatformPayPalEnv {
  return {
    clientId: (process.env.PAYPAL_CLIENT_ID || '').trim(),
    clientSecret: (process.env.PAYPAL_CLIENT_SECRET || '').trim(),
    environment: normalizePaymentEnvironment(process.env.PAYPAL_ENVIRONMENT),
    webhookId: (process.env.PAYPAL_WEBHOOK_ID || '').trim(),
  }
}

export function isSquareConfigured(): boolean {
  return Boolean(getPlatformSquareEnv().accessToken)
}

export function isPayPalConfigured(): boolean {
  const pp = getPlatformPayPalEnv()
  return Boolean(pp.clientId && pp.clientSecret)
}

export function detectLeftoverStripeEnvVars(): string[] {
  return PLATFORM_STRIPE_KEYS.filter((k) => Boolean(process.env[k]?.trim()))
}

let cachedPlatformTenantId: number | null = null

export async function resolvePlatformTenantId(payload: Payload): Promise<number> {
  if (cachedPlatformTenantId != null) return cachedPlatformTenantId
  try {
    const byType = await payload.find({
      collection: 'tenants',
      where: { type: { equals: 'platform' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const doc = byType.docs?.[0] as { id?: number | string } | undefined
    if (doc?.id != null) {
      cachedPlatformTenantId = Number(doc.id)
      return cachedPlatformTenantId
    }

    const first = await payload.find({
      collection: 'tenants',
      sort: 'id',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const firstDoc = first.docs?.[0] as { id?: number | string } | undefined
    if (firstDoc?.id != null) {
      cachedPlatformTenantId = Number(firstDoc.id)
      return cachedPlatformTenantId
    }
  } catch {
    // Fallback below
  }
  return 1
}

export function generateCheckoutRef(): string {
  return crypto.randomBytes(12).toString('hex')
}

export async function getTenantPaymentSettings(
  payload: Payload,
  tenantId: number | string,
): Promise<TenantPaymentSettings> {
  try {
    const raw = await getJsonSetting<TenantPaymentSettings>(
      payload,
      { entityName: ENTITY_PROVIDERS, entityId: ENTITY_PROVIDERS_ID, tenantId: Number(tenantId) },
      SETTING_PROVIDERS,
    )
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

export async function saveTenantPaymentSettings(
  payload: Payload,
  tenantId: number | string,
  next: TenantPaymentSettings,
): Promise<void> {
  await setJsonSetting(
    payload,
    { entityName: ENTITY_PROVIDERS, entityId: ENTITY_PROVIDERS_ID, tenantId: Number(tenantId) },
    SETTING_PROVIDERS,
    next,
    { isPrivate: true },
  )
}

export async function saveConnectedSquareAccount(
  payload: Payload,
  tenantId: number | string,
  creds: DecryptedSquareCredentials,
): Promise<void> {
  const existing = await getTenantPaymentSettings(payload, tenantId)
  const stored: ConnectedSquareAccount = {
    connected: true,
    merchantId: creds.merchantId,
    merchantName: creds.merchantName,
    locationId: creds.locationId,
    environment: creds.environment,
    accessToken: encrypt(creds.accessToken),
    ...(creds.refreshToken ? { refreshToken: encrypt(creds.refreshToken) } : {}),
    ...(creds.expiresAt ? { expiresAt: creds.expiresAt } : {}),
    connectedAt: creds.connectedAt,
  }
  await saveTenantPaymentSettings(payload, tenantId, {
    ...existing,
    square: stored,
  })
}

export async function disconnectSquareAccount(
  payload: Payload,
  tenantId: number | string,
): Promise<void> {
  const existing = await getTenantPaymentSettings(payload, tenantId)
  await saveTenantPaymentSettings(payload, tenantId, {
    ...existing,
    square: null,
  })
}

export async function getConnectedSquareCredentials(
  payload: Payload,
  tenantId: number | string,
): Promise<DecryptedSquareCredentials | null> {
  const settings = await getTenantPaymentSettings(payload, tenantId)
  const sq = settings.square
  if (!sq?.connected || !sq.accessToken || !sq.locationId) return null

  const accessToken = safeDecrypt(sq.accessToken)
  if (!accessToken) return null

  const refreshToken = sq.refreshToken ? safeDecrypt(sq.refreshToken) || undefined : undefined
  return {
    merchantId: sq.merchantId,
    merchantName: sq.merchantName,
    locationId: sq.locationId,
    environment: sq.environment || getPlatformSquareEnv().environment,
    accessToken,
    refreshToken,
    expiresAt: sq.expiresAt,
    connectedAt: sq.connectedAt,
  }
}

export async function getCachedProviderValue<T = string>(
  payload: Payload,
  cacheKey: string,
): Promise<T | undefined> {
  try {
    const platformId = await resolvePlatformTenantId(payload)
    return await getJsonSetting<T>(
      payload,
      { entityName: ENTITY_CATALOG, entityId: ENTITY_CATALOG_ID, tenantId: platformId },
      cacheKey,
    )
  } catch {
    return undefined
  }
}

export async function setCachedProviderValue(
  payload: Payload,
  cacheKey: string,
  value: unknown,
): Promise<void> {
  const platformId = await resolvePlatformTenantId(payload)
  await setJsonSetting(
    payload,
    { entityName: ENTITY_CATALOG, entityId: ENTITY_CATALOG_ID, tenantId: platformId },
    cacheKey,
    value,
    { isPrivate: true },
  )
}

export async function saveCheckoutIntent(
  payload: Payload,
  intent: CheckoutIntentRecord,
): Promise<void> {
  const tenantId = intent.tenantId ?? (await resolvePlatformTenantId(payload))
  await setJsonSetting(
    payload,
    { entityName: ENTITY_INTENTS, entityId: intent.ref, tenantId },
    SETTING_INTENT,
    intent,
    { isPrivate: true },
  )
}

export async function getCheckoutIntent(
  payload: Payload,
  ref: string,
): Promise<CheckoutIntentRecord | null> {
  if (!ref) return null
  try {
    const intent = await getJsonSetting<CheckoutIntentRecord>(
      payload,
      { entityName: ENTITY_INTENTS, entityId: ref },
      SETTING_INTENT,
    )
    return intent && typeof intent === 'object' ? intent : null
  } catch {
    return null
  }
}

export async function updateCheckoutIntent(
  payload: Payload,
  ref: string,
  patch: Partial<CheckoutIntentRecord>,
): Promise<CheckoutIntentRecord | null> {
  const existing = await getCheckoutIntent(payload, ref)
  if (!existing) return null
  const updated: CheckoutIntentRecord = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  await saveCheckoutIntent(payload, updated)
  return updated
}
