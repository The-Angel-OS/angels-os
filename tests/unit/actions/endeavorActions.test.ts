/**
 * Phase 2: Endeavor CRUD Unit Tests
 *
 * Tests getEndeavor() and updateEndeavor() server actions:
 *  - Auth + admin enforcement
 *  - Tenant scoping
 *  - Upsert pattern (update existing / create new)
 *  - Partial updates
 *  - Default values for new endeavors
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Payload ────────────────────────────────────────────────

const mockFind = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockAuth = vi.fn()

const mockPayload = {
  find: mockFind,
  create: mockCreate,
  update: mockUpdate,
  auth: mockAuth,
}

vi.mock('payload', () => ({
  getPayload: vi.fn(() => Promise.resolve(mockPayload)),
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve(new Headers({ 'x-tenant-id': 'test-tenant' }))),
}))

// ─── Test Data ───────────────────────────────────────────────────

const ADMIN_USER = { id: 1, email: 'admin@test.com', roles: ['admin'] }
const CUSTOMER_USER = { id: 2, email: 'user@test.com', roles: ['customer'] }
const TENANT_DOC = { id: 42, slug: 'test-tenant', name: 'Test Tenant' }

const FULL_ENDEAVOR = {
  id: 100,
  name: 'Test Enterprise',
  tagline: 'Building great things',
  description: 'A test endeavor',
  endeavorType: 'creator-content',
  holonTypes: ['creator', 'community'],
  missionStatement: 'To test everything',
  capabilities: [{ skill: 'Testing', description: 'We test things' }],
  region: { city: 'Tampa', state: 'FL', country: 'US' },
  federation: {
    networkVisible: true,
    ministryStatus: 'active',
    federationId: 'fed-123',
    constitutionVersion: '1.1',
  },
  status: 'active',
  operator: { name: 'John', email: 'john@test.com', role: 'Lead' },
  tenant: 42,
}

// ─── Import after mocks ─────────────────────────────────────────

const { getEndeavor, updateEndeavor } = await import(
  '@/app/[locale]/(dashboard)/dashboard/endeavor/actions'
)

beforeEach(() => {
  vi.clearAllMocks()
  // Default: admin user authenticated
  mockAuth.mockResolvedValue({ user: ADMIN_USER })
  // Default: tenant found
  mockFind.mockImplementation(async (args: any) => {
    if (args.collection === 'tenants') return { docs: [TENANT_DOC] }
    if (args.collection === 'endeavors') return { docs: [] }
    return { docs: [] }
  })
  mockCreate.mockResolvedValue({ id: 200 })
  mockUpdate.mockResolvedValue({ id: 100 })
})

// ═══════════════════════════════════════════════════════════════
// Auth + Permission Enforcement
// ═══════════════════════════════════════════════════════════════

describe('Endeavor auth enforcement', () => {
  it('rejects unauthenticated users', async () => {
    mockAuth.mockResolvedValueOnce({ user: null })
    const result = await getEndeavor()
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Not authenticated/)
  })

  it('rejects non-admin users', async () => {
    mockAuth.mockResolvedValueOnce({ user: CUSTOMER_USER })
    const result = await getEndeavor()
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Insufficient permissions/)
  })

  it('rejects when tenant not found', async () => {
    mockFind.mockImplementation(async (args: any) => {
      if (args.collection === 'tenants') return { docs: [] }
      return { docs: [] }
    })
    const result = await getEndeavor()
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Tenant not found/)
  })
})

// ═══════════════════════════════════════════════════════════════
// getEndeavor
// ═══════════════════════════════════════════════════════════════

describe('getEndeavor', () => {
  it('returns null when no endeavor exists', async () => {
    const result = await getEndeavor()
    expect(result.success).toBe(true)
    expect(result.endeavor).toBeNull()
  })

  it('returns full endeavor data', async () => {
    mockFind.mockImplementation(async (args: any) => {
      if (args.collection === 'tenants') return { docs: [TENANT_DOC] }
      if (args.collection === 'endeavors') return { docs: [FULL_ENDEAVOR] }
      return { docs: [] }
    })

    const result = await getEndeavor()
    expect(result.success).toBe(true)
    expect(result.endeavor?.name).toBe('Test Enterprise')
    expect(result.endeavor?.tagline).toBe('Building great things')
    expect(result.endeavor?.region.city).toBe('Tampa')
    expect(result.endeavor?.operator.name).toBe('John')
    expect(result.endeavor?.federation.networkVisible).toBe(true)
  })

  it('queries endeavors filtered by tenant', async () => {
    await getEndeavor()
    const endeavorQuery = mockFind.mock.calls.find(
      (c: any[]) => c[0]?.collection === 'endeavors',
    )
    expect(endeavorQuery?.[0]?.where?.tenant?.equals).toBe(42)
  })

  it('uses overrideAccess for queries', async () => {
    await getEndeavor()
    for (const call of mockFind.mock.calls) {
      expect(call[0].overrideAccess).toBe(true)
    }
  })

  it('handles missing optional fields gracefully', async () => {
    mockFind.mockImplementation(async (args: any) => {
      if (args.collection === 'tenants') return { docs: [TENANT_DOC] }
      if (args.collection === 'endeavors') return { docs: [{ id: 100, name: 'Minimal' }] }
      return { docs: [] }
    })

    const result = await getEndeavor()
    expect(result.success).toBe(true)
    expect(result.endeavor?.tagline).toBe('')
    expect(result.endeavor?.description).toBe('')
    expect(result.endeavor?.holonTypes).toEqual([])
    expect(result.endeavor?.capabilities).toEqual([])
    expect(result.endeavor?.region.country).toBe('US')
    expect(result.endeavor?.federation.constitutionVersion).toBe('1.1')
    expect(result.endeavor?.operator.name).toBe('')
    expect(result.endeavor?.status).toBe('forming')
  })
})

// ═══════════════════════════════════════════════════════════════
// updateEndeavor
// ═══════════════════════════════════════════════════════════════

describe('updateEndeavor', () => {
  it('creates new endeavor when none exists', async () => {
    const result = await updateEndeavor({ name: 'New Enterprise' })
    expect(result.success).toBe(true)
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'endeavors',
        data: expect.objectContaining({
          name: 'New Enterprise',
          tenant: 42,
          status: 'forming',
        }),
      }),
    )
  })

  it('uses default name "My Enterprise" when not provided', async () => {
    const result = await updateEndeavor({ tagline: 'Just a tagline' })
    expect(result.success).toBe(true)
    const createCall = mockCreate.mock.calls[0]?.[0]
    expect(createCall?.data?.name).toBe('My Enterprise')
  })

  it('uses default endeavorType "custom" when not provided', async () => {
    const result = await updateEndeavor({ name: 'Test' })
    expect(result.success).toBe(true)
    const createCall = mockCreate.mock.calls[0]?.[0]
    expect(createCall?.data?.endeavorType).toBe('custom')
  })

  it('updates existing endeavor instead of creating', async () => {
    mockFind.mockImplementation(async (args: any) => {
      if (args.collection === 'tenants') return { docs: [TENANT_DOC] }
      if (args.collection === 'endeavors') return { docs: [FULL_ENDEAVOR] }
      return { docs: [] }
    })

    const result = await updateEndeavor({ name: 'Updated Name' })
    expect(result.success).toBe(true)
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'endeavors',
        id: 100,
        data: expect.objectContaining({ name: 'Updated Name' }),
      }),
    )
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('partial update only changes provided fields', async () => {
    mockFind.mockImplementation(async (args: any) => {
      if (args.collection === 'tenants') return { docs: [TENANT_DOC] }
      if (args.collection === 'endeavors') return { docs: [FULL_ENDEAVOR] }
      return { docs: [] }
    })

    await updateEndeavor({ tagline: 'New tagline' })
    const updateCall = mockUpdate.mock.calls[0]?.[0]
    expect(updateCall?.data?.tagline).toBe('New tagline')
    expect(updateCall?.data?.name).toBeUndefined() // Not in update data
    expect(updateCall?.data?.description).toBeUndefined()
  })

  it('updates operator group fields', async () => {
    mockFind.mockImplementation(async (args: any) => {
      if (args.collection === 'tenants') return { docs: [TENANT_DOC] }
      if (args.collection === 'endeavors') return { docs: [FULL_ENDEAVOR] }
      return { docs: [] }
    })

    await updateEndeavor({ operator: { name: 'Jane', email: 'jane@test.com', role: 'CTO' } })
    const updateCall = mockUpdate.mock.calls[0]?.[0]
    expect(updateCall?.data?.operator).toEqual({ name: 'Jane', email: 'jane@test.com', role: 'CTO' })
  })

  it('updates region group fields', async () => {
    mockFind.mockImplementation(async (args: any) => {
      if (args.collection === 'tenants') return { docs: [TENANT_DOC] }
      if (args.collection === 'endeavors') return { docs: [FULL_ENDEAVOR] }
      return { docs: [] }
    })

    await updateEndeavor({ region: { city: 'Miami', state: 'FL', country: 'US' } })
    const updateCall = mockUpdate.mock.calls[0]?.[0]
    expect(updateCall?.data?.region?.city).toBe('Miami')
  })

  it('updates federation visibility', async () => {
    mockFind.mockImplementation(async (args: any) => {
      if (args.collection === 'tenants') return { docs: [TENANT_DOC] }
      if (args.collection === 'endeavors') return { docs: [FULL_ENDEAVOR] }
      return { docs: [] }
    })

    await updateEndeavor({ federation: { networkVisible: false, ministryStatus: '', federationId: '', constitutionVersion: '' } })
    const updateCall = mockUpdate.mock.calls[0]?.[0]
    expect(updateCall?.data?.federation?.networkVisible).toBe(false)
  })

  it('rejects unauthenticated users', async () => {
    mockAuth.mockResolvedValueOnce({ user: null })
    const result = await updateEndeavor({ name: 'Test' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Not authenticated/)
  })

  it('rejects non-admin users', async () => {
    mockAuth.mockResolvedValueOnce({ user: CUSTOMER_USER })
    const result = await updateEndeavor({ name: 'Test' })
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/Insufficient/)
  })
})
