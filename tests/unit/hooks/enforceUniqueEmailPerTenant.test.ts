/**
 * enforceUniqueEmailPerTenant Hook — Unit Tests
 *
 * Tests the compound [email + tenant] uniqueness check on the Contacts collection.
 */
import { describe, it, expect, vi } from 'vitest'
import { enforceUniqueEmailPerTenant } from '@/collections/Contacts/hooks/enforceUniqueEmailPerTenant'

// ── Helper ────────────────────────────────────────────────────────────────────

function makeArgs({
  data = {} as Record<string, unknown> | null | undefined,
  operation = 'create' as 'create' | 'update',
  originalDoc = {} as Record<string, unknown>,
  existingDocs = [] as any[],
} = {}) {
  const payload = {
    find: vi.fn().mockResolvedValue({ docs: existingDocs }),
  }
  return {
    data,
    operation,
    originalDoc,
    req: { payload } as any,
    collection: null as any,
    context: {} as any,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('enforceUniqueEmailPerTenant', () => {
  // ── early exits ───────────────────────────────────────────────────────────

  it('returns data unchanged when no email in data', async () => {
    const args = makeArgs({ data: { name: 'Alice' } })
    const result = await enforceUniqueEmailPerTenant(args as any)
    expect(result).toEqual({ name: 'Alice' })
    expect(args.req.payload.find).not.toHaveBeenCalled()
  })

  it('returns data unchanged when no tenant in data or originalDoc', async () => {
    const args = makeArgs({ data: { email: 'alice@test.com' } })
    const result = await enforceUniqueEmailPerTenant(args as any)
    expect(result).toEqual({ email: 'alice@test.com' })
    expect(args.req.payload.find).not.toHaveBeenCalled()
  })

  it('returns data when data is null', async () => {
    const args = makeArgs({ data: null })
    const result = await enforceUniqueEmailPerTenant(args as any)
    expect(result).toBeNull()
  })

  // ── email normalization ───────────────────────────────────────────────────

  it('normalizes email to lowercase', async () => {
    const args = makeArgs({ data: { email: 'ALICE@TEST.COM', tenant: 1 }, existingDocs: [] })
    const result = await enforceUniqueEmailPerTenant(args as any) as any
    expect(result.email).toBe('alice@test.com')
  })

  it('trims whitespace from email', async () => {
    const args = makeArgs({ data: { email: '  alice@test.com  ', tenant: 1 }, existingDocs: [] })
    const result = await enforceUniqueEmailPerTenant(args as any) as any
    expect(result.email).toBe('alice@test.com')
  })

  // ── tenant resolution ─────────────────────────────────────────────────────

  it('uses tenant from data (numeric)', async () => {
    const args = makeArgs({ data: { email: 'a@b.com', tenant: 5 }, existingDocs: [] })
    await enforceUniqueEmailPerTenant(args as any)
    expect(args.req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          and: expect.arrayContaining([{ tenant: { equals: 5 } }]),
        }),
      }),
    )
  })

  it('uses tenant from data (object with id)', async () => {
    const args = makeArgs({ data: { email: 'a@b.com', tenant: { id: 10 } }, existingDocs: [] })
    await enforceUniqueEmailPerTenant(args as any)
    expect(args.req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          and: expect.arrayContaining([{ tenant: { equals: 10 } }]),
        }),
      }),
    )
  })

  it('falls back to originalDoc tenant when data has no tenant', async () => {
    const args = makeArgs({
      data: { email: 'a@b.com' },
      originalDoc: { tenant: 7, id: 99 },
      existingDocs: [],
    })
    await enforceUniqueEmailPerTenant(args as any)
    expect(args.req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          and: expect.arrayContaining([{ tenant: { equals: 7 } }]),
        }),
      }),
    )
  })

  // ── duplicate detection on create ─────────────────────────────────────────

  it('throws on create when email already exists for tenant', async () => {
    const args = makeArgs({
      data: { email: 'dup@test.com', tenant: 1 },
      operation: 'create',
      existingDocs: [{ id: 50, email: 'dup@test.com', tenant: 1 }],
    })
    await expect(enforceUniqueEmailPerTenant(args as any)).rejects.toThrow(
      /already exists for this tenant/i,
    )
  })

  it('does NOT throw on create when no duplicate found', async () => {
    const args = makeArgs({
      data: { email: 'new@test.com', tenant: 1 },
      operation: 'create',
      existingDocs: [],
    })
    await expect(enforceUniqueEmailPerTenant(args as any)).resolves.not.toThrow()
  })

  // ── duplicate detection on update ─────────────────────────────────────────

  it('throws on update when different record has same email in tenant', async () => {
    const args = makeArgs({
      data: { email: 'dup@test.com', tenant: 1 },
      operation: 'update',
      originalDoc: { id: 10, tenant: 1 },
      existingDocs: [{ id: 50 }], // different ID
    })
    await expect(enforceUniqueEmailPerTenant(args as any)).rejects.toThrow(
      /already exists for this tenant/i,
    )
  })

  it('does NOT throw on update when same record has same email (self-update)', async () => {
    const args = makeArgs({
      data: { email: 'same@test.com', tenant: 1 },
      operation: 'update',
      originalDoc: { id: 10, tenant: 1 },
      existingDocs: [{ id: 10 }], // same ID = self
    })
    await expect(enforceUniqueEmailPerTenant(args as any)).resolves.not.toThrow()
  })

  it('does NOT throw on update when no duplicate found', async () => {
    const args = makeArgs({
      data: { email: 'unique@test.com', tenant: 1 },
      operation: 'update',
      originalDoc: { id: 10, tenant: 1 },
      existingDocs: [],
    })
    await expect(enforceUniqueEmailPerTenant(args as any)).resolves.not.toThrow()
  })
})
