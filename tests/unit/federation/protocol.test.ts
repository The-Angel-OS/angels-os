/**
 * Federation Protocol — Unit Tests
 *
 * Tests cryptographic signing and registry helpers.
 * Pure Node.js crypto — no mocks required.
 */
import { describe, it, expect } from 'vitest'

import {
  generateFederationKeyPair,
  signData,
  verifySignature,
  signConstitution,
  verifyConstitutionSignature,
  createSigningPayload,
  stubRegistryResponse,
  getConstitutionSigningIntroduction,
  type ConstitutionSigningEvent,
} from '@/federation/protocol'

// ── generateFederationKeyPair ──────────────────────────────────────────────

describe('generateFederationKeyPair', () => {
  it('returns an object with publicKey and privateKey', () => {
    const pair = generateFederationKeyPair()
    expect(pair).toHaveProperty('publicKey')
    expect(pair).toHaveProperty('privateKey')
  })

  it('returns hex-encoded strings', () => {
    const { publicKey, privateKey } = generateFederationKeyPair()
    expect(publicKey).toMatch(/^[0-9a-f]+$/i)
    expect(privateKey).toMatch(/^[0-9a-f]+$/i)
  })

  it('generates a non-empty key pair', () => {
    const { publicKey, privateKey } = generateFederationKeyPair()
    expect(publicKey.length).toBeGreaterThan(0)
    expect(privateKey.length).toBeGreaterThan(0)
  })

  it('generates different key pairs on each call', () => {
    const pair1 = generateFederationKeyPair()
    const pair2 = generateFederationKeyPair()
    expect(pair1.publicKey).not.toBe(pair2.publicKey)
    expect(pair1.privateKey).not.toBe(pair2.privateKey)
  })
})

// ── signData / verifySignature ─────────────────────────────────────────────

describe('signData + verifySignature', () => {
  it('produces a valid signature verifiable with the correct public key', () => {
    const { publicKey, privateKey } = generateFederationKeyPair()
    const data = 'Hello, federation!'
    const sig = signData(data, privateKey)
    expect(verifySignature(data, sig, publicKey)).toBe(true)
  })

  it('returns false when data is different from what was signed', () => {
    const { publicKey, privateKey } = generateFederationKeyPair()
    const sig = signData('original data', privateKey)
    expect(verifySignature('tampered data', sig, publicKey)).toBe(false)
  })

  it('returns false when the public key is from a different key pair', () => {
    const { privateKey } = generateFederationKeyPair()
    const { publicKey: wrongPublicKey } = generateFederationKeyPair()
    const sig = signData('test', privateKey)
    expect(verifySignature('test', sig, wrongPublicKey)).toBe(false)
  })

  it('returns false for a corrupted signature', () => {
    const { publicKey, privateKey } = generateFederationKeyPair()
    const sig = signData('test', privateKey)
    const corrupted = sig.slice(0, -4) + 'dead'
    expect(verifySignature('test', corrupted, publicKey)).toBe(false)
  })

  it('returns false for completely invalid hex in signature', () => {
    const { publicKey } = generateFederationKeyPair()
    expect(verifySignature('test', 'not-hex-at-all', publicKey)).toBe(false)
  })

  it('handles empty string data', () => {
    const { publicKey, privateKey } = generateFederationKeyPair()
    const sig = signData('', privateKey)
    expect(verifySignature('', sig, publicKey)).toBe(true)
    expect(verifySignature(' ', sig, publicKey)).toBe(false)
  })
})

// ── signConstitution / verifyConstitutionSignature ─────────────────────────

describe('signConstitution + verifyConstitutionSignature', () => {
  function makeEvent(): ConstitutionSigningEvent {
    return {
      enterpriseName: 'Test Corp',
      operatorName: 'Alice',
      domain: 'test.example.com',
      constitutionVersion: '1.1',
      constitutionChecksum: 'abc123',
      signedAt: new Date().toISOString(),
      federationId: 'fed-uuid-1234',
    }
  }

  it('produces a signature verified by verifyConstitutionSignature', () => {
    const { privateKey } = generateFederationKeyPair()
    const event = makeEvent()
    const constitutionSig = signConstitution(event, privateKey)
    expect(verifyConstitutionSignature(constitutionSig)).toBe(true)
  })

  it('returns the event unchanged in the ConstitutionSignature', () => {
    const { privateKey } = generateFederationKeyPair()
    const event = makeEvent()
    const constitutionSig = signConstitution(event, privateKey)
    expect(constitutionSig.event).toEqual(event)
  })

  it('includes a publicKey field in the ConstitutionSignature', () => {
    const { privateKey } = generateFederationKeyPair()
    const constitutionSig = signConstitution(makeEvent(), privateKey)
    expect(constitutionSig.publicKey).toMatch(/^[0-9a-f]+$/i)
    expect(constitutionSig.publicKey.length).toBeGreaterThan(0)
  })

  it('returns false for a tampered event', () => {
    const { privateKey } = generateFederationKeyPair()
    const constitutionSig = signConstitution(makeEvent(), privateKey)
    const tampered = {
      ...constitutionSig,
      event: { ...constitutionSig.event, enterpriseName: 'Evil Corp' },
    }
    expect(verifyConstitutionSignature(tampered)).toBe(false)
  })
})

// ── createSigningPayload ───────────────────────────────────────────────────

describe('createSigningPayload', () => {
  it('returns a ConstitutionSigningEvent with required fields', () => {
    const payload = createSigningPayload({
      enterpriseName: 'Acme',
      operatorName: 'Bob',
      domain: 'acme.example.com',
      constitutionVersion: '1.1',
    })
    expect(payload.enterpriseName).toBe('Acme')
    expect(payload.operatorName).toBe('Bob')
    expect(payload.domain).toBe('acme.example.com')
  })

  it('generates a UUID federationId', () => {
    const payload = createSigningPayload({
      enterpriseName: 'Test',
      operatorName: 'Op',
      domain: 'test.example.com',
      constitutionVersion: '1.1',
    })
    expect(payload.federationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    )
  })

  it('includes constitutionChecksum from the active constitution', () => {
    const payload = createSigningPayload({
      enterpriseName: 'Test',
      operatorName: 'Op',
      domain: 'test.example.com',
      constitutionVersion: '1.1',
    })
    expect(typeof payload.constitutionChecksum).toBe('string')
    expect(payload.constitutionChecksum.length).toBeGreaterThan(0)
  })

  it('sets signedAt to a valid ISO 8601 timestamp', () => {
    const before = Date.now()
    const payload = createSigningPayload({
      enterpriseName: 'Test',
      operatorName: 'Op',
      domain: 'test.example.com',
      constitutionVersion: '1.1',
    })
    const after = Date.now()
    const signedTime = new Date(payload.signedAt).getTime()
    expect(signedTime).toBeGreaterThanOrEqual(before)
    expect(signedTime).toBeLessThanOrEqual(after)
  })
})

// ── stubRegistryResponse ───────────────────────────────────────────────────

describe('stubRegistryResponse', () => {
  it('returns success: true', () => {
    const result = stubRegistryResponse('fed-123', 'My Enterprise')
    expect(result.success).toBe(true)
  })

  it('includes the federationId', () => {
    const result = stubRegistryResponse('fed-abc', 'Test Corp')
    expect(result.federationId).toBe('fed-abc')
  })

  it('sets registryId with local- prefix', () => {
    const result = stubRegistryResponse('fed-abc123', 'Test Corp')
    expect(result.registryId).toMatch(/^local-/)
  })

  it('includes the enterprise name in the message', () => {
    const result = stubRegistryResponse('fed-123', 'Clearwater')
    expect(result.message).toContain('Clearwater')
  })

  it('sets ministryStatus to applicant', () => {
    const result = stubRegistryResponse('fed-123', 'Test')
    expect(result.ministryStatus).toBe('applicant')
  })
})

// ── getConstitutionSigningIntroduction ─────────────────────────────────────

describe('getConstitutionSigningIntroduction', () => {
  it('includes the enterprise name in the introduction', () => {
    const intro = getConstitutionSigningIntroduction('Clearwater Inc')
    expect(intro).toContain('Clearwater Inc')
  })

  it('mentions the constitution version', () => {
    const intro = getConstitutionSigningIntroduction('Test Corp')
    expect(intro).toContain('1.1')
  })

  it('mentions key constitutional principles', () => {
    const intro = getConstitutionSigningIntroduction('Acme')
    expect(intro).toContain('Suitcase Principle')
    expect(intro).toContain('Toward-53')
  })

  it('includes acceptance instruction', () => {
    const intro = getConstitutionSigningIntroduction('Acme')
    expect(intro).toContain('I accept the Angel OS Constitution on behalf of Acme')
  })

  it('returns a non-empty string', () => {
    const intro = getConstitutionSigningIntroduction('Test')
    expect(typeof intro).toBe('string')
    expect(intro.length).toBeGreaterThan(100)
  })
})
