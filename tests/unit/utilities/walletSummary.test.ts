import { describe, it, expect, vi } from 'vitest'
import { getWalletSummary } from '@/utilities/walletSummary'

function mockPayload(wallets: any[], ledger: any[]) {
  return {
    find: vi.fn(async ({ collection }: any) => {
      if (collection === 'wallets') return { docs: wallets }
      if (collection === 'token-ledger') {
        // endpoint sorts -seq (desc); emulate by reversing seq order
        return { docs: [...ledger].sort((a, b) => Number(b.seq) - Number(a.seq)) }
      }
      return { docs: [] }
    }),
  } as any
}

describe('getWalletSummary', () => {
  it('aggregates balances per tokenKind and returns recent ledger', async () => {
    const payload = mockPayload(
      [
        { tokenKind: 'AT', balance: 300 },
        { tokenKind: 'KC', balance: '50' }, // string (pg numeric) coerced
      ],
      [
        { seq: 0, direction: 'credit', tokenKind: 'AT', amount: 1000, reason: 'fund', hash: 'h0', prevHash: '0'.repeat(64) },
        { seq: 1, direction: 'debit', tokenKind: 'AT', amount: 700, reason: 'pay', hash: 'h1', prevHash: 'h0' },
      ],
    )
    const s = await getWalletSummary(payload, { tenantId: 5, account: 'user:9' })
    expect(s.balances).toEqual({ AT: 300, KC: 50, LT: 0 })
    expect(s.recent.map((r) => r.seq)).toEqual([1, 0]) // most-recent first
    expect(s.chainOk).toBe(true)
  })

  it('flags a broken link in the slice', async () => {
    const payload = mockPayload(
      [{ tokenKind: 'AT', balance: 0 }],
      [
        { seq: 0, direction: 'credit', tokenKind: 'AT', amount: 1, reason: 'a', hash: 'h0', prevHash: '0'.repeat(64) },
        { seq: 1, direction: 'credit', tokenKind: 'AT', amount: 1, reason: 'b', hash: 'h1', prevHash: 'WRONG' },
      ],
    )
    const s = await getWalletSummary(payload, { tenantId: 5, account: 'user:9' })
    expect(s.chainOk).toBe(false)
  })

  it('empty holder → zeroed balances, no entries', async () => {
    const s = await getWalletSummary(mockPayload([], []), { tenantId: 5, account: 'user:9' })
    expect(s.balances).toEqual({ AT: 0, KC: 0, LT: 0 })
    expect(s.recent).toEqual([])
    expect(s.chainOk).toBe(true)
  })
})
