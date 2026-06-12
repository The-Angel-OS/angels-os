import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fundFloat } from '@/utilities/fundFloat'

function mockPayload(state: { floatBalance?: number | null }) {
  const creates: Array<{ collection: string; data: any }> = []
  const updates: Array<{ collection: string; id: any; data: any }> = []
  const payload = {
    find: vi.fn(async ({ collection }: any) => {
      if (collection === 'wallets') {
        return state.floatBalance == null
          ? { docs: [] }
          : { docs: [{ id: 'w1', balance: state.floatBalance }] }
      }
      if (collection === 'token-ledger') return { docs: [] } // genesis
      return { docs: [] }
    }),
    create: vi.fn(async ({ collection, data }: any) => { creates.push({ collection, data }); return { id: creates.length } }),
    update: vi.fn(async ({ collection, id, data }: any) => { updates.push({ collection, id, data }); return { id } }),
  }
  return { payload, creates, updates }
}

describe('fundFloat', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mints AT into a new float (ledger credit + wallet created)', async () => {
    const { payload, creates } = mockPayload({ floatBalance: null })
    const r = await fundFloat(payload as any, { tenantId: 5, amount: 1000, reason: 'Justice Fund deposit', at: '2026-06-11T00:00:00Z' })
    expect(r).toMatchObject({ ok: true, account: 'float:tenant:5', balance: 1000 })
    const ledger = creates.find((c) => c.collection === 'token-ledger')!
    expect(ledger.data).toMatchObject({ account: 'float:tenant:5', direction: 'credit', amount: 1000, tokenKind: 'AT' })
    const wallet = creates.find((c) => c.collection === 'wallets')!
    expect(wallet.data).toMatchObject({ account: 'float:tenant:5', balance: 1000 })
  })

  it('tops up an existing float (wallet updated, balance accumulates)', async () => {
    const { payload, updates } = mockPayload({ floatBalance: 700 })
    const r = await fundFloat(payload as any, { tenantId: 5, amount: 300, at: '2026-06-11T00:00:00Z' })
    expect(r.balance).toBe(1000)
    expect(updates.find((u) => u.collection === 'wallets')?.data.balance).toBe(1000)
  })

  it('rejects a non-positive amount', async () => {
    const { payload, creates } = mockPayload({ floatBalance: 0 })
    const r = await fundFloat(payload as any, { tenantId: 5, amount: 0 })
    expect(r.ok).toBe(false)
    expect(creates).toHaveLength(0)
  })
})
