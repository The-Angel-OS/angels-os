/**
 * solvency — Unit Tests
 *
 * The one number Kenneth keeps positive. What the tile SHOWS must match what the
 * ledgers HOLD: revenue the platform keeps (JF allocations) minus infra cost
 * (cost-events, excluding BYOK). Verifies the math, the honest edges
 * (disbursements are mission not infra; BYOK is $0 to the platform), the verdict
 * bands, and fail-soft when a ledger is absent.
 */
import { describe, it, expect, vi } from 'vitest'
import { getSolvencySnapshot } from '@/utilities/solvency'

type Doc = Record<string, unknown>

/**
 * Mock payload.find keyed by collection. One page each (totalPages:1) so the
 * paging loop terminates. `throwOn` forces a given collection to throw (missing
 * table on a node) to exercise fail-soft.
 */
function payloadWith(opts: {
  jf?: Doc[]
  cost?: Doc[]
  throwOn?: 'justice-fund-transactions' | 'cost-events'
}) {
  return {
    find: vi.fn(async ({ collection }: { collection: string }) => {
      if (opts.throwOn === collection) throw new Error(`relation "${collection}" does not exist`)
      const docs =
        collection === 'justice-fund-transactions'
          ? opts.jf || []
          : collection === 'cost-events'
            ? opts.cost || []
            : []
      return { docs, totalPages: 1 }
    }),
  } as never
}

describe('getSolvencySnapshot', () => {
  it('is POSITIVE when retained revenue exceeds infra cost', async () => {
    const payload = payloadWith({
      jf: [
        { type: 'allocation', amountCents: 500, sourceTotalCents: 500 }, // $5 donation (100%)
        { type: 'allocation', amountCents: 100, sourceTotalCents: 2000 }, // 5% of a $20 Connect sale
      ],
      cost: [{ category: 'intelligence', costCents: 150, billedToTenantKey: false }],
    })
    const s = await getSolvencySnapshot(payload)
    expect(s.status).toBe('positive')
    expect(s.lifetime.platformRetainedCents).toBe(600) // 500 + 100
    expect(s.lifetime.grossProcessedCents).toBe(2500) // 500 + 2000
    expect(s.lifetime.infraCostCents).toBe(150)
    expect(s.lifetime.operationalNetCents).toBe(450) // 600 - 150
    expect(s.lifetime.revenueEvents).toBe(2)
    expect(s.verdict).toContain('POSITIVE')
  })

  it('is NEGATIVE when infra cost exceeds retained revenue, and names the top cost lever', async () => {
    const payload = payloadWith({
      jf: [{ type: 'allocation', amountCents: 100, sourceTotalCents: 2000 }],
      cost: [
        { category: 'intelligence', costCents: 400, billedToTenantKey: false },
        { category: 'telephony', costCents: 250, billedToTenantKey: false },
      ],
    })
    const s = await getSolvencySnapshot(payload)
    expect(s.status).toBe('negative')
    expect(s.lifetime.infraCostCents).toBe(650)
    expect(s.lifetime.operationalNetCents).toBe(-550) // 100 - 650
    expect(s.topCostCategory).toEqual({ category: 'intelligence', costCents: 400 })
    expect(s.verdict).toContain('intelligence')
  })

  it('reads $0/$0 as WATCH — no money has moved yet', async () => {
    const s = await getSolvencySnapshot(payloadWith({ jf: [], cost: [] }))
    expect(s.status).toBe('watch')
    expect(s.lifetime.operationalNetCents).toBe(0)
    expect(s.verdict).toContain('No money has moved yet')
  })

  it('excludes disbursements from retained revenue but surfaces them separately', async () => {
    const payload = payloadWith({
      jf: [
        { type: 'allocation', amountCents: 500, sourceTotalCents: 500 },
        { type: 'disbursement', amountCents: 300, sourceTotalCents: 0 }, // grant paid OUT
      ],
      cost: [],
    })
    const s = await getSolvencySnapshot(payload)
    expect(s.lifetime.platformRetainedCents).toBe(500) // disbursement NOT counted as revenue
    expect(s.lifetime.disbursedCents).toBe(300)
    expect(s.lifetime.operationalNetCents).toBe(500) // disbursement doesn't reduce operational net
  })

  it('excludes BYOK cost — a tenant\'s own key is $0 to the platform', async () => {
    const payload = payloadWith({
      jf: [{ type: 'allocation', amountCents: 100, sourceTotalCents: 100 }],
      cost: [
        { category: 'intelligence', costCents: 999, billedToTenantKey: true }, // BYOK — ignored
        { category: 'infra', costCents: 40, billedToTenantKey: false },
      ],
    })
    const s = await getSolvencySnapshot(payload)
    expect(s.lifetime.infraCostCents).toBe(40) // 999 BYOK excluded
    expect(s.lifetime.operationalNetCents).toBe(60) // 100 - 40
  })

  it('fail-soft: a missing revenue ledger yields available.revenue=false, not a throw', async () => {
    const s = await getSolvencySnapshot(payloadWith({ throwOn: 'justice-fund-transactions', cost: [] }))
    expect(s.available.revenue).toBe(false)
    expect(s.available.cost).toBe(true)
    expect(s.lifetime.platformRetainedCents).toBe(0)
  })

  it('fail-soft: a missing cost ledger yields available.cost=false', async () => {
    const s = await getSolvencySnapshot(payloadWith({ jf: [], throwOn: 'cost-events' }))
    expect(s.available.cost).toBe(false)
    expect(s.available.revenue).toBe(true)
  })
})
