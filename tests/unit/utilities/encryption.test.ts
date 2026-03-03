/**
 * encryption — Unit Tests
 *
 * encrypt, decrypt, safeDecrypt, isEncrypted, hash, generateSecureToken
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { encrypt, decrypt, safeDecrypt, isEncrypted, hash, generateSecureToken } from '@/utilities/encryption'

describe('encrypt / decrypt', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_SECRET = 'test-encryption-secret-for-unit-tests'
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_SECRET
  })

  it('returns a non-empty hex string', () => {
    const result = encrypt('hello world')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
    expect(/^[0-9a-f]+$/i.test(result)).toBe(true)
  })

  it('round-trips a simple string', () => {
    const plaintext = 'hello world'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('round-trips a complex string with special characters', () => {
    const plaintext = 'token=abc&secret=xyz!@#$%'
    expect(decrypt(encrypt(plaintext))).toBe(plaintext)
  })

  it('produces different ciphertext for the same input (random IV)', () => {
    const a = encrypt('same input')
    const b = encrypt('same input')
    expect(a).not.toBe(b) // different random IVs
  })

  it('returns empty string unchanged when encrypting empty string', () => {
    expect(encrypt('')).toBe('')
  })

  it('returns empty string unchanged when decrypting empty string', () => {
    expect(decrypt('')).toBe('')
  })

  it('throws when ENCRYPTION_SECRET is not set', () => {
    delete process.env.ENCRYPTION_SECRET
    delete process.env.PAYLOAD_SECRET
    expect(() => encrypt('test')).toThrow()
  })
})

describe('safeDecrypt', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_SECRET = 'test-encryption-secret-for-unit-tests'
  })

  afterEach(() => {
    delete process.env.ENCRYPTION_SECRET
  })

  it('returns the decrypted value for valid ciphertext', () => {
    const ciphertext = encrypt('my secret token')
    expect(safeDecrypt(ciphertext)).toBe('my secret token')
  })

  it('returns null for invalid ciphertext', () => {
    expect(safeDecrypt('not-valid-hex-garbage')).toBeNull()
  })

  it('returns null when secret is missing', () => {
    delete process.env.ENCRYPTION_SECRET
    delete process.env.PAYLOAD_SECRET
    expect(safeDecrypt('deadbeef')).toBeNull()
  })
})

describe('isEncrypted', () => {
  it('returns false for an empty string', () => {
    expect(isEncrypted('')).toBe(false)
  })

  it('returns false for a short hex string (below IV+tag minimum)', () => {
    expect(isEncrypted('deadbeef')).toBe(false)
  })

  it('returns false for a non-hex string', () => {
    expect(isEncrypted('not-hex-at-all!')).toBe(false)
  })

  it('returns true for a long hex string that looks like ciphertext', () => {
    // IV (16 bytes = 32 hex) + tag (16 bytes = 32 hex) + at least 1 byte data = 65 hex chars
    const fakeCiphertext = 'a'.repeat(70)
    expect(isEncrypted(fakeCiphertext)).toBe(true)
  })
})

describe('hash', () => {
  it('returns a 64-character hex string (SHA-256)', () => {
    const result = hash('hello')
    expect(result).toHaveLength(64)
    expect(/^[0-9a-f]+$/.test(result)).toBe(true)
  })

  it('is deterministic for the same input', () => {
    expect(hash('test-input')).toBe(hash('test-input'))
  })

  it('produces different hashes for different inputs', () => {
    expect(hash('foo')).not.toBe(hash('bar'))
  })
})

describe('generateSecureToken', () => {
  it('returns a hex string of default length 64 (32 bytes)', () => {
    const token = generateSecureToken()
    expect(token).toHaveLength(64)
    expect(/^[0-9a-f]+$/.test(token)).toBe(true)
  })

  it('returns a hex string of the requested byte length', () => {
    const token = generateSecureToken(16)
    expect(token).toHaveLength(32) // 16 bytes = 32 hex chars
  })

  it('produces unique tokens on each call', () => {
    expect(generateSecureToken()).not.toBe(generateSecureToken())
  })
})
