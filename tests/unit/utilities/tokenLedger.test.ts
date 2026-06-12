import { describe, it, expect } from 'vitest'
import {
  appendEntry,
  buildTransfer,
  computeBalance,
  hashEntry,
  verifyChain,
  GENESIS_HASH,
  TOKEN_KINDS,
  type LedgerEntry,
} from '@/utilities/tokenLedger'

const AT = (
  prev: LedgerEntry | null,
  account: string,
  direction: 'credit' | 'debit',
  amount: number,
  priorBalance: number,
) => appendEntry(prev, { account, tokenKind: 'AT', direction, amount, reason: 'test', at: '2026-06-11T00:00:00Z' }, priorBalance)

describe('tokenLedger', () => {
  it('AT is convertible; KC and LT are not (policy in code)', () => {
    expect(TOKEN_KINDS.AT.convertible).toBe(true)
    expect(TOKEN_KINDS.KC.convertible).toBe(false)
    expect(TOKEN_KINDS.LT.convertible).toBe(false)
  })

  it('first entry links to genesis and credits correctly', () => {
    const e = AT(null, 'user:1', 'credit', 500, 0)
    expect(e.seq).toBe(0)
    expect(e.prevHash).toBe(GENESIS_HASH)
    expect(e.balanceAfter).toBe(500)
    expect(e.hash).toHaveLength(64)
  })

  it('hashing is deterministic for identical input', () => {
    const a = AT(null, 'user:1', 'credit', 500, 0)
    const b = AT(null, 'user:1', 'credit', 500, 0)
    expect(a.hash).toBe(b.hash)
  })

  it('chains entries and tracks per-account balance', () => {
    const e0 = AT(null, 'user:1', 'credit', 500, 0)
    const e1 = AT(e0, 'user:1', 'debit', 200, 500)
    expect(e1.prevHash).toBe(e0.hash)
    expect(e1.seq).toBe(1)
    expect(computeBalance([e0, e1], 'user:1', 'AT')).toBe(300)
  })

  it('rejects a debit that would go negative (no accidental overdraft)', () => {
    const e0 = AT(null, 'user:1', 'credit', 100, 0)
    expect(() => AT(e0, 'user:1', 'debit', 250, 100)).toThrow(/insufficient AT/)
  })

  it('rejects non-positive / non-integer amounts', () => {
    expect(() => AT(null, 'user:1', 'credit', 0, 0)).toThrow(/positive integer/)
    expect(() => AT(null, 'user:1', 'credit', 1.5, 0)).toThrow(/positive integer/)
  })

  it('computeBalance isolates by account AND tokenKind', () => {
    const e0 = AT(null, 'user:1', 'credit', 500, 0)
    const e1 = appendEntry(e0, { account: 'user:1', tokenKind: 'KC', direction: 'credit', amount: 999, reason: 'tip', at: '2026-06-11T00:00:00Z' }, 0)
    const e2 = AT(e1, 'user:2', 'credit', 100, 0)
    const log = [e0, e1, e2]
    expect(computeBalance(log, 'user:1', 'AT')).toBe(500)
    expect(computeBalance(log, 'user:1', 'KC')).toBe(999)
    expect(computeBalance(log, 'user:2', 'AT')).toBe(100)
  })

  it('verifyChain passes on a valid chain', () => {
    const e0 = AT(null, 'user:1', 'credit', 500, 0)
    const e1 = AT(e0, 'user:1', 'debit', 200, 500)
    expect(verifyChain([e0, e1])).toEqual({ ok: true })
  })

  it('verifyChain detects a tampered amount', () => {
    const e0 = AT(null, 'user:1', 'credit', 500, 0)
    const e1 = AT(e0, 'user:1', 'debit', 200, 500)
    const tampered = [{ ...e0, amount: 5000, balanceAfter: 5000 }, e1] // forged credit, hash now stale
    const v = verifyChain(tampered)
    expect(v.ok).toBe(false)
    expect(v.brokenAt).toBe(0)
    expect(v.reason).toMatch(/tampered/)
  })

  it('verifyChain detects a broken link (reordering / deletion)', () => {
    const e0 = AT(null, 'user:1', 'credit', 500, 0)
    const e1 = AT(e0, 'user:1', 'debit', 200, 500)
    const v = verifyChain([e1, e0]) // swapped
    expect(v.ok).toBe(false)
  })

  it('buildTransfer is double-entry: float debit + recipient credit, hash-linked', () => {
    // Diocese float holds 1000 AT; pay user:7 a 300 AT quest payout.
    const [debit, credit] = buildTransfer(null, {
      from: 'float:tenant:5', to: 'user:7', tokenKind: 'AT', amount: 300,
      reason: 'Quest payout: Beach cleanup', ref: 'questParticipation:42',
      tenantId: 5, at: '2026-06-11T00:00:00Z', fromPriorBalance: 1000, toPriorBalance: 0,
    })
    expect(debit.direction).toBe('debit')
    expect(debit.balanceAfter).toBe(700) // float drained — issuance stays backed
    expect(credit.direction).toBe('credit')
    expect(credit.balanceAfter).toBe(300)
    expect(credit.prevHash).toBe(debit.hash)
    expect(verifyChain([debit, credit])).toEqual({ ok: true })
  })

  it('buildTransfer refuses to issue more than the float holds (unbacked mint)', () => {
    expect(() =>
      buildTransfer(null, {
        from: 'float:tenant:5', to: 'user:7', tokenKind: 'AT', amount: 5000,
        reason: 'overdraw', tenantId: 5, at: '2026-06-11T00:00:00Z',
        fromPriorBalance: 1000, toPriorBalance: 0,
      }),
    ).toThrow(/insufficient AT/)
  })
})
