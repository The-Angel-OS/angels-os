/**
 * Federation Key Store
 *
 * Get or create a Diocese's Ed25519 key pair, stored encrypted in the Tenants collection.
 * Uses encryption.ts (AES-256-GCM) to protect the private key at rest.
 *
 * The private key is NEVER logged or returned in API responses.
 * The public key is safe to expose in federation pings.
 */

import type { Payload } from 'payload'
import { encrypt, decrypt, safeDecrypt } from '@/utilities/encryption'
import { generateFederationKeyPair } from './protocol'
import type { FederationKeyPair } from './protocol'

// ── Internal: key storage within tenant wizardProgress ────────────────────

interface TenantSetupProgress {
  encryptedPrivateKey?: string
  publicKey?: string
  federationId?: string
  [key: string]: unknown
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Get or create the Ed25519 key pair for a Diocese.
 * If the tenant already has keys stored, decrypts and returns them.
 * If not, generates new keys, encrypts the private key, stores, and returns.
 *
 * @param payload - Payload instance
 * @param tenantId - numeric Payload tenant ID
 * @returns { publicKey, privateKey } — private key is decrypted for use in this request only
 */
export async function getOrCreateFederationKeyPair(
  payload: Payload,
  tenantId: number,
): Promise<FederationKeyPair> {
  // Read current tenant setup progress
  const tenant = await payload.findByID({
    collection: 'tenants',
    id: tenantId,
    overrideAccess: true,
  })

  const progress = ((tenant as unknown as Record<string, unknown>).setup as Record<string, unknown>)
    ?.wizardProgress as TenantSetupProgress | null | undefined

  // Return existing keys if present and decryptable
  if (progress?.encryptedPrivateKey && progress?.publicKey) {
    const privateKey = safeDecrypt(progress.encryptedPrivateKey)
    if (privateKey) {
      return { publicKey: progress.publicKey, privateKey }
    }
    // Fall through to regenerate if decryption failed (key rotation)
    payload.logger.warn(`[keyStore] Failed to decrypt existing key for tenant ${tenantId} — regenerating`)
  }

  // Generate new key pair
  const keyPair = generateFederationKeyPair()

  // Encrypt private key for storage
  const encryptedPrivateKey = encrypt(keyPair.privateKey)

  // Persist into tenant.setup.wizardProgress JSON field
  const existingProgress: TenantSetupProgress = progress ?? {}
  const updatedProgress: TenantSetupProgress = {
    ...existingProgress,
    encryptedPrivateKey,
    publicKey: keyPair.publicKey,
  }

  await payload.update({
    collection: 'tenants',
    id: tenantId,
    data: {
      setup: {
        wizardProgress: updatedProgress,
      },
    },
    overrideAccess: true,
  })

  return keyPair
}

/**
 * Get the Diocese's public key without generating a new one.
 * Returns null if no key pair exists yet.
 */
export async function getTenantPublicKey(
  payload: Payload,
  tenantId: number,
): Promise<string | null> {
  try {
    const tenant = await payload.findByID({
      collection: 'tenants',
      id: tenantId,
      overrideAccess: true,
    })

    const progress = ((tenant as unknown as Record<string, unknown>).setup as Record<string, unknown>)
      ?.wizardProgress as TenantSetupProgress | null | undefined

    return progress?.publicKey ?? null
  } catch {
    return null
  }
}
