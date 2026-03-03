/**
 * angelOSSDK — Unit Tests
 *
 * Tests the pure static utility methods on AngelOSUtils and
 * basic AngelOSClient construction (no HTTP calls made).
 */
import { describe, it, expect } from 'vitest'

import { AngelOSUtils, AngelOSClient } from '@/utilities/angelOSSDK'

// ── AngelOSUtils.getTenantFromDomain ─────────────────────────────────────────

describe('AngelOSUtils.getTenantFromDomain', () => {
  it('returns "default" for localhost', () => {
    expect(AngelOSUtils.getTenantFromDomain('localhost')).toBe('default')
  })

  it('returns "default" for 127.0.0.1', () => {
    expect(AngelOSUtils.getTenantFromDomain('127.0.0.1')).toBe('default')
  })

  it('extracts subdomain from three-part domain', () => {
    expect(AngelOSUtils.getTenantFromDomain('mystore.angelos.app')).toBe('mystore')
  })

  it('extracts first part from two-part domain', () => {
    expect(AngelOSUtils.getTenantFromDomain('mystore.com')).toBe('mystore')
  })

  it('extracts first subdomain from deeper domain', () => {
    expect(AngelOSUtils.getTenantFromDomain('tenant.sub.example.com')).toBe('tenant')
  })
})

// ── AngelOSUtils.generateConversationId ──────────────────────────────────────

describe('AngelOSUtils.generateConversationId', () => {
  it('returns a string starting with "conv_"', () => {
    const id = AngelOSUtils.generateConversationId()
    expect(id.startsWith('conv_')).toBe(true)
  })

  it('generates unique IDs on each call', () => {
    const ids = new Set(Array.from({ length: 10 }, () => AngelOSUtils.generateConversationId()))
    expect(ids.size).toBe(10)
  })

  it('returns a non-empty string', () => {
    expect(AngelOSUtils.generateConversationId().length).toBeGreaterThan(5)
  })
})

// ── AngelOSUtils.formatCurrency ───────────────────────────────────────────────

describe('AngelOSUtils.formatCurrency', () => {
  it('formats USD by default', () => {
    const formatted = AngelOSUtils.formatCurrency(1234.56)
    expect(formatted).toContain('1,234')
  })

  it('includes currency symbol', () => {
    const formatted = AngelOSUtils.formatCurrency(50, 'USD')
    expect(formatted).toContain('$')
  })

  it('handles zero', () => {
    const formatted = AngelOSUtils.formatCurrency(0)
    expect(formatted).toContain('0')
  })

  it('handles large amounts', () => {
    const formatted = AngelOSUtils.formatCurrency(1000000)
    expect(formatted).toContain('1,000,000')
  })
})

// ── AngelOSUtils.getDateRange ─────────────────────────────────────────────────

describe('AngelOSUtils.getDateRange', () => {
  it('returns an object with start and end dates', () => {
    const range = AngelOSUtils.getDateRange()
    expect(range.start).toBeInstanceOf(Date)
    expect(range.end).toBeInstanceOf(Date)
  })

  it('end is after start', () => {
    const { start, end } = AngelOSUtils.getDateRange()
    expect(end.getTime()).toBeGreaterThan(start.getTime())
  })

  it('end is approximately N days after start', () => {
    const days = 30
    const { start, end } = AngelOSUtils.getDateRange(days)
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeGreaterThanOrEqual(days - 1)
    expect(diffDays).toBeLessThanOrEqual(days + 1)
  })

  it('accepts custom day count', () => {
    const { start, end } = AngelOSUtils.getDateRange(7)
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    expect(diffDays).toBeGreaterThanOrEqual(6)
    expect(diffDays).toBeLessThanOrEqual(8)
  })
})

// ── AngelOSClient ─────────────────────────────────────────────────────────────

describe('AngelOSClient', () => {
  it('can be instantiated with config', () => {
    const client = new AngelOSClient({
      baseUrl: 'https://test.example.com',
      tenantSlug: 'test-tenant',
    })
    expect(client).toBeDefined()
  })

  it('exposes leo, bookings, projects, posts, payments module references', () => {
    const client = new AngelOSClient({
      baseUrl: 'https://test.example.com',
      tenantSlug: 'test-tenant',
    })
    expect(client.leo).toBeDefined()
    expect(client.bookings).toBeDefined()
    expect(client.projects).toBeDefined()
    expect(client.posts).toBeDefined()
    expect(client.payments).toBeDefined()
  })
})
