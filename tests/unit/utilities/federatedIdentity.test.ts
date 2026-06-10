import { describe, it, expect } from 'vitest'
import {
  computeFederatedIdentityId,
  normalizeEmail,
} from '@/utilities/federatedIdentity'

describe('federatedIdentity', () => {
  describe('normalizeEmail', () => {
    it('trims and lowercases', () => {
      expect(normalizeEmail('  Kenneth.Courtney@Gmail.com ')).toBe('kenneth.courtney@gmail.com')
    })
    it('handles empty/undefined safely', () => {
      expect(normalizeEmail('')).toBe('')
      // @ts-expect-error — exercising the null-guard
      expect(normalizeEmail(undefined)).toBe('')
    })
  })

  describe('computeFederatedIdentityId', () => {
    it('is deterministic — same email always yields the same id', () => {
      const a = computeFederatedIdentityId('billthecat1022@gmail.com')
      const b = computeFederatedIdentityId('billthecat1022@gmail.com')
      expect(a).toBe(b)
      expect(a).not.toBe('')
    })

    it('is case/whitespace insensitive (the cross-node coherence guarantee)', () => {
      const canonical = computeFederatedIdentityId('kenneth.courtney@gmail.com')
      expect(computeFederatedIdentityId('  Kenneth.Courtney@GMAIL.com  ')).toBe(canonical)
    })

    it('yields distinct ids for distinct people', () => {
      const ids = [
        'kenneth.courtney@gmail.com',
        'clearwatercruisin@gmail.com',
        'tylersuzanne84@gmail.com',
        'billthecat1022@gmail.com',
      ].map(computeFederatedIdentityId)
      expect(new Set(ids).size).toBe(4)
    })

    it('is UUID-shaped (8-4-4-4-12)', () => {
      const id = computeFederatedIdentityId('kenneth.courtney@gmail.com')
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/)
    })

    it('returns empty string for invalid/empty email (no identity to derive)', () => {
      expect(computeFederatedIdentityId('')).toBe('')
      expect(computeFederatedIdentityId('not-an-email')).toBe('')
    })
  })
})
