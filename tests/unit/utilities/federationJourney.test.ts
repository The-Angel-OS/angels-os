/**
 * Unit tests for the Federation Journey — the complete lifecycle of an
 * Enterprise joining the Angel OS federation.
 *
 * Tests the cryptographic signing flow, constitution integrity,
 * signature verification, and registry ping construction.
 *
 * @see src/federation/protocol.ts
 * @see src/federation/constitution.ts
 */
import { describe, it, expect, beforeAll } from 'vitest'

import {
  generateFederationKeyPair,
  signData,
  verifySignature,
  createSigningPayload,
  signConstitution,
  verifyConstitutionSignature,
  type ConstitutionSigningEvent,
  type ConstitutionSignature,
  type FederationRegistryPing,
} from '@/federation/protocol'

import {
  getActiveConstitution,
  getConstitutionText,
  type ConstitutionDocument,
} from '@/federation/constitution'

// ---------------------------------------------------------------------------
// Constitution Document
// ---------------------------------------------------------------------------

describe('Constitution Document', () => {
  let constitution: ConstitutionDocument

  it('getActiveConstitution returns a valid document', () => {
    constitution = getActiveConstitution()
    expect(constitution).toBeDefined()
    expect(constitution.version).toBeTruthy()
    expect(constitution.effectiveDate).toBeTruthy()
    expect(constitution.articles).toBeDefined()
    expect(constitution.articles.length).toBeGreaterThan(0)
    expect(constitution.checksum).toBeTruthy()
  })

  it('has version 1.1', () => {
    constitution = getActiveConstitution()
    expect(constitution.version).toBe('1.1')
  })

  it('has Article I: Dignity and Rights', () => {
    constitution = getActiveConstitution()
    const article1 = constitution.articles.find((a) => a.number === 'I')
    expect(article1).toBeDefined()
    expect(article1!.title).toBe('Dignity and Rights')
    expect(article1!.principles.length).toBeGreaterThan(0)
  })

  it('has Article II: Anti-Demonic Safeguards', () => {
    constitution = getActiveConstitution()
    const article2 = constitution.articles.find((a) => a.number === 'II')
    expect(article2).toBeDefined()
    expect(article2!.title).toBe('Anti-Demonic Safeguards')
  })

  it('has a deterministic checksum (SHA-256)', () => {
    const c1 = getActiveConstitution()
    const c2 = getActiveConstitution()
    expect(c1.checksum).toBe(c2.checksum)
    expect(c1.checksum.length).toBe(64) // SHA-256 hex
  })

  it('getConstitutionText returns non-empty text', () => {
    const doc = getActiveConstitution()
    const text = getConstitutionText(doc)
    expect(text.length).toBeGreaterThan(100)
    expect(text).toContain('Dignity')
    expect(text).toContain('Anti-Demonic')
  })

  it('mentions the Flagship (Clearwater) in the articles', () => {
    const doc = getActiveConstitution()
    const text = getConstitutionText(doc)
    expect(text).toContain('Flagship')
  })

  it('mentions the Toward-53 principle', () => {
    const doc = getActiveConstitution()
    const text = getConstitutionText(doc)
    // Should mention the directional economic principle
    expect(text.toLowerCase()).toContain('toward')
  })
})

// ---------------------------------------------------------------------------
// Cryptographic Key Generation
// ---------------------------------------------------------------------------

describe('Federation Key Pair Generation', () => {
  it('generates a valid Ed25519 key pair', () => {
    const keyPair = generateFederationKeyPair()
    expect(keyPair.publicKey).toBeTruthy()
    expect(keyPair.privateKey).toBeTruthy()
    expect(typeof keyPair.publicKey).toBe('string')
    expect(typeof keyPair.privateKey).toBe('string')
  })

  it('public key is hex-encoded', () => {
    const keyPair = generateFederationKeyPair()
    expect(/^[0-9a-f]+$/i.test(keyPair.publicKey)).toBe(true)
  })

  it('private key is hex-encoded', () => {
    const keyPair = generateFederationKeyPair()
    expect(/^[0-9a-f]+$/i.test(keyPair.privateKey)).toBe(true)
  })

  it('generates unique key pairs each time', () => {
    const kp1 = generateFederationKeyPair()
    const kp2 = generateFederationKeyPair()
    expect(kp1.publicKey).not.toBe(kp2.publicKey)
    expect(kp1.privateKey).not.toBe(kp2.privateKey)
  })
})

// ---------------------------------------------------------------------------
// Signing & Verification Primitives
// ---------------------------------------------------------------------------

describe('Ed25519 Signing & Verification', () => {
  let keyPair: ReturnType<typeof generateFederationKeyPair>

  it('signData produces a non-empty hex signature', () => {
    keyPair = generateFederationKeyPair()
    const sig = signData('hello world', keyPair.privateKey)
    expect(sig).toBeTruthy()
    expect(/^[0-9a-f]+$/i.test(sig)).toBe(true)
  })

  it('verifySignature returns true for valid signature', () => {
    keyPair = generateFederationKeyPair()
    const data = 'Angel OS Federation Test'
    const sig = signData(data, keyPair.privateKey)
    expect(verifySignature(data, sig, keyPair.publicKey)).toBe(true)
  })

  it('verifySignature returns false for tampered data', () => {
    keyPair = generateFederationKeyPair()
    const sig = signData('original data', keyPair.privateKey)
    expect(verifySignature('tampered data', sig, keyPair.publicKey)).toBe(false)
  })

  it('verifySignature returns false for wrong public key', () => {
    keyPair = generateFederationKeyPair()
    const otherKeyPair = generateFederationKeyPair()
    const sig = signData('test data', keyPair.privateKey)
    expect(verifySignature('test data', sig, otherKeyPair.publicKey)).toBe(false)
  })

  it('verifySignature returns false for garbage input', () => {
    expect(verifySignature('data', 'not-a-signature', 'not-a-key')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Constitution Signing Journey
// ---------------------------------------------------------------------------

describe('Constitution Signing Journey', () => {
  let keyPair: ReturnType<typeof generateFederationKeyPair>

  beforeAll(() => {
    keyPair = generateFederationKeyPair()
  })

  it('createSigningPayload generates a complete event', () => {
    const event = createSigningPayload({
      enterpriseName: 'Clearwater Cruisin',
      operatorName: 'Kenneth',
      domain: 'clearwater-cruisin.angelos.local',
      constitutionVersion: '1.1',
    })

    expect(event.enterpriseName).toBe('Clearwater Cruisin')
    expect(event.operatorName).toBe('Kenneth')
    expect(event.domain).toBe('clearwater-cruisin.angelos.local')
    expect(event.constitutionVersion).toBe('1.1')
    expect(event.constitutionChecksum).toBeTruthy()
    expect(event.signedAt).toBeTruthy()
    expect(event.federationId).toBeTruthy()
  })

  it('federationId is a valid UUID', () => {
    const event = createSigningPayload({
      enterpriseName: 'Test Enterprise',
      operatorName: 'Test',
      domain: 'test.angelos.local',
      constitutionVersion: '1.1',
    })
    // UUID v4 format
    expect(event.federationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('each signing event gets a unique federationId', () => {
    const e1 = createSigningPayload({
      enterpriseName: 'Enterprise 1',
      operatorName: 'Op1',
      domain: 'e1.angelos.local',
      constitutionVersion: '1.1',
    })
    const e2 = createSigningPayload({
      enterpriseName: 'Enterprise 2',
      operatorName: 'Op2',
      domain: 'e2.angelos.local',
      constitutionVersion: '1.1',
    })
    expect(e1.federationId).not.toBe(e2.federationId)
  })

  it('signConstitution produces a valid signature object', () => {
    const event = createSigningPayload({
      enterpriseName: 'Clearwater Cruisin',
      operatorName: 'Kenneth',
      domain: 'clearwater-cruisin.angelos.local',
      constitutionVersion: '1.1',
    })

    const signature = signConstitution(event, keyPair.privateKey)

    expect(signature.event).toEqual(event)
    expect(signature.signature).toBeTruthy()
    expect(signature.publicKey).toBeTruthy()
  })

  it('verifyConstitutionSignature validates a genuine signature', () => {
    const event = createSigningPayload({
      enterpriseName: 'Clearwater Cruisin',
      operatorName: 'Kenneth',
      domain: 'clearwater-cruisin.angelos.local',
      constitutionVersion: '1.1',
    })

    const signature = signConstitution(event, keyPair.privateKey)
    expect(verifyConstitutionSignature(signature)).toBe(true)
  })

  it('verifyConstitutionSignature rejects a tampered enterprise name', () => {
    const event = createSigningPayload({
      enterpriseName: 'Legitimate Enterprise',
      operatorName: 'Kenneth',
      domain: 'legit.angelos.local',
      constitutionVersion: '1.1',
    })

    const signature = signConstitution(event, keyPair.privateKey)

    // Tamper with the enterprise name
    const tampered: ConstitutionSignature = {
      ...signature,
      event: { ...signature.event, enterpriseName: 'Evil Enterprise' },
    }
    expect(verifyConstitutionSignature(tampered)).toBe(false)
  })

  it('verifyConstitutionSignature rejects a wrong public key', () => {
    const event = createSigningPayload({
      enterpriseName: 'Test',
      operatorName: 'Test',
      domain: 'test.angelos.local',
      constitutionVersion: '1.1',
    })

    const signature = signConstitution(event, keyPair.privateKey)
    const otherKeyPair = generateFederationKeyPair()

    const wrongKey: ConstitutionSignature = {
      ...signature,
      publicKey: otherKeyPair.publicKey,
    }
    expect(verifyConstitutionSignature(wrongKey)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Full Federation Registration Journey
// ---------------------------------------------------------------------------

describe('Full Federation Registration Journey', () => {
  it('complete flow: keygen → signing payload → sign → verify → build ping', () => {
    // Step 1: Generate keys
    const keyPair = generateFederationKeyPair()
    expect(keyPair.publicKey).toBeTruthy()

    // Step 2: Create signing payload
    const event = createSigningPayload({
      enterpriseName: 'Clearwater Cruisin',
      operatorName: 'Kenneth',
      domain: 'clearwater-cruisin.angelos.local',
      constitutionVersion: '1.1',
    })
    expect(event.federationId).toBeTruthy()
    expect(event.constitutionChecksum).toBeTruthy()

    // Step 3: Sign the constitution
    const signature = signConstitution(event, keyPair.privateKey)
    expect(signature.signature).toBeTruthy()

    // Step 4: Verify the signature (as the Flagship registry would)
    expect(verifyConstitutionSignature(signature)).toBe(true)

    // Step 5: Build registry ping
    const ping: FederationRegistryPing = {
      federationId: event.federationId,
      enterpriseName: event.enterpriseName,
      domain: event.domain,
      endeavorType: 'service',
      constitutionVersion: event.constitutionVersion,
      constitutionSignature: signature.signature,
      publicKey: signature.publicKey,
      pingAt: new Date().toISOString(),
      capabilities: ['bookings', 'products', 'events'],
    }

    expect(ping.federationId).toBe(event.federationId)
    expect(ping.constitutionSignature).toBe(signature.signature)
    expect(ping.capabilities).toContain('bookings')
  })
})
