/**
 * Print-on-Demand (POD) Provider Configuration & Encrypted Storage
 *
 * Zero Postgres schema migrations: stores connected Printful/Printify creator
 * tokens encrypted with AES-256-GCM inside SettingService per tenant, matching
 * the exact pattern proven in src/lib/payments/config.ts.
 */
import crypto from 'node:crypto'
import type { Payload } from 'payload'
import { getJsonSetting, setJsonSetting } from '@/services/SettingService'
import { encrypt, safeDecrypt } from '@/utilities/encryption'
import type {
  ConnectedPrintfulAccount,
  ConnectedPrintifyAccount,
  DecryptedPODCredentials,
  PODAuthMode,
  PODProviderId,
  SanitizedPODStatus,
  TenantPODSettings,
} from './types'

const ENTITY_POD = 'pod-providers'
const ENTITY_POD_ID = 'config'
const SETTING_POD = 'providers'

export interface PlatformPrintfulOAuthEnv {
  clientId: string
  clientSecret: string
}

export function getPlatformPrintfulOAuthEnv(): PlatformPrintfulOAuthEnv {
  return {
    clientId: (process.env.PRINTFUL_CLIENT_ID || '').trim(),
    clientSecret: (process.env.PRINTFUL_CLIENT_SECRET || '').trim(),
  }
}

export function isPrintfulOAuthConfigured(): boolean {
  const env = getPlatformPrintfulOAuthEnv()
  return Boolean(env.clientId && env.clientSecret)
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(24).toString('hex')
}

export async function getTenantPODSettings(
  payload: Payload,
  tenantId: number | string,
): Promise<TenantPODSettings> {
  try {
    const raw = await getJsonSetting<TenantPODSettings>(
      payload,
      { entityName: ENTITY_POD, entityId: ENTITY_POD_ID, tenantId: Number(tenantId) },
      SETTING_POD,
    )
    return raw && typeof raw === 'object' ? raw : {}
  } catch {
    return {}
  }
}

export async function saveTenantPODSettings(
  payload: Payload,
  tenantId: number | string,
  next: TenantPODSettings,
): Promise<void> {
  await setJsonSetting(
    payload,
    { entityName: ENTITY_POD, entityId: ENTITY_POD_ID, tenantId: Number(tenantId) },
    SETTING_POD,
    next,
    { isPrivate: true },
  )
}

export async function saveConnectedPrintfulAccount(
  payload: Payload,
  tenantId: number | string,
  creds: {
    authMode: PODAuthMode
    storeId?: string
    storeName?: string
    storeType?: string
    accessToken: string
    refreshToken?: string
    expiresAt?: string
    webhookSecret?: string
    connectedAt?: string
  },
): Promise<void> {
  const existing = await getTenantPODSettings(payload, tenantId)
  const webhookSecret =
    creds.webhookSecret ||
    (existing.printful?.webhookSecret ? safeDecrypt(existing.printful.webhookSecret) || undefined : undefined) ||
    generateWebhookSecret()

  const stored: ConnectedPrintfulAccount = {
    connected: true,
    authMode: creds.authMode,
    ...(creds.storeId ? { storeId: creds.storeId } : {}),
    ...(creds.storeName ? { storeName: creds.storeName } : {}),
    ...(creds.storeType ? { storeType: creds.storeType } : {}),
    accessToken: encrypt(creds.accessToken),
    ...(creds.refreshToken ? { refreshToken: encrypt(creds.refreshToken) } : {}),
    ...(creds.expiresAt ? { expiresAt: creds.expiresAt } : {}),
    webhookSecret: encrypt(webhookSecret),
    connectedAt: creds.connectedAt || new Date().toISOString(),
  }

  await saveTenantPODSettings(payload, tenantId, {
    ...existing,
    activeProvider: existing.activeProvider || 'printful',
    printful: stored,
  })
}

export async function saveConnectedPrintifyAccount(
  payload: Payload,
  tenantId: number | string,
  creds: {
    shopId?: string
    shopTitle?: string
    salesChannel?: string
    apiToken: string
    webhookSecret?: string
    connectedAt?: string
  },
): Promise<void> {
  const existing = await getTenantPODSettings(payload, tenantId)
  const webhookSecret =
    creds.webhookSecret ||
    (existing.printify?.webhookSecret ? safeDecrypt(existing.printify.webhookSecret) || undefined : undefined) ||
    generateWebhookSecret()

  const stored: ConnectedPrintifyAccount = {
    connected: true,
    ...(creds.shopId ? { shopId: creds.shopId } : {}),
    ...(creds.shopTitle ? { shopTitle: creds.shopTitle } : {}),
    ...(creds.salesChannel ? { salesChannel: creds.salesChannel } : {}),
    apiToken: encrypt(creds.apiToken),
    webhookSecret: encrypt(webhookSecret),
    connectedAt: creds.connectedAt || new Date().toISOString(),
  }

  await saveTenantPODSettings(payload, tenantId, {
    ...existing,
    activeProvider: existing.activeProvider || 'printify',
    printify: stored,
  })
}

export async function disconnectPODAccount(
  payload: Payload,
  tenantId: number | string,
  provider: PODProviderId,
): Promise<void> {
  const existing = await getTenantPODSettings(payload, tenantId)
  const next: TenantPODSettings = { ...existing }
  if (provider === 'printful') {
    next.printful = null
    if (next.activeProvider === 'printful') {
      next.activeProvider = next.printify?.connected ? 'printify' : undefined
    }
  } else {
    next.printify = null
    if (next.activeProvider === 'printify') {
      next.activeProvider = next.printful?.connected ? 'printful' : undefined
    }
  }
  await saveTenantPODSettings(payload, tenantId, next)
}

export async function getConnectedPODCredentials(
  payload: Payload,
  tenantId: number | string,
  preferredProvider?: PODProviderId,
): Promise<DecryptedPODCredentials | null> {
  const settings = await getTenantPODSettings(payload, tenantId)
  const order: PODProviderId[] = preferredProvider
    ? [preferredProvider, preferredProvider === 'printful' ? 'printify' : 'printful']
    : settings.activeProvider === 'printify'
      ? ['printify', 'printful']
      : ['printful', 'printify']

  for (const prov of order) {
    if (prov === 'printful' && settings.printful?.connected && settings.printful.accessToken) {
      const accessToken = safeDecrypt(settings.printful.accessToken)
      if (!accessToken) continue
      const refreshToken = settings.printful.refreshToken
        ? safeDecrypt(settings.printful.refreshToken) || undefined
        : undefined
      const webhookSecret = settings.printful.webhookSecret
        ? safeDecrypt(settings.printful.webhookSecret) || undefined
        : undefined
      return {
        provider: 'printful',
        authMode: settings.printful.authMode || 'private_token',
        storeId: settings.printful.storeId,
        storeName: settings.printful.storeName,
        accessToken,
        refreshToken,
        expiresAt: settings.printful.expiresAt,
        webhookSecret,
        connectedAt: settings.printful.connectedAt,
      }
    }

    if (prov === 'printify' && settings.printify?.connected && settings.printify.apiToken) {
      const apiToken = safeDecrypt(settings.printify.apiToken)
      if (!apiToken) continue
      const webhookSecret = settings.printify.webhookSecret
        ? safeDecrypt(settings.printify.webhookSecret) || undefined
        : undefined
      return {
        provider: 'printify',
        shopId: settings.printify.shopId,
        shopTitle: settings.printify.shopTitle,
        apiToken,
        webhookSecret,
        connectedAt: settings.printify.connectedAt,
      }
    }
  }

  return null
}

export function sanitizePODSettingsForClient(
  settings: TenantPODSettings,
): SanitizedPODStatus {
  const pf = settings.printful?.connected ? settings.printful : null
  const py = settings.printify?.connected ? settings.printify : null

  const activeProvider: PODProviderId | null =
    settings.activeProvider && ((settings.activeProvider === 'printful' && pf) || (settings.activeProvider === 'printify' && py))
      ? settings.activeProvider
      : pf
        ? 'printful'
        : py
          ? 'printify'
          : null

  return {
    activeProvider,
    autoConfirmOrders: settings.autoConfirmOrders === true,
    packingSlipMessage: settings.packingSlipMessage || '',
    packingSlipPhone: settings.packingSlipPhone || '',
    lastSyncAt: settings.lastSyncAt || null,
    syncedProductCount: settings.syncedProductCount || 0,
    oauthAvailable: isPrintfulOAuthConfigured(),
    printful: {
      connected: Boolean(pf),
      authMode: pf?.authMode ?? null,
      storeId: pf?.storeId ?? null,
      storeName: pf?.storeName ?? null,
      storeType: pf?.storeType ?? null,
      connectedAt: pf?.connectedAt ?? null,
      hasWebhookSecret: Boolean(pf?.webhookSecret),
    },
    printify: {
      connected: Boolean(py),
      shopId: py?.shopId ?? null,
      shopTitle: py?.shopTitle ?? null,
      connectedAt: py?.connectedAt ?? null,
      hasWebhookSecret: Boolean(py?.webhookSecret),
    },
  }
}
