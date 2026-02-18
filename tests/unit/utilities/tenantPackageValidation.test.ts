/**
 * Unit tests for Tenant Package validation — import/export structure checks.
 *
 * Tests the package validation logic used by TenantImportExportService
 * when importing tenant suitcase packages.
 *
 * @see src/utilities/TenantImportExportService.ts
 */
import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implement validation logic for isolated testing
// ---------------------------------------------------------------------------

interface TenantPackage {
  metadata: {
    name: string
    version: string
    exportedAt: string
    exportedBy: string
    angelOSVersion: string
  }
  tenant: {
    name: string
    slug: string
    businessType: string
    configuration: unknown
    features: unknown
    limits: unknown
  }
  users: unknown[]
  spaces: unknown[]
  channels: unknown[]
  messages: unknown[]
  posts: unknown[]
  products: unknown[]
  media: unknown[]
  appointments: unknown[]
  customData?: Record<string, unknown[]>
}

interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Validate a tenant package structure before import.
 * Pure validation — no side effects.
 */
function validateTenantPackage(data: unknown): ValidationResult {
  const errors: string[] = []

  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['Package must be a JSON object'] }
  }

  const pkg = data as Record<string, unknown>

  // Required top-level sections
  if (!pkg.metadata || typeof pkg.metadata !== 'object') {
    errors.push('Missing required section: metadata')
  } else {
    const meta = pkg.metadata as Record<string, unknown>
    if (!meta.name) errors.push('metadata.name is required')
    if (!meta.version) errors.push('metadata.version is required')
    if (!meta.exportedAt) errors.push('metadata.exportedAt is required')
    if (!meta.angelOSVersion) errors.push('metadata.angelOSVersion is required')
  }

  if (!pkg.tenant || typeof pkg.tenant !== 'object') {
    errors.push('Missing required section: tenant')
  } else {
    const tenant = pkg.tenant as Record<string, unknown>
    if (!tenant.name) errors.push('tenant.name is required')
    if (!tenant.slug) errors.push('tenant.slug is required')
  }

  // Collection arrays (should be arrays, even if empty)
  const requiredArrays = [
    'users',
    'spaces',
    'channels',
    'messages',
    'posts',
    'products',
    'media',
    'appointments',
  ]
  for (const key of requiredArrays) {
    if (pkg[key] !== undefined && !Array.isArray(pkg[key])) {
      errors.push(`${key} must be an array`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Validate tenant slug format.
 */
function validateSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

/**
 * Validate ISO date string.
 */
function isValidISODate(dateStr: string): boolean {
  const date = new Date(dateStr)
  return !isNaN(date.getTime()) && dateStr.includes('T')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('validateTenantPackage', () => {
  const validPackage: TenantPackage = {
    metadata: {
      name: 'Test Export',
      version: '1.0.0',
      exportedAt: '2026-02-18T12:00:00Z',
      exportedBy: 'Angel OS Export System',
      angelOSVersion: '1.0.0',
    },
    tenant: {
      name: 'Test Tenant',
      slug: 'test-tenant',
      businessType: 'service-provider',
      configuration: {},
      features: {},
      limits: {},
    },
    users: [],
    spaces: [],
    channels: [],
    messages: [],
    posts: [],
    products: [],
    media: [],
    appointments: [],
  }

  it('accepts a valid package', () => {
    const result = validateTenantPackage(validPackage)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects null input', () => {
    const result = validateTenantPackage(null)
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('JSON object')
  })

  it('rejects non-object input', () => {
    const result = validateTenantPackage('not an object')
    expect(result.valid).toBe(false)
  })

  it('rejects missing metadata', () => {
    const { metadata, ...rest } = validPackage
    const result = validateTenantPackage(rest)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing required section: metadata')
  })

  it('rejects missing tenant', () => {
    const { tenant, ...rest } = validPackage
    const result = validateTenantPackage(rest)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing required section: tenant')
  })

  it('rejects metadata without name', () => {
    const pkg = {
      ...validPackage,
      metadata: { ...validPackage.metadata, name: '' },
    }
    const result = validateTenantPackage(pkg)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('metadata.name is required')
  })

  it('rejects metadata without version', () => {
    const pkg = {
      ...validPackage,
      metadata: { ...validPackage.metadata, version: '' },
    }
    const result = validateTenantPackage(pkg)
    expect(result.valid).toBe(false)
  })

  it('rejects metadata without exportedAt', () => {
    const pkg = {
      ...validPackage,
      metadata: { ...validPackage.metadata, exportedAt: '' },
    }
    const result = validateTenantPackage(pkg)
    expect(result.valid).toBe(false)
  })

  it('rejects tenant without name', () => {
    const pkg = {
      ...validPackage,
      tenant: { ...validPackage.tenant, name: '' },
    }
    const result = validateTenantPackage(pkg)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('tenant.name is required')
  })

  it('rejects tenant without slug', () => {
    const pkg = {
      ...validPackage,
      tenant: { ...validPackage.tenant, slug: '' },
    }
    const result = validateTenantPackage(pkg)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('tenant.slug is required')
  })

  it('rejects non-array collection fields', () => {
    const pkg = { ...validPackage, users: 'not an array' }
    const result = validateTenantPackage(pkg)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('users must be an array')
  })

  it('accepts package with populated arrays', () => {
    const pkg = {
      ...validPackage,
      users: [{ id: 1, name: 'Test User' }],
      spaces: [{ id: 1, name: 'Main Space' }],
    }
    const result = validateTenantPackage(pkg)
    expect(result.valid).toBe(true)
  })

  it('accepts package with optional customData', () => {
    const pkg = {
      ...validPackage,
      customData: { myCollection: [{ id: 1 }] },
    }
    const result = validateTenantPackage(pkg)
    expect(result.valid).toBe(true)
  })

  it('collects multiple errors', () => {
    const result = validateTenantPackage({})
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(1)
  })
})

describe('validateSlug', () => {
  it('accepts lowercase alphanumeric slugs', () => {
    expect(validateSlug('test-tenant')).toBe(true)
    expect(validateSlug('my-shop')).toBe(true)
    expect(validateSlug('angel123')).toBe(true)
  })

  it('rejects uppercase', () => {
    expect(validateSlug('Test-Tenant')).toBe(false)
  })

  it('rejects spaces', () => {
    expect(validateSlug('test tenant')).toBe(false)
  })

  it('rejects leading/trailing hyphens', () => {
    expect(validateSlug('-test')).toBe(false)
    expect(validateSlug('test-')).toBe(false)
  })

  it('rejects consecutive hyphens', () => {
    expect(validateSlug('test--tenant')).toBe(false)
  })

  it('rejects special characters', () => {
    expect(validateSlug('test_tenant')).toBe(false)
    expect(validateSlug('test.tenant')).toBe(false)
  })
})

describe('isValidISODate', () => {
  it('accepts valid ISO date strings', () => {
    expect(isValidISODate('2026-02-18T12:00:00Z')).toBe(true)
    expect(isValidISODate('2026-02-18T12:00:00.000Z')).toBe(true)
  })

  it('rejects date-only strings (no time component)', () => {
    expect(isValidISODate('2026-02-18')).toBe(false)
  })

  it('rejects invalid dates', () => {
    expect(isValidISODate('not-a-date')).toBe(false)
  })
})
