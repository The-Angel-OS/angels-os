/**
 * syncUserTenants Hook — Unit Tests
 *
 * Tests the afterChange hook that syncs active TenantMemberships to the
 * User.tenants array so the multi-tenant plugin admin panel works correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncUserTenants } from '@/collections/TenantMemberships/hooks/syncUserTenants'

// ── Helpers ──────────────────────────────────────────────────────────────────

function makePayload(userTenants: { tenant: number | { id: number } }[] = []) {
  const findByID = vi.fn().mockResolvedValue({ id: 1, tenants: userTenants })
  const update = vi.fn().mockResolvedValue({})
  const logger = { info: vi.fn(), warn: vi.fn() }
  return { findByID, update, logger }
}

function makeArgs(
  doc: Record<string, unknown>,
  payloadOverrides: Partial<ReturnType<typeof makePayload>> = {},
) {
  const payload = { ...makePayload(), ...payloadOverrides }
  return {
    doc,
    req: { payload } as any,
    collection: null as any,
    context: {} as any,
    operation: 'create' as const,
    previousDoc: {},
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('syncUserTenants', () => {
  beforeEach(() => vi.clearAllMocks())

  // ── status guard ──────────────────────────────────────────────────────────

  it('returns doc without DB calls when status is not active', async () => {
    const p = makePayload()
    const args = makeArgs({ id: 1, user: 10, tenant: 20, status: 'pending' }, p)
    const result = await syncUserTenants(args)
    expect(result).toEqual(args.doc)
    expect(p.findByID).not.toHaveBeenCalled()
    expect(p.update).not.toHaveBeenCalled()
  })

  it('returns doc without DB calls when status is suspended', async () => {
    const p = makePayload()
    const args = makeArgs({ id: 1, user: 10, tenant: 20, status: 'suspended' }, p)
    const result = await syncUserTenants(args)
    expect(p.findByID).not.toHaveBeenCalled()
    expect(result).toEqual(args.doc)
  })

  it('returns doc without DB calls when status is revoked', async () => {
    const p = makePayload()
    const args = makeArgs({ id: 1, user: 10, tenant: 20, status: 'revoked' }, p)
    const result = await syncUserTenants(args)
    expect(p.findByID).not.toHaveBeenCalled()
    expect(result).toEqual(args.doc)
  })

  // ── missing IDs guard ─────────────────────────────────────────────────────

  it('returns doc without DB calls when userId is missing', async () => {
    const p = makePayload()
    const args = makeArgs({ id: 1, user: null, tenant: 20, status: 'active' }, p)
    const result = await syncUserTenants(args)
    expect(p.findByID).not.toHaveBeenCalled()
    expect(result).toEqual(args.doc)
  })

  it('returns doc without DB calls when tenantId is missing', async () => {
    const p = makePayload()
    const args = makeArgs({ id: 1, user: 10, tenant: null, status: 'active' }, p)
    const result = await syncUserTenants(args)
    expect(p.findByID).not.toHaveBeenCalled()
    expect(result).toEqual(args.doc)
  })

  // ── happy path ────────────────────────────────────────────────────────────

  it('adds tenant to User.tenants when membership becomes active', async () => {
    const p = makePayload([]) // user has no tenants yet
    const args = makeArgs({ id: 1, user: 10, tenant: 20, status: 'active' }, p)
    await syncUserTenants(args)

    expect(p.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        id: 10,
        data: { tenants: [{ tenant: 20 }] },
        overrideAccess: true,
      }),
    )
  })

  it('supports user as object { id }', async () => {
    const p = makePayload([])
    const args = makeArgs({ id: 1, user: { id: 77 }, tenant: 20, status: 'active' }, p)
    await syncUserTenants(args)

    expect(p.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 77 }),
    )
    expect(p.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 77 }),
    )
  })

  it('supports tenant as object { id }', async () => {
    const p = makePayload([])
    const args = makeArgs({ id: 1, user: 10, tenant: { id: 55 }, status: 'active' }, p)
    await syncUserTenants(args)

    expect(p.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { tenants: [{ tenant: 55 }] },
      }),
    )
  })

  it('preserves existing tenants when adding a new one', async () => {
    const existing = [{ tenant: 5 }, { tenant: 6 }]
    const p = makePayload(existing)
    const args = makeArgs({ id: 1, user: 10, tenant: 99, status: 'active' }, p)
    await syncUserTenants(args)

    const { tenants } = p.update.mock.calls[0][0].data
    expect(tenants).toHaveLength(3)
    expect(tenants).toContainEqual({ tenant: 5 })
    expect(tenants).toContainEqual({ tenant: 6 })
    expect(tenants).toContainEqual({ tenant: 99 })
  })

  // ── idempotency ───────────────────────────────────────────────────────────

  it('skips update when tenant is already in User.tenants (numeric id)', async () => {
    const existing = [{ tenant: 20 }]
    const p = makePayload(existing)
    const args = makeArgs({ id: 1, user: 10, tenant: 20, status: 'active' }, p)
    await syncUserTenants(args)

    expect(p.update).not.toHaveBeenCalled()
  })

  it('skips update when tenant is already in User.tenants (object id)', async () => {
    const existing = [{ tenant: { id: 20 } }]
    const p = makePayload(existing)
    const args = makeArgs({ id: 1, user: 10, tenant: 20, status: 'active' }, p)
    await syncUserTenants(args)

    expect(p.update).not.toHaveBeenCalled()
  })

  // ── error handling ────────────────────────────────────────────────────────

  it('logs warning and returns doc when findByID throws', async () => {
    const p = makePayload()
    p.findByID.mockRejectedValue(new Error('DB error'))
    const args = makeArgs({ id: 1, user: 10, tenant: 20, status: 'active' }, p)
    const result = await syncUserTenants(args)

    expect(p.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to sync'))
    expect(result).toEqual(args.doc)
    expect(p.update).not.toHaveBeenCalled()
  })

  it('logs warning and returns doc when update throws', async () => {
    const p = makePayload([]) // empty tenants so update is attempted
    p.update.mockRejectedValue(new Error('Update failed'))
    const args = makeArgs({ id: 1, user: 10, tenant: 20, status: 'active' }, p)
    const result = await syncUserTenants(args)

    expect(p.logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to sync'))
    expect(result).toEqual(args.doc)
  })

  // ── return value ──────────────────────────────────────────────────────────

  it('returns the original doc in all cases', async () => {
    const p = makePayload([])
    const doc = { id: 1, user: 10, tenant: 20, status: 'active', extra: 'field' }
    const args = makeArgs(doc, p)
    const result = await syncUserTenants(args)
    expect(result).toEqual(doc)
  })
})
