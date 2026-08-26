import { describe, it, expect } from 'vitest'
import { setTenantFromItems } from '@/collections/Orders/hooks/setTenantFromItems'

const run = (data: Record<string, unknown>, opts: { header?: string } = {}) =>
  (setTenantFromItems as unknown as (a: unknown) => Promise<Record<string, unknown>>)({
    data,
    operation: 'create',
    req: {
      headers: { get: (k: string) => (k === 'x-tenant-id' ? (opts.header ?? null) : null) },
      payload: {
        findByID: async ({ id }: { id: number }) => (id === 76 ? { tenant: 1 } : null),
        find: async () => ({ docs: opts.header === 'kessela' ? [{ id: 30 }] : [] }),
      },
    },
  })

describe('an order gets its seller as its tenant', () => {
  it('reads it off the first line item — this is what checkout could not do', async () => {
    expect(await run({ items: [{ product: 76, quantity: 1 }] })).toMatchObject({ tenant: 1 })
  })

  it('accepts a populated product relationship too', async () => {
    expect(await run({ items: [{ product: { id: 76 } }] })).toMatchObject({ tenant: 1 })
  })

  it('never overrides a tenant a server caller already set', async () => {
    expect(await run({ tenant: 99, items: [{ product: 76 }] })).toMatchObject({ tenant: 99 })
  })

  it('falls back to the portal subdomain when there are no product lines', async () => {
    expect(await run({ items: [] }, { header: 'kessela' })).toMatchObject({ tenant: 30 })
  })

  it('leaves tenant unset when it cannot be resolved, rather than guessing', async () => {
    expect((await run({ items: [{ product: 999 }] })).tenant).toBeUndefined()
  })
})
