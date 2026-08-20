/**
 * The failure this locks down: payload.delete({ where }) resolves with a
 * per-document `errors` array instead of throwing, so decommissioning tenant 32
 * on 260820 reported "tenants: 1 deleted" while the row was still live and
 * still serving. A destructive tool that lies about what it destroyed is worse
 * than one that fails loudly.
 */
import { describe, it, expect, vi } from 'vitest'
import { decommissionTenant } from '@/utilities/decommissionTenant'

function fakePayload(opts: { bulkDeleteFails?: boolean; rawFails?: boolean }) {
  const rawQueries: string[] = []
  const pool = {
    query: vi.fn(async (sql: string) => {
      rawQueries.push(sql)
      if (opts.rawFails && sql.startsWith('DELETE FROM tenants')) throw new Error('raw delete blocked')
      return { rowCount: 1, rows: [{ count: '0' }] }
    }),
  }
  const payload = {
    db: { pool },
    find: vi.fn(async ({ collection }: { collection: string }) =>
      collection === 'tenants'
        ? { docs: [{ id: 32, name: 'Retired', slug: 'retired-demo-32', domain: 'x.example.com' }], totalDocs: 1 }
        : { docs: [], totalDocs: 0 },
    ),
    count: vi.fn(async () => ({ totalDocs: 0 })),
    update: vi.fn(async () => ({})),
    delete: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'tenants' && opts.bulkDeleteFails) {
        // Exactly what Payload returns when an afterDelete hook throws.
        return { docs: [], errors: [{ message: 'afterDelete hook failed' }] }
      }
      return { docs: [{ id: 1 }], errors: [] }
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any
  return { payload, rawQueries }
}

const tenantStep = (r: { steps: { collection: string }[] }) =>
  r.steps.find((s) => s.collection === 'tenants')

describe('decommissionTenant — the tenant row', () => {
  it('falls back to a raw delete when the bulk delete reports errors', async () => {
    const { payload, rawQueries } = fakePayload({ bulkDeleteFails: true })
    const res = await decommissionTenant(payload, { slug: 'retired-demo-32', execute: true })

    expect(rawQueries.some((q) => q.startsWith('DELETE FROM tenants'))).toBe(true)
    expect(tenantStep(res)?.status).toBe('deleted')
  })

  it('reports an error rather than success when nothing could remove the row', async () => {
    const { payload } = fakePayload({ bulkDeleteFails: true, rawFails: true })
    const res = await decommissionTenant(payload, { slug: 'retired-demo-32', execute: true })

    const step = tenantStep(res)
    expect(step?.status).toBe('error')
    expect(step?.count).toBe(0)
  })

  it('does not touch anything on a dry run', async () => {
    const { payload, rawQueries } = fakePayload({})
    const res = await decommissionTenant(payload, { slug: 'retired-demo-32', execute: false })

    expect(payload.delete).not.toHaveBeenCalled()
    expect(rawQueries.some((q) => q.startsWith('DELETE'))).toBe(false)
    expect(res.execute).toBe(false)
  })
})
