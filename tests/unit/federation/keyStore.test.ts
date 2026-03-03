/**
 * Federation Key Store — Unit Tests
 *
 * Tests getOrCreateFederationKeyPair and getTenantPublicKey.
 * Real Payload calls are replaced with a mock. Encryption is mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('@/utilities/encryption', () => ({
  encrypt: vi.fn((v: string) => `enc:${v}`),
  decrypt: vi.fn((v: string) => v.replace('enc:', '')),
  safeDecrypt: vi.fn((v: string) => {
    if (v.startsWith('enc:')) return v.replace('enc:', '')
    return null
  }),
}))

vi.mock('@/federation/protocol', () => ({
  generateFederationKeyPair: vi.fn(() => ({
    publicKey: 'generated-pub-key',
    privateKey: 'generated-priv-key',
  })),
}))

import { getOrCreateFederationKeyPair, getTenantPublicKey } from '@/federation/keyStore'
import { safeDecrypt } from '@/utilities/encryption'
import { generateFederationKeyPair } from '@/federation/protocol'

const mockSafeDecrypt = vi.mocked(safeDecrypt)
const mockGenerateKeyPair = vi.mocked(generateFederationKeyPair)

// ── Helpers ────────────────────────────────────────────────────────────────

function makePayload(tenantSetup?: Record<string, unknown>) {
  const tenant = tenantSetup !== undefined
    ? { setup: { wizardProgress: tenantSetup } }
    : { setup: {} }

  return {
    findByID: vi.fn().mockResolvedValue(tenant),
    update: vi.fn().mockResolvedValue({}),
    logger: { warn: vi.fn() },
  } as any
}

// ── getOrCreateFederationKeyPair ───────────────────────────────────────────

describe('getOrCreateFederationKeyPair', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGenerateKeyPair.mockReturnValue({
      publicKey: 'generated-pub-key',
      privateKey: 'generated-priv-key',
    })
    mockSafeDecrypt.mockImplementation((v: string) => {
      if (v.startsWith('enc:')) return v.replace('enc:', '')
      return null
    })
  })

  it('generates a new key pair when none exists', async () => {
    const payload = makePayload({})
    const result = await getOrCreateFederationKeyPair(payload, 1)
    expect(mockGenerateKeyPair).toHaveBeenCalledOnce()
    expect(result.publicKey).toBe('generated-pub-key')
    expect(result.privateKey).toBe('generated-priv-key')
  })

  it('saves the new key pair to the tenant', async () => {
    const payload = makePayload({})
    await getOrCreateFederationKeyPair(payload, 1)
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenants',
        id: 1,
        data: expect.objectContaining({
          setup: expect.objectContaining({
            wizardProgress: expect.objectContaining({
              publicKey: 'generated-pub-key',
            }),
          }),
        }),
      }),
    )
  })

  it('returns existing keys when they are already stored and decryptable', async () => {
    const payload = makePayload({
      encryptedPrivateKey: 'enc:existing-priv-key',
      publicKey: 'existing-pub-key',
    })
    const result = await getOrCreateFederationKeyPair(payload, 1)
    expect(mockGenerateKeyPair).not.toHaveBeenCalled()
    expect(result.publicKey).toBe('existing-pub-key')
    expect(result.privateKey).toBe('existing-priv-key')
  })

  it('does not call payload.update when existing keys are returned', async () => {
    const payload = makePayload({
      encryptedPrivateKey: 'enc:existing-priv-key',
      publicKey: 'existing-pub-key',
    })
    await getOrCreateFederationKeyPair(payload, 1)
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('regenerates keys when safeDecrypt returns null (key rotation)', async () => {
    mockSafeDecrypt.mockReturnValue(null)
    const payload = makePayload({
      encryptedPrivateKey: 'corrupted-key',
      publicKey: 'existing-pub-key',
    })
    await getOrCreateFederationKeyPair(payload, 1)
    expect(mockGenerateKeyPair).toHaveBeenCalledOnce()
    expect(payload.update).toHaveBeenCalled()
  })

  it('preserves existing wizardProgress fields when saving new keys', async () => {
    const payload = makePayload({ existingField: 'keep-this', constitutionSigned: true })
    await getOrCreateFederationKeyPair(payload, 1)
    const updateCall = payload.update.mock.calls[0][0]
    expect(updateCall.data.setup.wizardProgress.existingField).toBe('keep-this')
    expect(updateCall.data.setup.wizardProgress.constitutionSigned).toBe(true)
  })
})

// ── getTenantPublicKey ─────────────────────────────────────────────────────

describe('getTenantPublicKey', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the public key when it exists in wizardProgress', async () => {
    const payload = makePayload({ publicKey: 'stored-pub-key' })
    const result = await getTenantPublicKey(payload, 1)
    expect(result).toBe('stored-pub-key')
  })

  it('returns null when no wizardProgress exists', async () => {
    const payload = makePayload()
    const result = await getTenantPublicKey(payload, 1)
    expect(result).toBeNull()
  })

  it('returns null when wizardProgress exists but publicKey is absent', async () => {
    const payload = makePayload({ otherField: 'value' })
    const result = await getTenantPublicKey(payload, 1)
    expect(result).toBeNull()
  })

  it('returns null when findByID throws', async () => {
    const payload = {
      findByID: vi.fn().mockRejectedValue(new Error('DB error')),
    } as any
    const result = await getTenantPublicKey(payload, 1)
    expect(result).toBeNull()
  })
})
