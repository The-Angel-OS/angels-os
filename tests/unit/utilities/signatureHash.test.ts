import { describe, it, expect } from 'vitest'
import {
  hashSignature,
  checksumDocument,
  verifySignature,
  type SignatureContent,
} from '@/utilities/signatureHash'

const base: SignatureContent = {
  signerName: 'Jane Q. Renter',
  signerUserId: 42,
  documentRef: 'booking:7',
  documentChecksum: checksumDocument('You agree to return the kayak by 5pm.'),
  signatureType: 'typed',
  signatureData: 'Jane Q. Renter',
  signedAt: '2026-06-13T12:00:00.000Z',
}

describe('signatureHash', () => {
  it('produces a stable 64-char hex SHA-256', () => {
    const h = hashSignature(base)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(hashSignature(base)).toBe(h) // deterministic
  })

  it('verifies an intact signature', () => {
    const h = hashSignature(base)
    expect(verifySignature(base, h)).toBe(true)
  })

  it('detects tampering with the signer name', () => {
    const h = hashSignature(base)
    expect(verifySignature({ ...base, signerName: 'Someone Else' }, h)).toBe(false)
  })

  it('detects tampering with the document terms (checksum)', () => {
    const h = hashSignature(base)
    const altered = { ...base, documentChecksum: checksumDocument('You agree to return the kayak by 9pm.') }
    expect(verifySignature(altered, h)).toBe(false)
  })

  it('detects tampering with the captured mark', () => {
    const h = hashSignature(base)
    expect(verifySignature({ ...base, signatureData: 'forged' }, h)).toBe(false)
  })

  it('detects tampering with the timestamp', () => {
    const h = hashSignature(base)
    expect(verifySignature({ ...base, signedAt: '2020-01-01T00:00:00.000Z' }, h)).toBe(false)
  })

  it('binds the signer identity — anonymous vs known differ', () => {
    const anon = hashSignature({ ...base, signerUserId: null })
    const known = hashSignature({ ...base, signerUserId: 42 })
    expect(anon).not.toBe(known)
  })

  it('round-trips when numerics arrive as strings (Postgres read shape)', () => {
    // signerUserId may come back as a string from the DB; the hash must match.
    const written = hashSignature({ ...base, signerUserId: 42 })
    const read = hashSignature({ ...base, signerUserId: '42' })
    expect(read).toBe(written)
  })

  it('checksumDocument is stable and content-sensitive', () => {
    expect(checksumDocument('abc')).toBe(checksumDocument('abc'))
    expect(checksumDocument('abc')).not.toBe(checksumDocument('abd'))
    expect(checksumDocument('abc')).toMatch(/^[0-9a-f]{64}$/)
  })
})
