import { describe, it, expect } from 'vitest'
import { isTestEmail, classifyAccount, isCleanupEligible } from '@/utilities/accountAudit'

const FOUNDERS = new Set(['kenneth.courtney@gmail.com', 'clearwatercruisin@gmail.com'])

describe('accountAudit', () => {
  describe('isTestEmail', () => {
    it('recognizes the reserved test domain and plus-tags', () => {
      expect(isTestEmail('anyone@test.angel-os.local')).toBe(true)
      expect(isTestEmail('qa+test@example.com')).toBe(true)
      expect(isTestEmail('qa+e2e-run3@example.com')).toBe(true)
    })
    it('does not flag normal emails', () => {
      expect(isTestEmail('kenneth.courtney@gmail.com')).toBe(false)
      expect(isTestEmail('billthecat1022@gmail.com')).toBe(false)
      expect(isTestEmail('')).toBe(false)
      expect(isTestEmail(null)).toBe(false)
    })
  })

  describe('classifyAccount', () => {
    const member = new Set(['5'])
    it('protects system users first', () => {
      expect(classifyAccount({ id: 1, email: 'qa+test@x.com', isSystemUser: true }, FOUNDERS, member)).toBe('system')
    })
    it('protects founders by email and super_admins by role', () => {
      expect(classifyAccount({ id: 2, email: 'kenneth.courtney@gmail.com' }, FOUNDERS, member)).toBe('founder')
      expect(classifyAccount({ id: 3, email: 'x@y.com', roles: ['super_admin'] }, FOUNDERS, member)).toBe('founder')
    })
    it('classifies test, member, orphan', () => {
      expect(classifyAccount({ id: 4, email: 'qa+test@x.com' }, FOUNDERS, member)).toBe('test')
      expect(classifyAccount({ id: 5, email: 'real@x.com' }, FOUNDERS, member)).toBe('member')
      expect(classifyAccount({ id: 9, email: 'nobody@x.com' }, FOUNDERS, member)).toBe('orphan')
    })
    it('system/founder win even over membership', () => {
      expect(classifyAccount({ id: 5, email: 'x@y.com', roles: ['super_admin'] }, FOUNDERS, member)).toBe('founder')
    })
  })

  describe('isCleanupEligible', () => {
    it('only orphan and test are eligible', () => {
      expect(isCleanupEligible('orphan')).toBe(true)
      expect(isCleanupEligible('test')).toBe(true)
      expect(isCleanupEligible('member')).toBe(false)
      expect(isCleanupEligible('founder')).toBe(false)
      expect(isCleanupEligible('system')).toBe(false)
    })
  })
})
