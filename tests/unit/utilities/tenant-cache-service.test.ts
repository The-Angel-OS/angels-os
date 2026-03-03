/**
 * tenant-cache-service — Unit Tests
 *
 * Tests pure/synchronous functions: clearTenantCache, getCacheStatus
 */
import { describe, it, expect, vi } from 'vitest'

import {
  clearTenantCache,
  getCacheStatus,
} from '@/utilities/tenant-cache-service'

// ── getCacheStatus ────────────────────────────────────────────────────────────

describe('getCacheStatus', () => {
  it('returns empty status when cache has not been loaded', () => {
    // The module-level cache starts as null
    clearTenantCache()
    const status = getCacheStatus()
    expect(status.status).toBe('empty')
  })

  it('returns size 0 when empty', () => {
    clearTenantCache()
    const status = getCacheStatus()
    expect(status.size).toBe(0)
  })

  it('returns age 0 when empty', () => {
    clearTenantCache()
    const status = getCacheStatus()
    expect(status.age).toBe(0)
  })

  it('returns an object with status, age, and size fields', () => {
    clearTenantCache()
    const status = getCacheStatus()
    expect(status).toHaveProperty('status')
    expect(status).toHaveProperty('age')
    expect(status).toHaveProperty('size')
  })
})

// ── clearTenantCache ──────────────────────────────────────────────────────────

describe('clearTenantCache', () => {
  it('does not throw', () => {
    expect(() => clearTenantCache()).not.toThrow()
  })

  it('results in empty status after clearing', () => {
    clearTenantCache()
    const status = getCacheStatus()
    expect(status.status).toBe('empty')
    expect(status.size).toBe(0)
  })

  it('is idempotent — can be called multiple times', () => {
    expect(() => {
      clearTenantCache()
      clearTenantCache()
      clearTenantCache()
    }).not.toThrow()
  })
})
