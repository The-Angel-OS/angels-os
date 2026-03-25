/**
 * Phase 1: Provision Action Unit Tests
 *
 * Tests the new-endeavor provisioning flow:
 *  - validateTenantIdentity() — slug validation + uniqueness check
 *  - provisionTenant() — atomic tenant + space + channels + pages + nav + agent + membership creation
 *  - createDefaultTenantPages() — idempotent home/contact page creation
 *  - createDefaultTenantNavigation() — idempotent header/footer creation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Payload ────────────────────────────────────────────────

const mockFind = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()
const mockFindByID = vi.fn()
const mockAuth = vi.fn()

const mockPayload = {
  find: mockFind,
  create: mockCreate,
  update: mockUpdate,
  findByID: mockFindByID,
  auth: mockAuth,
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}

vi.mock('payload', () => ({
  getPayload: vi.fn(() => Promise.resolve(mockPayload)),
}))

vi.mock('@payload-config', () => ({ default: {} }))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => Promise.resolve(new Headers({ 'x-tenant-id': 'test-tenant' }))),
}))

// Mock seed helpers
const mockFindOrCreateTenant = vi.fn()
const mockFindOrCreateSystemAgent = vi.fn()
const mockFindOrCreateTenantMembership = vi.fn()
const mockFindOrCreateSpaceMembership = vi.fn()

vi.mock('@/endpoints/seed/seed-helpers', () => ({
  findOrCreateTenant: (...args: unknown[]) => mockFindOrCreateTenant(...args),
  findOrCreateSystemAgent: (...args: unknown[]) => mockFindOrCreateSystemAgent(...args),
  findOrCreateTenantMembership: (...args: unknown[]) => mockFindOrCreateTenantMembership(...args),
  findOrCreateSpaceMembership: (...args: unknown[]) => mockFindOrCreateSpaceMembership(...args),
}))

// Mock space provisioning
const mockCreateSpaceFromTemplate = vi.fn()
vi.mock('@/utilities/spaceProvisioning', () => ({
  createSpaceFromTemplate: (...args: unknown[]) => mockCreateSpaceFromTemplate(...args),
}))

// Mock default tenant pages/nav
const mockCreateDefaultTenantPages = vi.fn()
const mockCreateDefaultTenantNavigation = vi.fn()
vi.mock('@/utilities/createDefaultTenantPages', () => ({
  createDefaultTenantPages: (...args: unknown[]) => mockCreateDefaultTenantPages(...args),
}))
vi.mock('@/utilities/createDefaultTenantNavigation', () => ({
  createDefaultTenantNavigation: (...args: unknown[]) => mockCreateDefaultTenantNavigation(...args),
}))

// ─── Import after mocks ─────────────────────────────────────────

const { validateTenantIdentity, provisionTenant, getDefaultPersonality } = await import(
  '@/app/[locale]/(dashboard)/dashboard/admin/provision/actions'
)

// ─── Default test state ─────────────────────────────────────────

function makeWizardState(overrides: Record<string, unknown> = {}) {
  return {
    identity: { name: 'Test Endeavor', slug: 'test-endeavor', domain: 'test-endeavor.spacesangels.com' },
    endeavorType: 'creator-content' as const,
    branding: {
      siteName: 'Test Site',
      tagline: 'A test site',
      primaryColor: '#000000',
      secondaryColor: '#ffffff',
      accentColor: '#ff0000',
      headingFont: 'Inter',
      bodyFont: 'Inter',
    },
    nimue: {
      angelName: 'Nimue',
      personality: 'I am Nimue, your Guardian Angel.',
      domainExpertise: 'content creation',
    },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  // Default: no existing tenant (slug available)
  mockFind.mockResolvedValue({ docs: [] })
  // Default: auth returns a user
  mockAuth.mockResolvedValue({ user: { id: 1, email: 'test@test.com', roles: ['customer'] } })
  // Default: tenant creation returns an object
  mockFindOrCreateTenant.mockResolvedValue({ id: 42, slug: 'test-endeavor', name: 'Test Endeavor' })
  // Default: space creation returns a spaceId
  mockCreateSpaceFromTemplate.mockResolvedValue({ spaceId: 100 })
  // Default: user lookup for tenants array
  mockFindByID.mockResolvedValue({ id: 1, tenants: [], roles: ['customer'] })
  // Default: update succeeds
  mockUpdate.mockResolvedValue({})
})

// ═══════════════════════════════════════════════════════════════
// validateTenantIdentity
// ═══════════════════════════════════════════════════════════════

describe('validateTenantIdentity', () => {
  it('accepts a valid slug', async () => {
    const result = await validateTenantIdentity('my-great-shop')
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('accepts slug with numbers', async () => {
    const result = await validateTenantIdentity('shop-123')
    expect(result.valid).toBe(true)
  })

  it('rejects empty slug', async () => {
    const result = await validateTenantIdentity('')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/at least 2/)
  })

  it('rejects single character slug', async () => {
    const result = await validateTenantIdentity('a')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/at least 2/)
  })

  it('rejects slug with uppercase letters', async () => {
    const result = await validateTenantIdentity('MyShop')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/lowercase/)
  })

  it('rejects slug with spaces', async () => {
    const result = await validateTenantIdentity('my shop')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/lowercase/)
  })

  it('rejects slug with special characters', async () => {
    const result = await validateTenantIdentity('my_shop!')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/lowercase/)
  })

  it('rejects slug with underscores', async () => {
    const result = await validateTenantIdentity('my_shop')
    expect(result.valid).toBe(false)
  })

  it('rejects duplicate slug', async () => {
    mockFind.mockResolvedValueOnce({ docs: [{ id: 1, slug: 'taken-slug' }] })
    const result = await validateTenantIdentity('taken-slug')
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/already taken/)
  })

  it('queries tenants collection for uniqueness', async () => {
    await validateTenantIdentity('check-me')
    expect(mockFind).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenants',
        where: { slug: { equals: 'check-me' } },
        overrideAccess: true,
      }),
    )
  })
})

// ═══════════════════════════════════════════════════════════════
// provisionTenant
// ═══════════════════════════════════════════════════════════════

describe('provisionTenant', () => {
  it('returns success with tenantId and slug on happy path', async () => {
    const result = await provisionTenant(makeWizardState())
    expect(result.success).toBe(true)
    expect(result.tenantId).toBe(42)
    expect(result.tenantSlug).toBe('test-endeavor')
  })

  it('rejects unauthenticated users', async () => {
    mockAuth.mockResolvedValueOnce({ user: null })
    const result = await provisionTenant(makeWizardState())
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/logged in/)
  })

  it('creates tenant with correct name and slug', async () => {
    await provisionTenant(makeWizardState())
    expect(mockFindOrCreateTenant).toHaveBeenCalledWith(
      mockPayload,
      expect.anything(),
      expect.objectContaining({
        name: 'Test Endeavor',
        slug: 'test-endeavor',
      }),
    )
  })

  it('passes branding to tenant creation', async () => {
    await provisionTenant(makeWizardState())
    expect(mockFindOrCreateTenant).toHaveBeenCalledWith(
      mockPayload,
      expect.anything(),
      expect.objectContaining({
        branding: expect.objectContaining({
          siteName: 'Test Site',
          tagline: 'A test site',
          primaryColor: '#000000',
        }),
      }),
    )
  })

  it('falls back to identity name when siteName is empty', async () => {
    const state = makeWizardState({
      branding: {
        siteName: '',
        tagline: '',
        primaryColor: '#000',
        secondaryColor: '#fff',
        accentColor: '#f00',
        headingFont: 'Inter',
        bodyFont: 'Inter',
      },
    })
    await provisionTenant(state)
    expect(mockFindOrCreateTenant).toHaveBeenCalledWith(
      mockPayload,
      expect.anything(),
      expect.objectContaining({
        branding: expect.objectContaining({
          siteName: 'Test Endeavor',
        }),
      }),
    )
  })

  it('sets tenant status to provisioning then active', async () => {
    await provisionTenant(makeWizardState())
    // First update: provisioning
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenants',
        id: 42,
        data: { status: 'provisioning' },
      }),
    )
    // Last update should be activation
    const calls = mockUpdate.mock.calls
    const lastTenantUpdate = calls
      .filter((c: any[]) => c[0]?.collection === 'tenants' && c[0]?.id === 42)
      .pop()
    expect(lastTenantUpdate?.[0]?.data?.status).toBe('active')
  })

  it('creates space from correct endeavor template', async () => {
    await provisionTenant(makeWizardState({ endeavorType: 'retail-commerce' }))
    expect(mockCreateSpaceFromTemplate).toHaveBeenCalledWith(
      mockPayload,
      'retail-commerce',
      42,
      'Test Endeavor HQ',
      expect.anything(),
    )
  })

  it.each([
    'service-provider',
    'retail-commerce',
    'creator-content',
    'booking-based',
    'custom',
  ] as const)('creates space for endeavor type %s', async (t) => {
    await provisionTenant(makeWizardState({ endeavorType: t }))
    expect(mockCreateSpaceFromTemplate).toHaveBeenCalledWith(
      expect.anything(),
      t,
      expect.anything(),
      expect.anything(),
      expect.anything(),
    )
  })

  it('creates default pages for the tenant', async () => {
    await provisionTenant(makeWizardState())
    expect(mockCreateDefaultTenantPages).toHaveBeenCalledWith(
      mockPayload,
      42,
      expect.objectContaining({ siteName: 'Test Site' }),
    )
  })

  it('creates default navigation for the tenant', async () => {
    await provisionTenant(makeWizardState())
    expect(mockCreateDefaultTenantNavigation).toHaveBeenCalledWith(mockPayload, 42)
  })

  it.each([
    ['page', mockCreateDefaultTenantPages],
    ['nav', mockCreateDefaultTenantNavigation],
  ] as const)('%s creation failure is non-critical (does not fail provision)', async (_, mockFn) => {
    (mockFn as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('Failed'))
    const result = await provisionTenant(makeWizardState())
    expect(result.success).toBe(true)
  })

  it('creates Nimue system agent with personality', async () => {
    await provisionTenant(makeWizardState())
    expect(mockFindOrCreateSystemAgent).toHaveBeenCalledWith(
      mockPayload,
      expect.anything(),
      expect.objectContaining({
        tenantId: 42,
        agentType: 'leo',
        displayName: 'Nimue',
        personality: expect.stringContaining('Guardian Angel'),
      }),
    )
  })

  it('appends domain expertise to personality', async () => {
    await provisionTenant(makeWizardState())
    expect(mockFindOrCreateSystemAgent).toHaveBeenCalledWith(
      mockPayload,
      expect.anything(),
      expect.objectContaining({
        personality: expect.stringContaining('content creation'),
      }),
    )
  })

  it('links user as tenant_admin', async () => {
    await provisionTenant(makeWizardState())
    expect(mockFindOrCreateTenantMembership).toHaveBeenCalledWith(
      mockPayload,
      expect.anything(),
      expect.objectContaining({
        userId: 1,
        tenantId: 42,
        role: 'tenant_admin',
      }),
    )
  })

  it('adds tenant to user tenants array', async () => {
    await provisionTenant(makeWizardState())
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 1,
        data: expect.objectContaining({
          tenants: expect.arrayContaining([{ tenant: 42 }]),
        }),
      }),
    )
  })

  it('adds admin role to user if not already present', async () => {
    await provisionTenant(makeWizardState())
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 1,
        data: expect.objectContaining({
          roles: expect.arrayContaining(['admin']),
        }),
      }),
    )
  })

  it('does not duplicate admin role if already present', async () => {
    mockFindByID.mockResolvedValueOnce({ id: 1, tenants: [], roles: ['customer', 'admin'] })
    await provisionTenant(makeWizardState())
    const userUpdate = mockUpdate.mock.calls.find(
      (c: any[]) => c[0]?.collection === 'users',
    )
    const roles = userUpdate?.[0]?.data?.roles
    expect(roles?.filter((r: string) => r === 'admin')).toHaveLength(1)
  })

  it('skips tenant-link if user already has tenant in array', async () => {
    mockFindByID.mockResolvedValueOnce({
      id: 1,
      tenants: [{ tenant: 42 }],
      roles: ['customer', 'admin'],
    })
    await provisionTenant(makeWizardState())
    // Should NOT have a users update call since tenant already linked
    const userUpdates = mockUpdate.mock.calls.filter(
      (c: any[]) => c[0]?.collection === 'users',
    )
    expect(userUpdates).toHaveLength(0)
  })

  it('links user as space_admin', async () => {
    await provisionTenant(makeWizardState())
    expect(mockFindOrCreateSpaceMembership).toHaveBeenCalledWith(
      mockPayload,
      expect.anything(),
      expect.objectContaining({
        userId: 1,
        spaceId: 100,
        role: 'space_admin',
        tenantId: 42,
      }),
    )
  })

  it('returns error on unexpected failure', async () => {
    mockFindOrCreateTenant.mockRejectedValueOnce(new Error('DB connection lost'))
    const result = await provisionTenant(makeWizardState())
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/DB connection lost/)
  })
})

// ═══════════════════════════════════════════════════════════════
// getDefaultPersonality
// ═══════════════════════════════════════════════════════════════

describe('getDefaultPersonality', () => {
  it('returns the Nimue personality string', async () => {
    const personality = await getDefaultPersonality()
    expect(personality).toContain('Nimue')
    expect(personality).toContain('Guardian Angel')
    expect(personality).toContain('Safehold')
  })
})

// ═══════════════════════════════════════════════════════════════
// createDefaultTenantPages (direct import)
// ═══════════════════════════════════════════════════════════════

describe('createDefaultTenantPages', () => {
  // Use the real implementation (not mocked)
  let createDefaultTenantPages: typeof import('@/utilities/createDefaultTenantPages').createDefaultTenantPages

  beforeEach(async () => {
    // Unmock for direct testing
    vi.doUnmock('@/utilities/createDefaultTenantPages')
    // Re-mock lexical helpers since they're used inside
    vi.mock('@/utilities/lexicalHelpers', () => ({
      createLexicalContent: (nodes: unknown[]) => ({ root: { children: nodes } }),
      createHeadingNode: (text: string, tag: string) => ({ type: 'heading', text, tag }),
      createParagraphNode: (text: string) => ({ type: 'paragraph', text }),
    }))
    const mod = await import('@/utilities/createDefaultTenantPages')
    createDefaultTenantPages = mod.createDefaultTenantPages
    vi.clearAllMocks()
    mockFind.mockResolvedValue({ docs: [] })
    mockCreate.mockResolvedValue({ id: 1 })
  })

  it('creates home and contact pages', async () => {
    await createDefaultTenantPages(mockPayload as any, 42, { siteName: 'Test' })
    const createCalls = mockCreate.mock.calls
    expect(createCalls).toHaveLength(2)
    expect(createCalls[0][0].data.slug).toBe('home')
    expect(createCalls[1][0].data.slug).toBe('contact')
  })

  it('associates pages with correct tenant', async () => {
    await createDefaultTenantPages(mockPayload as any, 42, { siteName: 'Test' })
    for (const call of mockCreate.mock.calls) {
      expect(call[0].data.tenant).toBe(42)
    }
  })

  it('sets pages as published', async () => {
    await createDefaultTenantPages(mockPayload as any, 42, { siteName: 'Test' })
    for (const call of mockCreate.mock.calls) {
      expect(call[0].data._status).toBe('published')
    }
  })

  it('includes siteName in home page content', async () => {
    await createDefaultTenantPages(mockPayload as any, 42, { siteName: 'Cool Shop' })
    const homeData = mockCreate.mock.calls[0][0].data
    expect(homeData.meta.title).toContain('Cool Shop')
  })

  it('is idempotent — skips if home page exists', async () => {
    mockFind.mockResolvedValueOnce({ docs: [{ id: 99, slug: 'home' }] })
    await createDefaultTenantPages(mockPayload as any, 42, { siteName: 'Test' })
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('uses overrideAccess for all operations', async () => {
    await createDefaultTenantPages(mockPayload as any, 42, { siteName: 'Test' })
    expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ overrideAccess: true }))
    for (const call of mockCreate.mock.calls) {
      expect(call[0].overrideAccess).toBe(true)
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// createDefaultTenantNavigation (direct import)
// ═══════════════════════════════════════════════════════════════

describe('createDefaultTenantNavigation', () => {
  let createDefaultTenantNavigation: typeof import('@/utilities/createDefaultTenantNavigation').createDefaultTenantNavigation

  beforeEach(async () => {
    vi.doUnmock('@/utilities/createDefaultTenantNavigation')
    const mod = await import('@/utilities/createDefaultTenantNavigation')
    createDefaultTenantNavigation = mod.createDefaultTenantNavigation
    vi.clearAllMocks()
    mockFind.mockResolvedValue({ docs: [] })
    mockCreate.mockResolvedValue({ id: 1 })
  })

  it('creates header and footer', async () => {
    await createDefaultTenantNavigation(mockPayload as any, 42)
    const createCalls = mockCreate.mock.calls
    expect(createCalls).toHaveLength(2)
    expect(createCalls[0][0].collection).toBe('header')
    expect(createCalls[1][0].collection).toBe('footer')
  })

  it('associates header/footer with correct tenant', async () => {
    await createDefaultTenantNavigation(mockPayload as any, 42)
    for (const call of mockCreate.mock.calls) {
      expect(call[0].data.tenant).toBe(42)
    }
  })

  it('creates header with default nav items', async () => {
    await createDefaultTenantNavigation(mockPayload as any, 42)
    const headerData = mockCreate.mock.calls[0][0].data
    expect(headerData.navItems).toHaveLength(4)
    expect(headerData.navItems[0].link.label).toBe('Home')
  })

  it('is idempotent — skips existing header', async () => {
    // First find (header) returns existing, second find (footer) returns empty
    mockFind
      .mockResolvedValueOnce({ docs: [{ id: 1 }] }) // header exists
      .mockResolvedValueOnce({ docs: [] }) // footer doesn't
    await createDefaultTenantNavigation(mockPayload as any, 42)
    // Only footer should be created
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate.mock.calls[0][0].collection).toBe('footer')
  })

  it('is idempotent — skips existing footer', async () => {
    mockFind
      .mockResolvedValueOnce({ docs: [] }) // header doesn't exist
      .mockResolvedValueOnce({ docs: [{ id: 1 }] }) // footer exists
    await createDefaultTenantNavigation(mockPayload as any, 42)
    // Only header should be created
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate.mock.calls[0][0].collection).toBe('header')
  })

  it('skips both when both exist', async () => {
    mockFind.mockResolvedValue({ docs: [{ id: 1 }] })
    await createDefaultTenantNavigation(mockPayload as any, 42)
    expect(mockCreate).not.toHaveBeenCalled()
  })
})
