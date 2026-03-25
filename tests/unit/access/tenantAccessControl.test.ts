/**
 * Phase 4: Access Control Unit Tests
 *
 * Tests all access control functions:
 *  - utilities.ts: checkRole, ADMIN_ROLES
 *  - Role-based: isAdmin, isSuperAdmin, adminOnly, authenticated
 *  - Content-scoped: authenticatedOrPublished, adminOrPublishedStatus
 *  - Owner-scoped: adminOrSelf, adminOrCustomerOwner, isDocumentOwner
 *  - Tenant-scoped: publicWithTenantScope, adminOrPublishedWithTenantScope
 *  - Utilities: buildTenantFilter, tenantScope (resolveTenantIdFromRequest, buildTenantWhere, mergeWithTenantScope)
 */
import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

// ─── Mock Dependencies ───────────────────────────────────────────

vi.mock('payload', () => ({
  getPayload: vi.fn(() => Promise.resolve({})),
}))
vi.mock('@payload-config', () => ({ default: {} }))

// Mock fetchTenantBySlug for tenantScope functions
const mockFetchTenantBySlug = vi.fn()
vi.mock('@/utilities/fetchTenantBySlug', () => ({
  fetchTenantBySlug: (...args: unknown[]) => mockFetchTenantBySlug(...args),
}))

// ─── Helpers ─────────────────────────────────────────────────────

function makeUser(roles: string[] = ['customer'], id = 1) {
  return { id, email: 'test@test.com', roles }
}

function makeReq(user: ReturnType<typeof makeUser> | null = null, tenantSlug?: string) {
  const headerMap = new Map<string, string>()
  if (tenantSlug) headerMap.set('x-tenant-id', tenantSlug)
  return {
    user,
    headers: {
      get: (key: string) => headerMap.get(key) ?? null,
    },
  } as any
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchTenantBySlug.mockResolvedValue(null)
})

// ═══════════════════════════════════════════════════════════════
// utilities.ts — checkRole, ADMIN_ROLES
// ═══════════════════════════════════════════════════════════════

describe('access/utilities', () => {
  let checkRole: typeof import('@/access/utilities').checkRole
  let ADMIN_ROLES: typeof import('@/access/utilities').ADMIN_ROLES

  beforeAll(async () => {
    const mod = await import('@/access/utilities')
    checkRole = mod.checkRole
    ADMIN_ROLES = mod.ADMIN_ROLES
  })

  it('ADMIN_ROLES includes super_admin, admin, archangel', () => {
    expect(ADMIN_ROLES).toContain('super_admin')
    expect(ADMIN_ROLES).toContain('admin')
    expect(ADMIN_ROLES).toContain('archangel')
  })

  it('returns true when user has matching role', () => {
    expect(checkRole(['admin'], makeUser(['admin']))).toBe(true)
  })

  it('returns true when user has one of multiple matching roles', () => {
    expect(checkRole(['admin', 'super_admin'], makeUser(['super_admin']))).toBe(true)
  })

  it('returns false when user has no matching role', () => {
    expect(checkRole(['admin'], makeUser(['customer']))).toBe(false)
  })

  it('returns false for undefined user', () => {
    expect(checkRole(['admin'], undefined)).toBe(false)
  })

  it('returns false for null user', () => {
    expect(checkRole(['admin'], null)).toBe(false)
  })

  it('handles empty roles array', () => {
    expect(checkRole([], makeUser(['admin']))).toBe(false)
  })

  it('handles user with empty roles', () => {
    expect(checkRole(['admin'], makeUser([]))).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// isAdmin
// ═══════════════════════════════════════════════════════════════

describe('access/isAdmin', () => {
  let isAdmin: typeof import('@/access/isAdmin').isAdmin

  beforeAll(async () => {
    const mod = await import('@/access/isAdmin')
    isAdmin = mod.isAdmin
  })

  it('returns true for admin user', () => {
    expect(isAdmin({ req: makeReq(makeUser(['admin'])) } as any)).toBe(true)
  })

  it('returns true for super_admin user', () => {
    expect(isAdmin({ req: makeReq(makeUser(['super_admin'])) } as any)).toBe(true)
  })

  it('returns false for customer user', () => {
    expect(isAdmin({ req: makeReq(makeUser(['customer'])) } as any)).toBe(false)
  })

  it('returns false for no user', () => {
    expect(isAdmin({ req: makeReq(null) } as any)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// isSuperAdmin
// ═══════════════════════════════════════════════════════════════

describe('access/isSuperAdmin', () => {
  let isSuperAdmin: typeof import('@/access/isSuperAdmin').isSuperAdmin

  beforeAll(async () => {
    const mod = await import('@/access/isSuperAdmin')
    isSuperAdmin = mod.isSuperAdmin
  })

  it('returns true for super_admin', () => {
    expect(isSuperAdmin(makeUser(['super_admin']) as any)).toBe(true)
  })

  it('returns false for admin (not super)', () => {
    expect(isSuperAdmin(makeUser(['admin']) as any)).toBe(false)
  })

  it('returns false for customer', () => {
    expect(isSuperAdmin(makeUser(['customer']) as any)).toBe(false)
  })

  it('returns false for null user', () => {
    expect(isSuperAdmin(null)).toBe(false)
  })

  it('returns false for undefined user', () => {
    expect(isSuperAdmin(undefined)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// adminOnly
// ═══════════════════════════════════════════════════════════════

describe('access/adminOnly', () => {
  let adminOnly: typeof import('@/access/adminOnly').adminOnly

  beforeAll(async () => {
    const mod = await import('@/access/adminOnly')
    adminOnly = mod.adminOnly
  })

  it('returns true for admin', () => {
    expect(adminOnly({ req: makeReq(makeUser(['admin'])) } as any)).toBe(true)
  })

  it('returns true for super_admin', () => {
    expect(adminOnly({ req: makeReq(makeUser(['super_admin'])) } as any)).toBe(true)
  })

  it('returns false for archangel (adminOnly checks super_admin + admin only)', () => {
    // adminOnly uses checkRole with ['super_admin', 'admin'] — not ADMIN_ROLES which includes archangel
    expect(adminOnly({ req: makeReq(makeUser(['archangel'])) } as any)).toBe(false)
  })

  it('returns false for customer', () => {
    expect(adminOnly({ req: makeReq(makeUser(['customer'])) } as any)).toBe(false)
  })

  it('returns false for no user', () => {
    expect(adminOnly({ req: makeReq(null) } as any)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// authenticated
// ═══════════════════════════════════════════════════════════════

describe('access/authenticated', () => {
  let authenticated: typeof import('@/access/authenticated').authenticated

  beforeAll(async () => {
    const mod = await import('@/access/authenticated')
    authenticated = mod.authenticated
  })

  it('returns true when user exists', () => {
    expect(authenticated({ req: makeReq(makeUser()) } as any)).toBe(true)
  })

  it('returns false when no user', () => {
    expect(authenticated({ req: makeReq(null) } as any)).toBeFalsy()
  })
})

// ═══════════════════════════════════════════════════════════════
// adminOrPublishedStatus
// ═══════════════════════════════════════════════════════════════

describe('access/adminOrPublishedStatus', () => {
  let adminOrPublishedStatus: typeof import('@/access/adminOrPublishedStatus').adminOrPublishedStatus

  beforeAll(async () => {
    const mod = await import('@/access/adminOrPublishedStatus')
    adminOrPublishedStatus = mod.adminOrPublishedStatus
  })

  it('returns true for admin (full access)', () => {
    expect(adminOrPublishedStatus({ req: makeReq(makeUser(['admin'])) } as any)).toBe(true)
  })

  it('returns published-only filter for non-admin', () => {
    const result = adminOrPublishedStatus({ req: makeReq(makeUser(['customer'])) } as any)
    expect(result).toEqual({ _status: { equals: 'published' } })
  })

  it('returns published-only filter for no user', () => {
    const result = adminOrPublishedStatus({ req: makeReq(null) } as any)
    expect(result).toEqual({ _status: { equals: 'published' } })
  })
})

// ═══════════════════════════════════════════════════════════════
// adminOrSelf
// ═══════════════════════════════════════════════════════════════

describe('access/adminOrSelf', () => {
  let adminOrSelf: typeof import('@/access/adminOrSelf').adminOrSelf

  beforeAll(async () => {
    const mod = await import('@/access/adminOrSelf')
    adminOrSelf = mod.adminOrSelf
  })

  it('returns true for admin (bypass)', () => {
    expect(adminOrSelf({ req: makeReq(makeUser(['admin'])) } as any)).toBe(true)
  })

  it('returns self-scoping Where for regular user', () => {
    const user = makeUser(['customer'], 42)
    const result = adminOrSelf({ req: makeReq(user) } as any)
    expect(result).toEqual({ id: { equals: 42 } })
  })

  it('returns false for no user', () => {
    expect(adminOrSelf({ req: makeReq(null) } as any)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// adminOrCustomerOwner
// ═══════════════════════════════════════════════════════════════

describe('access/adminOrCustomerOwner', () => {
  let adminOrCustomerOwner: typeof import('@/access/adminOrCustomerOwner').adminOrCustomerOwner

  beforeAll(async () => {
    const mod = await import('@/access/adminOrCustomerOwner')
    adminOrCustomerOwner = mod.adminOrCustomerOwner
  })

  it('returns true for admin', () => {
    expect(adminOrCustomerOwner({ req: makeReq(makeUser(['admin'])) } as any)).toBe(true)
  })

  it('returns customer-scoping Where for regular user', () => {
    const user = makeUser(['customer'], 42)
    const result = adminOrCustomerOwner({ req: makeReq(user) } as any)
    expect(result).toEqual({ customer: { equals: 42 } })
  })

  it('returns false for no user', () => {
    expect(adminOrCustomerOwner({ req: makeReq(null) } as any)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// isDocumentOwner
// ═══════════════════════════════════════════════════════════════

describe('access/isDocumentOwner', () => {
  let isDocumentOwner: typeof import('@/access/isDocumentOwner').isDocumentOwner

  beforeAll(async () => {
    const mod = await import('@/access/isDocumentOwner')
    isDocumentOwner = mod.isDocumentOwner
  })

  it('returns true for admin (bypass)', () => {
    expect(isDocumentOwner({ req: makeReq(makeUser(['admin'])) } as any)).toBe(true)
  })

  it('returns owner-scoping Where for regular user', () => {
    const user = makeUser(['customer'], 42)
    const result = isDocumentOwner({ req: makeReq(user) } as any)
    expect(result).toEqual({ customer: { equals: 42 } })
  })

  it('returns false for no user', () => {
    expect(isDocumentOwner({ req: makeReq(null) } as any)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// publicAccess
// ═══════════════════════════════════════════════════════════════

describe('access/publicAccess', () => {
  let publicAccess: typeof import('@/access/publicAccess').publicAccess

  beforeAll(async () => {
    const mod = await import('@/access/publicAccess')
    publicAccess = mod.publicAccess
  })

  it('always returns true', () => {
    expect(publicAccess({} as any)).toBe(true)
  })

  it('returns true even with no user', () => {
    expect(publicAccess({ req: makeReq(null) } as any)).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// buildTenantFilter
// ═══════════════════════════════════════════════════════════════

describe('buildTenantFilter', () => {
  let buildTenantFilter: typeof import('@/utilities/buildTenantFilter').buildTenantFilter

  beforeAll(async () => {
    const mod = await import('@/utilities/buildTenantFilter')
    buildTenantFilter = mod.buildTenantFilter
  })

  it('returns tenant equals filter for numeric ID', () => {
    expect(buildTenantFilter(42)).toEqual({ tenant: { equals: 42 } })
  })

  it('returns tenant equals filter for string ID', () => {
    expect(buildTenantFilter('abc')).toEqual({ tenant: { equals: 'abc' } })
  })

  it('returns tenant exists:false for null', () => {
    expect(buildTenantFilter(null)).toEqual({ tenant: { exists: false } })
  })

  it('returns tenant exists:false for undefined', () => {
    expect(buildTenantFilter(undefined)).toEqual({ tenant: { exists: false } })
  })

  it('treats 0 as a valid tenant ID (not falsy)', () => {
    // 0 != null, so it should be treated as a valid ID
    expect(buildTenantFilter(0)).toEqual({ tenant: { equals: 0 } })
  })
})

// ═══════════════════════════════════════════════════════════════
// tenantScope — resolveTenantIdFromRequest, buildTenantWhere, mergeWithTenantScope
// ═══════════════════════════════════════════════════════════════

describe('tenantScope', () => {
  let resolveTenantIdFromRequest: typeof import('@/access/tenantScope').resolveTenantIdFromRequest
  let buildTenantWhere: typeof import('@/access/tenantScope').buildTenantWhere
  let mergeWithTenantScope: typeof import('@/access/tenantScope').mergeWithTenantScope

  beforeAll(async () => {
    const mod = await import('@/access/tenantScope')
    resolveTenantIdFromRequest = mod.resolveTenantIdFromRequest
    buildTenantWhere = mod.buildTenantWhere
    mergeWithTenantScope = mod.mergeWithTenantScope
  })

  describe('resolveTenantIdFromRequest', () => {
    it('returns null when no x-tenant-id header', async () => {
      const result = await resolveTenantIdFromRequest(makeReq())
      expect(result).toBeNull()
    })

    it('resolves slug to tenant ID via fetchTenantBySlug', async () => {
      mockFetchTenantBySlug.mockResolvedValueOnce({ id: 42, slug: 'my-shop' })
      const result = await resolveTenantIdFromRequest(makeReq(null, 'my-shop'))
      expect(result).toBe(42)
      expect(mockFetchTenantBySlug).toHaveBeenCalledWith('my-shop')
    })

    it('returns null when tenant slug not found', async () => {
      mockFetchTenantBySlug.mockResolvedValueOnce(null)
      const result = await resolveTenantIdFromRequest(makeReq(null, 'nonexistent'))
      expect(result).toBeNull()
    })
  })

  describe('buildTenantWhere', () => {
    it('returns null when no tenant context', async () => {
      const result = await buildTenantWhere(makeReq())
      expect(result).toBeNull()
    })

    it('returns tenant equals filter when tenant resolved', async () => {
      mockFetchTenantBySlug.mockResolvedValueOnce({ id: 42 })
      const result = await buildTenantWhere(makeReq(null, 'my-shop'))
      expect(result).toEqual({ tenant: { equals: 42 } })
    })
  })

  describe('mergeWithTenantScope', () => {
    it('combines base and tenant Where clauses with AND', () => {
      const base = { _status: { equals: 'published' } }
      const tenant = { tenant: { equals: 42 } }
      const result = mergeWithTenantScope(base, tenant)
      expect(result).toEqual({
        and: [base, tenant],
      })
    })

    it('preserves both clauses in result', () => {
      const base = { category: { equals: 'blog' } }
      const tenant = { tenant: { equals: 1 } }
      const result = mergeWithTenantScope(base, tenant) as any
      expect(result.and).toHaveLength(2)
      expect(result.and[0]).toEqual(base)
      expect(result.and[1]).toEqual(tenant)
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// publicWithTenantScope
// ═══════════════════════════════════════════════════════════════

describe('access/publicWithTenantScope', () => {
  let publicWithTenantScope: typeof import('@/access/publicWithTenantScope').publicWithTenantScope

  beforeAll(async () => {
    const mod = await import('@/access/publicWithTenantScope')
    publicWithTenantScope = mod.publicWithTenantScope
  })

  it('returns true for authenticated user (multiTenantPlugin handles scoping)', async () => {
    const result = await publicWithTenantScope({ req: makeReq(makeUser()) } as any)
    expect(result).toBe(true)
  })

  it('returns tenant Where for unauthenticated request with tenant', async () => {
    mockFetchTenantBySlug.mockResolvedValueOnce({ id: 42 })
    const result = await publicWithTenantScope({ req: makeReq(null, 'my-shop') } as any)
    expect(result).toEqual({ tenant: { equals: 42 } })
  })

  it('returns true for unauthenticated request with no tenant (platform fallback)', async () => {
    const result = await publicWithTenantScope({ req: makeReq(null) } as any)
    expect(result).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════
// authenticatedOrPublished
// ═══════════════════════════════════════════════════════════════

describe('access/authenticatedOrPublished', () => {
  let authenticatedOrPublished: typeof import('@/access/authenticatedOrPublished').authenticatedOrPublished

  beforeAll(async () => {
    const mod = await import('@/access/authenticatedOrPublished')
    authenticatedOrPublished = mod.authenticatedOrPublished
  })

  it('returns true for authenticated user', async () => {
    const result = await authenticatedOrPublished({ req: makeReq(makeUser()) } as any)
    expect(result).toBe(true)
  })

  it('returns published filter with tenant scope for unauthenticated + tenant', async () => {
    mockFetchTenantBySlug.mockResolvedValueOnce({ id: 42 })
    const result = await authenticatedOrPublished({ req: makeReq(null, 'my-shop') } as any)
    // Should be AND of published + tenant
    expect(result).toEqual({
      and: [
        { _status: { equals: 'published' } },
        { tenant: { equals: 42 } },
      ],
    })
  })

  it('returns published-only filter for unauthenticated + no tenant', async () => {
    const result = await authenticatedOrPublished({ req: makeReq(null) } as any)
    expect(result).toEqual({ _status: { equals: 'published' } })
  })
})

// ═══════════════════════════════════════════════════════════════
// adminOrPublishedWithTenantScope
// ═══════════════════════════════════════════════════════════════

describe('access/adminOrPublishedWithTenantScope', () => {
  let adminOrPublishedWithTenantScope: typeof import('@/access/adminOrPublishedWithTenantScope').adminOrPublishedWithTenantScope

  beforeAll(async () => {
    const mod = await import('@/access/adminOrPublishedWithTenantScope')
    adminOrPublishedWithTenantScope = mod.adminOrPublishedWithTenantScope
  })

  it('returns true for admin (multiTenantPlugin handles scoping)', async () => {
    const result = await adminOrPublishedWithTenantScope({ req: makeReq(makeUser(['admin'])) } as any)
    expect(result).toBe(true)
  })

  it('returns published + tenant scope for non-admin with tenant', async () => {
    mockFetchTenantBySlug.mockResolvedValueOnce({ id: 42 })
    const result = await adminOrPublishedWithTenantScope({ req: makeReq(makeUser(['customer']), 'my-shop') } as any)
    expect(result).toEqual({
      and: [
        { _status: { equals: 'published' } },
        { tenant: { equals: 42 } },
      ],
    })
  })

  it('returns published + no-tenant filter for non-admin without tenant', async () => {
    const result = await adminOrPublishedWithTenantScope({ req: makeReq(makeUser(['customer'])) } as any) as any
    // Should prevent cross-tenant leaks: published + tenant exists:false
    expect(result.and).toBeDefined()
    const filters = result.and
    expect(filters.some((f: any) => f._status?.equals === 'published')).toBe(true)
    expect(filters.some((f: any) => f.tenant?.exists === false)).toBe(true)
  })

  it('returns published + no-tenant filter for no user', async () => {
    const result = await adminOrPublishedWithTenantScope({ req: makeReq(null) } as any) as any
    expect(result.and).toBeDefined()
  })
})
