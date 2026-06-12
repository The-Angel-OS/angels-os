import { describe, it, expect, vi, beforeEach } from 'vitest'
import { creditQuestPayout } from '@/utilities/creditQuestPayout'

// Avoid booting the real logError pipeline.
vi.mock('@/utilities/createLogger', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn(), caught: vi.fn(), child: () => ({}), source: 'test' }),
}))

/**
 * Build a mock payload. `state` controls what find() returns:
 *  - settled: token-ledger ref lookup returns 1 (already paid)
 *  - floatBalance / userBalance: wallet balances
 */
function mockPayload(state: { settled?: boolean; floatBalance?: number; userBalance?: number; quest?: any }) {
  const creates: Array<{ collection: string; data: any }> = []
  const updates: Array<{ collection: string; id: any; data: any }> = []

  const payload = {
    find: vi.fn(async ({ collection, where }: any) => {
      if (collection === 'token-ledger') {
        // ref idempotency lookup has a `ref` filter; latest-entry lookup sorts by seq
        if (where?.ref) return { totalDocs: state.settled ? 1 : 0, docs: state.settled ? [{ id: 1 }] : [] }
        return { totalDocs: 0, docs: [] } // no prior entries → genesis
      }
      if (collection === 'wallets') {
        const acct = where?.and?.find((c: any) => c.account)?.account?.equals as string
        const bal = acct?.startsWith('float:') ? (state.floatBalance ?? 0) : (state.userBalance ?? 0)
        return { totalDocs: 1, docs: [{ id: `w:${acct}`, balance: bal }] }
      }
      return { totalDocs: 0, docs: [] }
    }),
    findByID: vi.fn(async () => state.quest ?? { id: 7, title: 'Beach Cleanup', payout: { amount: 300 }, tenant: 5 }),
    create: vi.fn(async ({ collection, data }: any) => { creates.push({ collection, data }); return { id: creates.length } }),
    update: vi.fn(async ({ collection, id, data }: any) => { updates.push({ collection, id, data }); return { id } }),
  }
  return { payload, creates, updates }
}

const participation = { id: 42, quest: 7, participant: 9, tenant: 5 }

describe('creditQuestPayout', () => {
  beforeEach(() => vi.clearAllMocks())

  it('pays the participant from a funded float, ledger + wallets + status', async () => {
    const { payload, creates, updates } = mockPayload({ floatBalance: 1000, userBalance: 0 })
    const r = await creditQuestPayout(payload as any, participation, '2026-06-11T00:00:00Z')

    expect(r).toMatchObject({ ok: true, amount: 300, tokenKind: 'AT' })
    // two hash-linked ledger entries (debit float, credit user)
    const ledger = creates.filter((c) => c.collection === 'token-ledger')
    expect(ledger).toHaveLength(2)
    expect(ledger[0].data.direction).toBe('debit')
    expect(ledger[0].data.account).toBe('float:tenant:5')
    expect(ledger[1].data.direction).toBe('credit')
    expect(ledger[1].data.account).toBe('user:9')
    expect(ledger[1].data.prevHash).toBe(ledger[0].data.hash) // linked
    // wallet balances moved in lock-step
    const walletUpdates = updates.filter((u) => u.collection === 'wallets')
    expect(walletUpdates.map((u) => u.data.balance).sort((a, b) => a - b)).toEqual([300, 700])
    // participation marked paid
    const partUpdate = updates.find((u) => u.collection === 'quest-participations')
    expect(partUpdate?.data).toMatchObject({ payoutStatus: 'paid', payoutAmount: 300 })
  })

  it('is idempotent — already-settled participation is skipped', async () => {
    const { payload, creates, updates } = mockPayload({ settled: true, floatBalance: 1000 })
    const r = await creditQuestPayout(payload as any, participation, '2026-06-11T00:00:00Z')
    expect(r).toMatchObject({ ok: true, skipped: true })
    expect(creates).toHaveLength(0)
    expect(updates).toHaveLength(0)
  })

  it('defers (no payout) when the float is underfunded — issuance stays backed', async () => {
    const { payload, creates, updates } = mockPayload({ floatBalance: 100, userBalance: 0 })
    const r = await creditQuestPayout(payload as any, participation, '2026-06-11T00:00:00Z')
    expect(r).toMatchObject({ ok: false, reason: 'float underfunded' })
    expect(creates).toHaveLength(0)
    expect(updates.find((u) => u.collection === 'quest-participations')).toBeUndefined()
  })

  it('skips a quest with no positive payout', async () => {
    const { payload } = mockPayload({ floatBalance: 1000, quest: { id: 7, title: 'X', payout: { amount: 0 }, tenant: 5 } })
    const r = await creditQuestPayout(payload as any, participation, '2026-06-11T00:00:00Z')
    expect(r).toMatchObject({ ok: true, skipped: true })
  })
})
