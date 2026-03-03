/**
 * leoEmail — Unit Tests
 *
 * leoSystemUserEmail and leoLegacyEmail utilities for generating
 * deterministic email addresses for LEO system users per tenant.
 */
import { describe, it, expect } from 'vitest'

import { leoSystemUserEmail, leoLegacyEmail } from '@/utilities/leoEmail'

describe('leoSystemUserEmail', () => {
  it('generates email in leo-{slug}@system.spacesangels.com format', () => {
    expect(leoSystemUserEmail('clearwater')).toBe('leo-clearwater@system.spacesangels.com')
  })

  it('generates email for different slugs', () => {
    expect(leoSystemUserEmail('kendev')).toBe('leo-kendev@system.spacesangels.com')
  })

  it('uses the canonical system domain', () => {
    const email = leoSystemUserEmail('test-tenant')
    expect(email).toContain('@system.spacesangels.com')
  })

  it('uses the tenant slug as prefix', () => {
    const email = leoSystemUserEmail('my-org')
    expect(email.startsWith('leo-my-org@')).toBe(true)
  })
})

describe('leoLegacyEmail', () => {
  it('generates email in leo-{slug}@system.angelos.local format', () => {
    expect(leoLegacyEmail('clearwater')).toBe('leo-clearwater@system.angelos.local')
  })

  it('generates email for different slugs', () => {
    expect(leoLegacyEmail('kendev')).toBe('leo-kendev@system.angelos.local')
  })

  it('uses the legacy system domain', () => {
    const email = leoLegacyEmail('test-tenant')
    expect(email).toContain('@system.angelos.local')
  })

  it('produces different email than leoSystemUserEmail for same slug', () => {
    const slug = 'clearwater'
    expect(leoLegacyEmail(slug)).not.toBe(leoSystemUserEmail(slug))
  })
})
