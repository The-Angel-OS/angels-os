/**
 * autoJoinTenantSpaces Hook — Unit Tests
 *
 * Tests that newly created users are automatically added to ALL spaces
 * of each tenant they belong to via TenantMemberships.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { autoJoinTenantSpaces } from '@/collections/Users/hooks/autoJoinTenantSpaces'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePayload({
  memberships = [] as any[],
  spaces = [] as any[],
  existingMembership = false,
}: {
  memberships?: any[]
  spaces?: any[]
  existingMembership?: boolean
} = {}) {
  const find = vi.fn().mockImplementation(({ collection }: { collection: string }) => {
    if (collection === 'tenant-memberships') return Promise.resolve({ docs: memberships, totalDocs: memberships.length })
    if (collection === 'spaces') return Promise.resolve({ docs: spaces, totalDocs: spaces.length })
    if (collection === 'space-memberships') return Promise.resolve({ docs: existingMembership ? [{ id: 999 }] : [], totalDocs: existingMembership ? 1 : 0 })
    return Promise.resolve({ docs: [], totalDocs: 0 })
  })
  const create = vi.fn().mockResolvedValue({ id: 100 })
  const logger = { info: vi.fn(), warn: vi.fn() }
  return { find, create, logger }
}

function makeArgs(
  docOverrides: Record<string, unknown> = {},
  payloadOverrides: Partial<ReturnType<typeof makePayload>> = {},
  operation: 'create' | 'update' = 'create',
) {
  const payload = { ...makePayload(), ...payloadOverrides }
  const doc = { id: 1, email: 'user@test.com', ...docOverrides }
  return {
    doc,
    operation,
    req: { payload } as any,
    collection: null as any,
    context: {} as any,
    previousDoc: {},
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('autoJoinTenantSpaces', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── operation guard ───────────────────────────────────────────────────────

  it('returns doc unchanged on update operation', async () => {
    const p = makePayload()
    const args = makeArgs({}, p, 'update')
    const result = await autoJoinTenantSpaces(args as any)
    expect(result).toEqual(args.doc)
    expect(p.find).not.toHaveBeenCalled()
  })

  it('returns doc unchanged when doc is a system user', async () => {
    const p = makePayload()
    const args = makeArgs({ isSystemUser: true }, p)
    const result = await autoJoinTenantSpaces(args as any)
    expect(result).toEqual(args.doc)
    expect(p.find).not.toHaveBeenCalled()
  })

  // ── no memberships ────────────────────────────────────────────────────────

  it('returns doc without creating memberships when user has no tenant memberships', async () => {
    const p = makePayload({ memberships: [] })
    const args = makeArgs({}, p)
    await autoJoinTenantSpaces(args as any)
    expect(p.create).not.toHaveBeenCalled()
  })

  // ── no spaces ─────────────────────────────────────────────────────────────

  it('does not create space-membership when tenant has no spaces', async () => {
    const p = makePayload({
      memberships: [{ id: 1, tenant: 10, status: 'active' }],
      spaces: [],
    })
    const args = makeArgs({}, p)
    await autoJoinTenantSpaces(args as any)
    expect(p.create).not.toHaveBeenCalled()
  })

  // ── happy path ────────────────────────────────────────────────────────────

  it('creates space-membership for all spaces of the tenant', async () => {
    const p = {
      ...makePayload(),
      find: vi.fn().mockImplementation(({ collection }: any) => {
        if (collection === 'tenant-memberships') return Promise.resolve({ docs: [{ id: 1, tenant: 10, status: 'active' }], totalDocs: 1 })
        if (collection === 'spaces') return Promise.resolve({ docs: [{ id: 50, name: 'Main Space', tenant: 10 }, { id: 51, name: 'Support Space', tenant: 10 }], totalDocs: 2 })
        if (collection === 'space-memberships') return Promise.resolve({ docs: [], totalDocs: 0 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
      create: vi.fn().mockResolvedValue({ id: 100 }),
      logger: { info: vi.fn(), warn: vi.fn() },
    }
    const args = makeArgs({}, p)
    await autoJoinTenantSpaces(args as any)

    expect(p.create).toHaveBeenCalledTimes(2)
    expect(p.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'space-memberships',
        data: expect.objectContaining({
          user: 1,
          space: 50,
          role: 'member',
          status: 'active',
          tenant: 10,
        }),
      }),
    )
    expect(p.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'space-memberships',
        data: expect.objectContaining({
          user: 1,
          space: 51,
          role: 'member',
          status: 'active',
          tenant: 10,
        }),
      }),
    )
  })

  it('handles tenant as object { id }', async () => {
    const p = {
      ...makePayload(),
      find: vi.fn().mockImplementation(({ collection }: any) => {
        if (collection === 'tenant-memberships') return Promise.resolve({ docs: [{ id: 1, tenant: { id: 20 }, status: 'active' }], totalDocs: 1 })
        if (collection === 'spaces') return Promise.resolve({ docs: [{ id: 60, name: 'Space', tenant: 20 }], totalDocs: 1 })
        if (collection === 'space-memberships') return Promise.resolve({ docs: [], totalDocs: 0 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
      create: vi.fn().mockResolvedValue({ id: 100 }),
      logger: { info: vi.fn(), warn: vi.fn() },
    }
    const args = makeArgs({}, p)
    await autoJoinTenantSpaces(args as any)

    expect(p.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenant: 20 }),
      }),
    )
  })

  // ── idempotency ───────────────────────────────────────────────────────────

  it('skips space-membership creation when already a member', async () => {
    const p = {
      ...makePayload(),
      find: vi.fn().mockImplementation(({ collection }: any) => {
        if (collection === 'tenant-memberships') return Promise.resolve({ docs: [{ id: 1, tenant: 10, status: 'active' }], totalDocs: 1 })
        if (collection === 'spaces') return Promise.resolve({ docs: [{ id: 50, name: 'Main Space' }], totalDocs: 1 })
        if (collection === 'space-memberships') return Promise.resolve({ docs: [{ id: 999 }], totalDocs: 1 })
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
      create: vi.fn().mockResolvedValue({ id: 100 }),
      logger: { info: vi.fn(), warn: vi.fn() },
    }
    const args = makeArgs({}, p)
    await autoJoinTenantSpaces(args as any)
    expect(p.create).not.toHaveBeenCalled()
  })

  // ── multiple tenants ──────────────────────────────────────────────────────

  it('processes multiple tenant memberships with multiple spaces each', async () => {
    const p = {
      ...makePayload(),
      find: vi.fn().mockImplementation(({ collection, where }: any) => {
        if (collection === 'tenant-memberships') {
          return Promise.resolve({
            docs: [{ id: 1, tenant: 10, status: 'active' }, { id: 2, tenant: 20, status: 'active' }],
            totalDocs: 2,
          })
        }
        if (collection === 'spaces') {
          const tenantId = where?.tenant?.equals
          if (tenantId === 10) {
            return Promise.resolve({
              docs: [{ id: 50, name: 'Main', tenant: 10 }, { id: 51, name: 'Support', tenant: 10 }],
              totalDocs: 2,
            })
          }
          return Promise.resolve({
            docs: [{ id: 60, name: 'Space', tenant: tenantId }],
            totalDocs: 1,
          })
        }
        if (collection === 'space-memberships') {
          return Promise.resolve({ docs: [], totalDocs: 0 })
        }
        return Promise.resolve({ docs: [], totalDocs: 0 })
      }),
      create: vi.fn().mockResolvedValue({ id: 100 }),
      logger: { info: vi.fn(), warn: vi.fn() },
    }
    const args = makeArgs({}, p)
    await autoJoinTenantSpaces(args as any)
    // 2 spaces for tenant 10 + 1 space for tenant 20 = 3 memberships
    expect(p.create).toHaveBeenCalledTimes(3)
  })

  // ── error resilience ──────────────────────────────────────────────────────

  it('returns doc even when inner space lookup throws', async () => {
    const p = {
      ...makePayload(),
      find: vi.fn().mockImplementation(({ collection }: any) => {
        if (collection === 'tenant-memberships') {
          return Promise.resolve({ docs: [{ id: 1, tenant: 10, status: 'active' }], totalDocs: 1 })
        }
        return Promise.reject(new Error('DB error'))
      }),
      create: vi.fn(),
      logger: { info: vi.fn(), warn: vi.fn() },
    }
    const args = makeArgs({}, p)
    const result = await autoJoinTenantSpaces(args as any)
    expect(result).toEqual(args.doc)
    expect(p.logger.warn).toHaveBeenCalled()
  })

  it('returns doc even when membership lookup throws at the top level', async () => {
    const p = makePayload()
    p.find.mockRejectedValue(new Error('Top-level DB error'))
    const args = makeArgs({}, p)
    const result = await autoJoinTenantSpaces(args as any)
    expect(result).toEqual(args.doc)
    expect(p.logger.warn).toHaveBeenCalled()
  })

  // ── return value ──────────────────────────────────────────────────────────

  it('always returns the original doc', async () => {
    const p = makePayload({ memberships: [], spaces: [] })
    const doc = { id: 5, email: 'test@example.com', extra: 'field' }
    const args = makeArgs(doc, p)
    const result = await autoJoinTenantSpaces(args as any)
    expect(result).toEqual(doc)
  })
})
