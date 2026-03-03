/**
 * Federation Trust Guard — Unit Tests
 *
 * Tests pure functions: extractFederationHeaders, verifyTimestamp,
 * meetsTrustRequirement, verifyFederationSignature.
 *
 * verifyFederationRequest is integration-tested separately (requires rate limiter).
 */
import { describe, it, expect, vi } from 'vitest'

// Mock rateLimiter to prevent side effects from the module import
vi.mock('@/federation/rateLimiter', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 100, retryAfterSeconds: 0 }),
}))

import {
  extractFederationHeaders,
  verifyTimestamp,
  meetsTrustRequirement,
  verifyFederationSignature,
} from '@/federation/trustGuard'
import { generateFederationKeyPair, signData } from '@/federation/protocol'

// ── extractFederationHeaders ───────────────────────────────────────────────

describe('extractFederationHeaders', () => {
  function makeHeaders(overrides: Record<string, string> = {}): Headers {
    const base: Record<string, string> = {
      'x-federation-id': 'fed-uuid-001',
      'x-federation-signature': 'abc123',
      'x-federation-key': 'pubkey456',
      'x-federation-timestamp': new Date().toISOString(),
    }
    return new Headers({ ...base, ...overrides })
  }

  it('returns all four fields when all headers are present', () => {
    const result = extractFederationHeaders(makeHeaders())
    expect(result).not.toBeNull()
    expect(result!.federationId).toBe('fed-uuid-001')
    expect(result!.signature).toBe('abc123')
    expect(result!.publicKey).toBe('pubkey456')
    expect(typeof result!.timestamp).toBe('string')
  })

  it('returns null when x-federation-id is missing', () => {
    const headers = new Headers({
      'x-federation-signature': 'sig',
      'x-federation-key': 'key',
      'x-federation-timestamp': new Date().toISOString(),
    })
    expect(extractFederationHeaders(headers)).toBeNull()
  })

  it('returns null when x-federation-signature is missing', () => {
    const headers = new Headers({
      'x-federation-id': 'fed-001',
      'x-federation-key': 'key',
      'x-federation-timestamp': new Date().toISOString(),
    })
    expect(extractFederationHeaders(headers)).toBeNull()
  })

  it('returns null when x-federation-key is missing', () => {
    const headers = new Headers({
      'x-federation-id': 'fed-001',
      'x-federation-signature': 'sig',
      'x-federation-timestamp': new Date().toISOString(),
    })
    expect(extractFederationHeaders(headers)).toBeNull()
  })

  it('returns null when x-federation-timestamp is missing', () => {
    const headers = new Headers({
      'x-federation-id': 'fed-001',
      'x-federation-signature': 'sig',
      'x-federation-key': 'key',
    })
    expect(extractFederationHeaders(headers)).toBeNull()
  })

  it('returns null when all headers are missing', () => {
    expect(extractFederationHeaders(new Headers())).toBeNull()
  })
})

// ── verifyTimestamp ────────────────────────────────────────────────────────

describe('verifyTimestamp', () => {
  it('returns valid=true for a fresh timestamp (just now)', () => {
    const now = new Date().toISOString()
    const result = verifyTimestamp(now)
    expect(result.valid).toBe(true)
  })

  it('returns valid=true for a timestamp 2 minutes ago', () => {
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
    const result = verifyTimestamp(twoMinAgo)
    expect(result.valid).toBe(true)
  })

  it('returns valid=false for a timestamp 10 minutes ago (exceeds 5-minute window)', () => {
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const result = verifyTimestamp(tenMinAgo)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('expired')
  })

  it('returns valid=false for a timestamp 1 minute in the future (exceeds 30s skew)', () => {
    const oneMinFuture = new Date(Date.now() + 60 * 1000).toISOString()
    const result = verifyTimestamp(oneMinFuture)
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('future')
  })

  it('returns valid=true for a timestamp 10 seconds in the future (within clock skew)', () => {
    const tenSecFuture = new Date(Date.now() + 10 * 1000).toISOString()
    const result = verifyTimestamp(tenSecFuture)
    expect(result.valid).toBe(true)
  })

  it('returns valid=false for an invalid timestamp string', () => {
    const result = verifyTimestamp('not-a-timestamp')
    expect(result.valid).toBe(false)
    expect(result.reason).toContain('Invalid')
  })

  it('returns valid=false for an empty string', () => {
    const result = verifyTimestamp('')
    expect(result.valid).toBe(false)
  })

  it('includes reason in failure cases', () => {
    const result = verifyTimestamp('bad-input')
    expect(typeof result.reason).toBe('string')
  })
})

// ── meetsTrustRequirement ──────────────────────────────────────────────────

describe('meetsTrustRequirement', () => {
  it('"full" meets "full" requirement', () => {
    expect(meetsTrustRequirement('full', 'full')).toBe(true)
  })

  it('"full" meets "vouched" requirement', () => {
    expect(meetsTrustRequirement('full', 'vouched')).toBe(true)
  })

  it('"full" meets "probationary" requirement', () => {
    expect(meetsTrustRequirement('full', 'probationary')).toBe(true)
  })

  it('"full" meets "none" requirement', () => {
    expect(meetsTrustRequirement('full', 'none')).toBe(true)
  })

  it('"vouched" meets "probationary" requirement', () => {
    expect(meetsTrustRequirement('vouched', 'probationary')).toBe(true)
  })

  it('"vouched" does NOT meet "full" requirement', () => {
    expect(meetsTrustRequirement('vouched', 'full')).toBe(false)
  })

  it('"probationary" meets "probationary" requirement', () => {
    expect(meetsTrustRequirement('probationary', 'probationary')).toBe(true)
  })

  it('"probationary" does NOT meet "vouched" requirement', () => {
    expect(meetsTrustRequirement('probationary', 'vouched')).toBe(false)
  })

  it('"none" does NOT meet "probationary" requirement', () => {
    expect(meetsTrustRequirement('none', 'probationary')).toBe(false)
  })

  it('"none" meets "none" requirement', () => {
    expect(meetsTrustRequirement('none', 'none')).toBe(true)
  })
})

// ── verifyFederationSignature ──────────────────────────────────────────────

describe('verifyFederationSignature', () => {
  it('returns true for a valid timestamp+body signature', () => {
    const { publicKey, privateKey } = generateFederationKeyPair()
    const timestamp = new Date().toISOString()
    const body = JSON.stringify({ hello: 'federation' })
    const signable = `${timestamp}\n${body}`
    const signature = signData(signable, privateKey)

    expect(verifyFederationSignature(timestamp, body, signature, publicKey)).toBe(true)
  })

  it('returns false when body is tampered', () => {
    const { publicKey, privateKey } = generateFederationKeyPair()
    const timestamp = new Date().toISOString()
    const body = JSON.stringify({ hello: 'federation' })
    const signable = `${timestamp}\n${body}`
    const signature = signData(signable, privateKey)

    expect(verifyFederationSignature(timestamp, '{"tampered":true}', signature, publicKey)).toBe(false)
  })

  it('returns false when timestamp is different from what was signed', () => {
    const { publicKey, privateKey } = generateFederationKeyPair()
    const timestamp = new Date().toISOString()
    const body = '{"test":1}'
    const signable = `${timestamp}\n${body}`
    const signature = signData(signable, privateKey)
    const differentTimestamp = new Date(Date.now() + 1000).toISOString()

    expect(verifyFederationSignature(differentTimestamp, body, signature, publicKey)).toBe(false)
  })
})
