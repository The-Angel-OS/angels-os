/**
 * ensureFirstUserIsAdmin FieldHook — Unit Tests
 *
 * Tests the logic that auto-assigns 'super_admin' role to the very first
 * real user created in the platform.
 */
import { describe, it, expect, vi } from 'vitest'
import { ensureFirstUserIsAdmin } from '@/collections/Users/hooks/ensureFirstUserIsAdmin'

// ── Helper ────────────────────────────────────────────────────────────────────

function makeArgs({
  operation = 'create',
  value = [],
  siblingData = {},
  totalDocs = 0,
}: {
  operation?: 'create' | 'update'
  value?: string[]
  siblingData?: Record<string, unknown>
  totalDocs?: number
} = {}) {
  const payload = {
    find: vi.fn().mockResolvedValue({ totalDocs }),
  }
  return {
    operation,
    value,
    siblingData,
    req: { payload } as any,
    data: {} as any,
    field: {} as any,
    previousValue: [] as any,
    originalDoc: {} as any,
    context: {} as any,
    collection: null as any,
  }
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('ensureFirstUserIsAdmin', () => {
  // ── update operation ───────────────────────────────────────────────────────

  it('returns value unchanged on update operation', async () => {
    const args = makeArgs({ operation: 'update', value: ['admin'] })
    const result = await ensureFirstUserIsAdmin(args)
    expect(result).toEqual(['admin'])
    expect(args.req.payload.find).not.toHaveBeenCalled()
  })

  // ── system user guard ──────────────────────────────────────────────────────

  it('returns value unchanged for system users on create', async () => {
    const args = makeArgs({ siblingData: { isSystemUser: true }, value: [] })
    const result = await ensureFirstUserIsAdmin(args)
    expect(result).toEqual([])
    expect(args.req.payload.find).not.toHaveBeenCalled()
  })

  // ── first real user ────────────────────────────────────────────────────────

  it('adds super_admin to roles when no users exist yet', async () => {
    const args = makeArgs({ totalDocs: 0, value: [] })
    const result = await ensureFirstUserIsAdmin(args)
    expect(result).toContain('super_admin')
  })

  it('does not duplicate super_admin if already present', async () => {
    const args = makeArgs({ totalDocs: 0, value: ['super_admin'] })
    const result = await ensureFirstUserIsAdmin(args)
    const count = (result as string[]).filter((r: string) => r === 'super_admin').length
    expect(count).toBe(1)
  })

  it('preserves other roles when appending super_admin', async () => {
    const args = makeArgs({ totalDocs: 0, value: ['admin'] })
    const result = await ensureFirstUserIsAdmin(args)
    expect(result).toContain('admin')
    expect(result).toContain('super_admin')
  })

  it('queries users excluding system users', async () => {
    const args = makeArgs({ totalDocs: 0 })
    await ensureFirstUserIsAdmin(args)
    expect(args.req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        where: expect.objectContaining({ isSystemUser: { not_equals: true } }),
      }),
    )
  })

  // ── subsequent users ───────────────────────────────────────────────────────

  it('does not add super_admin when other users already exist', async () => {
    const args = makeArgs({ totalDocs: 5, value: [] })
    const result = await ensureFirstUserIsAdmin(args)
    expect(result).toEqual([])
    expect(result).not.toContain('super_admin')
  })

  it('returns existing roles unchanged when not first user', async () => {
    const args = makeArgs({ totalDocs: 3, value: ['member'] })
    const result = await ensureFirstUserIsAdmin(args)
    expect(result).toEqual(['member'])
  })

  // ── null/undefined value ───────────────────────────────────────────────────

  it('handles null value by creating array with super_admin', async () => {
    const args = makeArgs({ totalDocs: 0, value: null as any })
    const result = await ensureFirstUserIsAdmin(args)
    expect(result).toContain('super_admin')
  })

  it('handles undefined value by creating array with super_admin', async () => {
    const args = makeArgs({ totalDocs: 0, value: undefined as any })
    const result = await ensureFirstUserIsAdmin(args)
    expect(result).toContain('super_admin')
  })
})
