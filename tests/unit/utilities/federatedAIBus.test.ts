/**
 * Federated AI Bus — Unit Tests
 *
 * Tests JWT creation/verification, key conversion, trust level logic,
 * and the sendFederatedMessage orchestrator.
 *
 * Uses real Ed25519 key pairs generated at test time for cryptographic accuracy.
 *
 * @vitest-environment node
 * @see src/utilities/federatedAIBus.ts
 */
import { describe, it, expect, vi, beforeAll } from 'vitest'
import crypto from 'crypto'
import { SignJWT } from 'jose'

import {
  importPrivateKey,
  importPublicKey,
  createFederatedMessageJWT,
  verifyFederatedMessageJWT,
  meetsMinimumTrust,
  statusToTrustLevel,
  TRUST_LEVELS,
  MINIMUM_MESSAGE_TRUST,
} from '@/utilities/federatedAIBus'

// ── Test Key Pair ────────────────────────────────────────────────────────────

let testKeyPairHex: { publicKey: string; privateKey: string }
let otherKeyPairHex: { publicKey: string; privateKey: string }

function generateHexKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  })
  return {
    publicKey: (publicKey as Buffer).toString('hex'),
    privateKey: (privateKey as Buffer).toString('hex'),
  }
}

beforeAll(() => {
  testKeyPairHex = generateHexKeyPair()
  otherKeyPairHex = generateHexKeyPair()
})

// ═══════════════════════════════════════════════════════════════════════════
// 1. Key Conversion
// ═══════════════════════════════════════════════════════════════════════════

describe('Key Conversion', () => {
  it('importPrivateKey returns a KeyObject for signing', () => {
    const key = importPrivateKey(testKeyPairHex.privateKey)
    expect(key).toBeDefined()
    expect(key.type).toBe('private')
  })

  it('importPublicKey returns a KeyObject for verification', () => {
    const key = importPublicKey(testKeyPairHex.publicKey)
    expect(key).toBeDefined()
    expect(key.type).toBe('public')
  })

  it('rejects invalid hex data', () => {
    expect(() => importPrivateKey('not-valid-hex')).toThrow()
    expect(() => importPublicKey('0011223344')).toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2. JWT Round-Trip
// ═══════════════════════════════════════════════════════════════════════════

describe('JWT Creation & Verification', () => {
  it('round-trip: create → verify preserves all claims', async () => {
    const privateKey = importPrivateKey(testKeyPairHex.privateKey)
    const publicKey = importPublicKey(testKeyPairHex.publicKey)

    const jwt = await createFederatedMessageJWT({
      message: 'Hello from Clearwater!',
      conversationId: 'conv-123',
      senderFederationId: 'fed-clearwater-001',
      senderName: 'Clearwater Angels',
      senderDomain: 'clearwater.angelos.app',
      receiverDomain: 'partner.angelos.app',
      privateKey,
    })

    expect(jwt).toBeTruthy()
    expect(jwt.split('.')).toHaveLength(3) // header.payload.signature

    const verified = await verifyFederatedMessageJWT(jwt, publicKey, 'partner.angelos.app')

    expect(verified.federationId).toBe('fed-clearwater-001')
    expect(verified.audience).toBe('partner.angelos.app')
    expect(verified.message).toBe('Hello from Clearwater!')
    expect(verified.conversationId).toBe('conv-123')
    expect(verified.senderName).toBe('Clearwater Angels')
    expect(verified.senderDomain).toBe('clearwater.angelos.app')
    expect(verified.jti).toBeTruthy()
    expect(verified.issuedAt).toBeGreaterThan(0)
  })

  it('JTI is unique per message', async () => {
    const privateKey = importPrivateKey(testKeyPairHex.privateKey)
    const publicKey = importPublicKey(testKeyPairHex.publicKey)

    const opts = {
      message: 'Test',
      senderFederationId: 'fed-001',
      receiverDomain: 'peer.app',
      privateKey,
    }

    const jwt1 = await createFederatedMessageJWT(opts)
    const jwt2 = await createFederatedMessageJWT(opts)

    const v1 = await verifyFederatedMessageJWT(jwt1, publicKey, 'peer.app')
    const v2 = await verifyFederatedMessageJWT(jwt2, publicKey, 'peer.app')

    expect(v1.jti).not.toBe(v2.jti)
  })

  it('verification fails with wrong public key', async () => {
    const privateKey = importPrivateKey(testKeyPairHex.privateKey)
    const wrongPublicKey = importPublicKey(otherKeyPairHex.publicKey)

    const jwt = await createFederatedMessageJWT({
      message: 'Hello',
      senderFederationId: 'fed-001',
      receiverDomain: 'peer.app',
      privateKey,
    })

    await expect(verifyFederatedMessageJWT(jwt, wrongPublicKey, 'peer.app')).rejects.toThrow()
  })

  it('verification fails with wrong audience', async () => {
    const privateKey = importPrivateKey(testKeyPairHex.privateKey)
    const publicKey = importPublicKey(testKeyPairHex.publicKey)

    const jwt = await createFederatedMessageJWT({
      message: 'Hello',
      senderFederationId: 'fed-001',
      receiverDomain: 'correct-peer.app',
      privateKey,
    })

    await expect(verifyFederatedMessageJWT(jwt, publicKey, 'wrong-peer.app')).rejects.toThrow()
  })

  it('verification fails for expired JWT', async () => {
    const privateKey = importPrivateKey(testKeyPairHex.privateKey)
    const publicKey = importPublicKey(testKeyPairHex.publicKey)

    // Create a JWT with very short TTL in the past
    const jwt = await new SignJWT({ msg: 'Expired' })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuer('fed-001')
      .setAudience('peer.app')
      .setSubject('direct')
      .setIssuedAt(Math.floor(Date.now() / 1000) - 600) // 10 minutes ago
      .setExpirationTime(Math.floor(Date.now() / 1000) - 300) // 5 minutes ago
      .setJti(crypto.randomUUID())
      .sign(privateKey)

    await expect(verifyFederatedMessageJWT(jwt, publicKey, 'peer.app')).rejects.toThrow()
  })

  it('rejects JWT with missing msg claim', async () => {
    const privateKey = importPrivateKey(testKeyPairHex.privateKey)
    const publicKey = importPublicKey(testKeyPairHex.publicKey)

    // Create a JWT WITHOUT the msg claim
    const jwt = await new SignJWT({ notMsg: 'oops' })
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuer('fed-001')
      .setAudience('peer.app')
      .setSubject('direct')
      .setIssuedAt()
      .setExpirationTime('5m')
      .setJti(crypto.randomUUID())
      .sign(privateKey)

    await expect(verifyFederatedMessageJWT(jwt, publicKey, 'peer.app')).rejects.toThrow('Missing msg')
  })

  it('omits optional claims when not provided', async () => {
    const privateKey = importPrivateKey(testKeyPairHex.privateKey)
    const publicKey = importPublicKey(testKeyPairHex.publicKey)

    const jwt = await createFederatedMessageJWT({
      message: 'Minimal',
      senderFederationId: 'fed-001',
      receiverDomain: 'peer.app',
      privateKey,
      // No conversationId, senderName, or senderDomain
    })

    const verified = await verifyFederatedMessageJWT(jwt, publicKey, 'peer.app')
    expect(verified.message).toBe('Minimal')
    expect(verified.conversationId).toBeUndefined()
    expect(verified.senderName).toBeUndefined()
    expect(verified.senderDomain).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3. Trust Levels
// ═══════════════════════════════════════════════════════════════════════════

describe('Trust Level Logic', () => {
  it('TRUST_LEVELS has 4 levels in ascending order', () => {
    expect(TRUST_LEVELS).toEqual(['none', 'probationary', 'vouched', 'full'])
  })

  it('MINIMUM_MESSAGE_TRUST is vouched', () => {
    expect(MINIMUM_MESSAGE_TRUST).toBe('vouched')
  })

  it('meetsMinimumTrust: full ≥ vouched', () => {
    expect(meetsMinimumTrust('full')).toBe(true)
    expect(meetsMinimumTrust('vouched')).toBe(true)
    expect(meetsMinimumTrust('probationary')).toBe(false)
    expect(meetsMinimumTrust('none')).toBe(false)
  })

  it('meetsMinimumTrust with custom minimum', () => {
    expect(meetsMinimumTrust('probationary', 'probationary')).toBe(true)
    expect(meetsMinimumTrust('none', 'probationary')).toBe(false)
    expect(meetsMinimumTrust('full', 'full')).toBe(true)
    expect(meetsMinimumTrust('vouched', 'full')).toBe(false)
  })

  it('statusToTrustLevel maps ministry statuses', () => {
    expect(statusToTrustLevel('active')).toBe('full')
    expect(statusToTrustLevel('probation')).toBe('vouched')
    expect(statusToTrustLevel('applicant')).toBe('probationary')
    expect(statusToTrustLevel('suspended')).toBe('none')
    expect(statusToTrustLevel('revoked')).toBe('none')
    expect(statusToTrustLevel(undefined)).toBe('none')
    expect(statusToTrustLevel(null)).toBe('none')
  })
})
