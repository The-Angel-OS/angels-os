/**
 * getTenant utilities — Unit Tests
 *
 * Pure functions (userBelongsToTenant, getTenantConfig, isTenantFeatureEnabled)
 * are tested without mocks.
 * Async functions (getTenantBySubdomain, getTenantBySlug) use mocked payload.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ──────────────────────────────────────────────────────────────────────

vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
// next/headers is only used by getCurrentTenant which we skip here
vi.mock('next/headers', () => ({ headers: vi.fn() }))

import {
  userBelongsToTenant,
  getTenantConfig,
  isTenantFeatureEnabled,
  getTenantBySubdomain,
  getTenantBySlug,
  type TenantWithTypedRefs,
} from '@/utilities/getTenant'
import { getPayload } from 'payload'

const mockGetPayload = vi.mocked(getPayload)

// ── Helpers ─────────────────────────────────────────────────────────────────

function makePayload(findReturn: { docs: unknown[] }) {
  return { find: vi.fn().mockResolvedValue(findReturn) } as any
}

function makeTenant(overrides: Partial<TenantWithTypedRefs> = {}): TenantWithTypedRefs {
  return {
    id: 1,
    name: 'Test Tenant',
    slug: 'test',
    businessType: 'retail',
    status: 'active',
    ...overrides,
  }
}

// ── userBelongsToTenant ────────────────────────────────────────────────────

describe('userBelongsToTenant', () => {
  it('returns true when userTenantId matches tenantId', () => {
    expect(userBelongsToTenant(1, 5, 5)).toBe(true)
  })

  it('returns false when userTenantId does not match', () => {
    expect(userBelongsToTenant(1, 5, 9)).toBe(false)
  })

  it('returns false when userTenantId is undefined', () => {
    expect(userBelongsToTenant(1, 5, undefined)).toBe(false)
  })
})

// ── getTenantConfig ────────────────────────────────────────────────────────

describe('getTenantConfig', () => {
  it('returns defaults when tenant is null', () => {
    const config = getTenantConfig(null)
    expect(config.primaryColor).toBe('#3b82f6')
    expect(config.name).toBe('Spaces Commerce')
    expect(config.logo).toBeNull()
    expect(config.contactEmail).toBe('support@kendev.co')
  })

  it('returns tenant name when tenant is provided', () => {
    const config = getTenantConfig(makeTenant({ name: 'Acme Corp' }))
    expect(config.name).toBe('Acme Corp')
  })

  it('falls back to default color when configuration.primaryColor is not set', () => {
    const config = getTenantConfig(makeTenant({ configuration: {} }))
    expect(config.primaryColor).toBe('#3b82f6')
  })

  it('uses tenant primaryColor when set', () => {
    const config = getTenantConfig(
      makeTenant({ configuration: { primaryColor: '#ff0000' } }),
    )
    expect(config.primaryColor).toBe('#ff0000')
  })

  it('includes address when set', () => {
    const config = getTenantConfig(
      makeTenant({
        configuration: {
          address: { city: 'Clearwater', state: 'FL', country: 'US', street: null, zipCode: null },
        },
      }),
    )
    expect(config.address?.city).toBe('Clearwater')
  })

  it('falls back to default contactEmail when not set', () => {
    const config = getTenantConfig(makeTenant({ configuration: { contactEmail: null } }))
    expect(config.contactEmail).toBe('support@kendev.co')
  })
})

// ── isTenantFeatureEnabled ─────────────────────────────────────────────────

describe('isTenantFeatureEnabled', () => {
  it('returns false when tenant is null', () => {
    expect(isTenantFeatureEnabled(null, 'ecommerce')).toBe(false)
  })

  it('returns false when features is undefined', () => {
    expect(isTenantFeatureEnabled(makeTenant(), 'ecommerce')).toBe(false)
  })

  it('returns false when feature is explicitly false', () => {
    const tenant = makeTenant({ features: { ecommerce: false } })
    expect(isTenantFeatureEnabled(tenant, 'ecommerce')).toBe(false)
  })

  it('returns true when feature is enabled', () => {
    const tenant = makeTenant({ features: { ecommerce: true } })
    expect(isTenantFeatureEnabled(tenant, 'ecommerce')).toBe(true)
  })

  it('returns false for a different disabled feature', () => {
    const tenant = makeTenant({ features: { spaces: true, crm: false } })
    expect(isTenantFeatureEnabled(tenant, 'crm')).toBe(false)
    expect(isTenantFeatureEnabled(tenant, 'spaces')).toBe(true)
  })
})

// ── getTenantBySubdomain ───────────────────────────────────────────────────

describe('getTenantBySubdomain', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns null when no tenant found', async () => {
    mockGetPayload.mockResolvedValue(makePayload({ docs: [] }))
    const result = await getTenantBySubdomain('unknown')
    expect(result).toBeNull()
  })

  it('returns tenant when found by subdomain', async () => {
    const tenant = makeTenant({ id: 7, slug: 'acme' })
    mockGetPayload.mockResolvedValue(makePayload({ docs: [tenant] }))
    const result = await getTenantBySubdomain('acme')
    expect(result?.id).toBe(7)
  })

  it('returns null when payload.find throws', async () => {
    mockGetPayload.mockResolvedValue({
      find: vi.fn().mockRejectedValue(new Error('DB fail')),
    } as any)
    const result = await getTenantBySubdomain('acme')
    expect(result).toBeNull()
  })
})

// ── getTenantBySlug ────────────────────────────────────────────────────────

describe('getTenantBySlug', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns null when no tenant found', async () => {
    mockGetPayload.mockResolvedValue(makePayload({ docs: [] }))
    const result = await getTenantBySlug('missing-slug')
    expect(result).toBeNull()
  })

  it('returns tenant when found by slug', async () => {
    const tenant = makeTenant({ id: 3, slug: 'beta-co' })
    mockGetPayload.mockResolvedValue(makePayload({ docs: [tenant] }))
    const result = await getTenantBySlug('beta-co')
    expect(result?.slug).toBe('beta-co')
  })

  it('returns null when payload.find throws', async () => {
    mockGetPayload.mockResolvedValue({
      find: vi.fn().mockRejectedValue(new Error('DB fail')),
    } as any)
    const result = await getTenantBySlug('acme')
    expect(result).toBeNull()
  })
})
