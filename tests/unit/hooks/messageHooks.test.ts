/**
 * Message Collection Hooks — Unit Tests
 *
 * Tests setAuthor (beforeChange) and setTenantFromSpace (beforeValidate).
 */
import { describe, it, expect, vi } from 'vitest'
import { setAuthor } from '@/collections/Messages/hooks/setAuthor'
import { setTenantFromSpace } from '@/collections/Messages/hooks/setTenantFromSpace'

// ── setAuthor ─────────────────────────────────────────────────────────────────

describe('setAuthor', () => {
  function makeArgs({
    operation = 'create' as 'create' | 'update',
    userId = 42,
    data = {} as Record<string, unknown>,
    user = null as null | { id: number },
  } = {}) {
    return {
      operation,
      data,
      req: { user: user ?? (userId ? { id: userId } : null) } as any,
      collection: null as any,
      context: {} as any,
    }
  }

  it('sets author to current user ID on create', () => {
    const result = setAuthor(makeArgs({ operation: 'create', data: { content: 'hello' } }))
    expect((result as any).author).toBe(42)
  })

  it('does not overwrite existing author on create', () => {
    const result = setAuthor(makeArgs({ operation: 'create', data: { author: 99 } }))
    expect((result as any).author).toBe(99)
  })

  it('does not set author on update', () => {
    const result = setAuthor(makeArgs({ operation: 'update', data: { content: 'edit' } }))
    expect((result as any).author).toBeUndefined()
  })

  it('does not set author when no user in request', () => {
    const args = { ...makeArgs({ operation: 'create', data: {} }), req: { user: null } as any }
    const result = setAuthor(args as any)
    expect((result as any).author).toBeUndefined()
  })

  it('preserves other data fields', () => {
    const result = setAuthor(makeArgs({ operation: 'create', data: { space: 5, text: 'hi' } }))
    expect((result as any).space).toBe(5)
    expect((result as any).text).toBe('hi')
  })

  it('returns data unchanged on update', () => {
    const data = { content: 'edited', space: 7 }
    const result = setAuthor(makeArgs({ operation: 'update', data }))
    expect(result).toEqual(data)
  })
})

// ── setTenantFromSpace ────────────────────────────────────────────────────────

describe('setTenantFromSpace', () => {
  function makeArgs({
    operation = 'create' as 'create' | 'update',
    data = {} as Record<string, unknown> | null | undefined,
    space = null as any,
  } = {}) {
    const findByID = vi.fn().mockResolvedValue(space)
    const payload = { findByID }
    return {
      operation,
      data,
      req: { payload } as any,
      collection: null as any,
      context: {} as any,
    }
  }

  it('returns data unchanged on update operation', async () => {
    const args = makeArgs({ operation: 'update', data: { space: 1 } })
    const result = await setTenantFromSpace(args as any)
    expect(result).toEqual({ space: 1 })
    expect(args.req.payload.findByID).not.toHaveBeenCalled()
  })

  it('returns data unchanged when tenant is already set', async () => {
    const args = makeArgs({ data: { space: 1, tenant: 5 } })
    const result = await setTenantFromSpace(args as any)
    expect(result).toEqual({ space: 1, tenant: 5 })
    expect(args.req.payload.findByID).not.toHaveBeenCalled()
  })

  it('returns data unchanged when space is not set', async () => {
    const args = makeArgs({ data: { content: 'msg' } })
    const result = await setTenantFromSpace(args as any)
    expect(result).toEqual({ content: 'msg' })
    expect(args.req.payload.findByID).not.toHaveBeenCalled()
  })

  it('resolves tenant from space when tenant is missing', async () => {
    const args = makeArgs({
      data: { space: 10 },
      space: { id: 10, tenant: 20 },
    })
    const result = await setTenantFromSpace(args as any)
    expect((result as any).tenant).toBe(20)
  })

  it('resolves tenant when space.tenant is an object', async () => {
    const args = makeArgs({
      data: { space: 10 },
      space: { id: 10, tenant: { id: 99 } },
    })
    const result = await setTenantFromSpace(args as any)
    expect((result as any).tenant).toBe(99)
  })

  it('passes space id (number) to findByID', async () => {
    const args = makeArgs({
      data: { space: 7 },
      space: { id: 7, tenant: 3 },
    })
    await setTenantFromSpace(args as any)
    expect(args.req.payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'spaces', id: 7 }),
    )
  })

  it('passes space id when space is an object with id', async () => {
    const args = makeArgs({
      data: { space: { id: 15 } },
      space: { id: 15, tenant: 30 },
    })
    await setTenantFromSpace(args as any)
    expect(args.req.payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ id: 15 }),
    )
  })

  it('returns data unchanged when space has no tenant', async () => {
    const args = makeArgs({
      data: { space: 10 },
      space: { id: 10, tenant: null },
    })
    const result = await setTenantFromSpace(args as any)
    expect((result as any).tenant).toBeUndefined()
  })

  it('returns data unchanged when findByID throws', async () => {
    const args = makeArgs({ data: { space: 10 } })
    args.req.payload.findByID.mockRejectedValue(new Error('DB error'))
    const result = await setTenantFromSpace(args as any)
    expect(result).toEqual({ space: 10 })
  })

  it('preserves other data fields when resolving tenant', async () => {
    const args = makeArgs({
      data: { space: 5, content: 'hello', type: 'text' },
      space: { id: 5, tenant: 11 },
    })
    const result = await setTenantFromSpace(args as any)
    expect((result as any).content).toBe('hello')
    expect((result as any).type).toBe('text')
    expect((result as any).space).toBe(5)
  })
})
