/**
 * Media Collection Hooks — Unit Tests
 *
 * Tests setTenantFromHeader (beforeValidate): the resolution order that fixes
 * chat-attachment uploads on the platform/Core domain (no x-tenant-id header,
 * no payload-tenant cookie). Resolution order:
 *   0. explicit data.tenant (server caller)  → untouched
 *   1. _tenantSpace hint → space's tenant     → authoritative for chat uploads
 *   2. x-tenant-id header → tenant by slug     → subdomain fallback
 * The transient _tenantSpace hint must always be stripped before validation.
 */
import { describe, it, expect, vi } from 'vitest'
import { setTenantFromHeader } from '@/collections/Media/hooks/setTenantFromHeader'

describe('setTenantFromHeader', () => {
  function makeArgs({
    operation = 'create' as 'create' | 'update',
    data = {} as Record<string, unknown> | null | undefined,
    space = null as any,
    tenantDocs = [] as any[],
    headerSlug = null as string | null,
  } = {}) {
    const findByID = vi.fn().mockResolvedValue(space)
    const find = vi.fn().mockResolvedValue({ docs: tenantDocs })
    const headers = { get: vi.fn((k: string) => (k === 'x-tenant-id' ? headerSlug : null)) }
    return {
      operation,
      data,
      req: { payload: { findByID, find }, headers } as any,
      collection: null as any,
      context: {} as any,
    }
  }

  it('returns data unchanged on update operation', async () => {
    const args = makeArgs({ operation: 'update', data: { alt: 'x', _tenantSpace: 3 } })
    const result = await setTenantFromHeader(args as any)
    // On non-create we don't touch data (hint is left as-is — never reaches a create validator)
    expect((result as any).tenant).toBeUndefined()
    expect(args.req.payload.findByID).not.toHaveBeenCalled()
    expect(args.req.payload.find).not.toHaveBeenCalled()
  })

  // The space hint is AUTHORITATIVE and deliberately outranks an explicit
  // tenant: a chat attachment must live in its space's tenant, or the message's
  // attachments[].media relationship is rejected as "invalid: Attachments >
  // Media" and the upload appears to fail. This test used to assert the
  // opposite order, from before that fix.
  it('lets a resolvable space hint override an explicit tenant', async () => {
    const args = makeArgs({
      data: { alt: 'x', tenant: 5, _tenantSpace: 9 },
      space: { id: 9, tenant: 20 },
    })
    const result = await setTenantFromHeader(args as any)
    expect((result as any).tenant).toBe(20)
    expect('_tenantSpace' in (result as any)).toBe(false)
  })

  it('keeps an explicit tenant when the space hint resolves to nothing', async () => {
    const args = makeArgs({ data: { alt: 'x', tenant: 5, _tenantSpace: 9 } }) // space = null
    const result = await setTenantFromHeader(args as any)
    expect((result as any).tenant).toBe(5)
    expect('_tenantSpace' in (result as any)).toBe(false)
    expect(args.req.payload.find).not.toHaveBeenCalled() // no header fallback needed
  })

  it('resolves tenant from the _tenantSpace hint (numeric)', async () => {
    const args = makeArgs({
      data: { alt: 'x', _tenantSpace: 10 },
      space: { id: 10, tenant: 20 },
    })
    const result = await setTenantFromHeader(args as any)
    expect((result as any).tenant).toBe(20)
    expect('_tenantSpace' in (result as any)).toBe(false)
    expect(args.req.payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'spaces', id: 10 }),
    )
  })

  it('resolves tenant when space.tenant is an object', async () => {
    const args = makeArgs({
      data: { alt: 'x', _tenantSpace: 10 },
      space: { id: 10, tenant: { id: 99 } },
    })
    const result = await setTenantFromHeader(args as any)
    expect((result as any).tenant).toBe(99)
  })

  it('resolves tenant when the hint is an object with an id', async () => {
    const args = makeArgs({
      data: { alt: 'x', _tenantSpace: { id: 15 } },
      space: { id: 15, tenant: 30 },
    })
    const result = await setTenantFromHeader(args as any)
    expect((result as any).tenant).toBe(30)
    expect(args.req.payload.findByID).toHaveBeenCalledWith(
      expect.objectContaining({ id: 15 }),
    )
  })

  it('prefers the space hint over the header when both are present', async () => {
    const args = makeArgs({
      data: { alt: 'x', _tenantSpace: 10 },
      space: { id: 10, tenant: 20 },
      headerSlug: 'some-tenant',
      tenantDocs: [{ id: 77 }],
    })
    const result = await setTenantFromHeader(args as any)
    expect((result as any).tenant).toBe(20)
    expect(args.req.payload.find).not.toHaveBeenCalled()
  })

  it('falls back to the x-tenant-id header when there is no space hint', async () => {
    const args = makeArgs({
      data: { alt: 'x' },
      headerSlug: 'clearwater-cruisin',
      tenantDocs: [{ id: 42 }],
    })
    const result = await setTenantFromHeader(args as any)
    expect((result as any).tenant).toBe(42)
    expect(args.req.payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'tenants',
        where: { slug: { equals: 'clearwater-cruisin' } },
      }),
    )
  })

  it('falls back to the header when the space lookup yields no tenant', async () => {
    const args = makeArgs({
      data: { alt: 'x', _tenantSpace: 10 },
      space: { id: 10, tenant: null },
      headerSlug: 'fallback-tenant',
      tenantDocs: [{ id: 88 }],
    })
    const result = await setTenantFromHeader(args as any)
    expect((result as any).tenant).toBe(88)
    expect('_tenantSpace' in (result as any)).toBe(false)
  })

  it('falls back to the header when the space lookup throws', async () => {
    const args = makeArgs({
      data: { alt: 'x', _tenantSpace: 10 },
      headerSlug: 'fallback-tenant',
      tenantDocs: [{ id: 88 }],
    })
    args.req.payload.findByID.mockRejectedValue(new Error('DB error'))
    const result = await setTenantFromHeader(args as any)
    expect((result as any).tenant).toBe(88)
  })

  it('returns data (no tenant) when neither hint nor header resolves, hint stripped', async () => {
    const args = makeArgs({ data: { alt: 'x', _tenantSpace: 10 }, space: { id: 10, tenant: null } })
    const result = await setTenantFromHeader(args as any)
    expect((result as any).tenant).toBeUndefined()
    expect('_tenantSpace' in (result as any)).toBe(false)
  })

  it('returns data unchanged when the header tenant lookup throws', async () => {
    const args = makeArgs({ data: { alt: 'x' }, headerSlug: 'broken' })
    args.req.payload.find.mockRejectedValue(new Error('DB error'))
    const result = await setTenantFromHeader(args as any)
    expect((result as any).tenant).toBeUndefined()
  })

  it('preserves other data fields when resolving tenant', async () => {
    const args = makeArgs({
      data: { alt: 'hello.jpg', caption: 'cap', _tenantSpace: 5 },
      space: { id: 5, tenant: 11 },
    })
    const result = await setTenantFromHeader(args as any)
    expect((result as any).alt).toBe('hello.jpg')
    expect((result as any).caption).toBe('cap')
    expect((result as any).tenant).toBe(11)
  })
})
