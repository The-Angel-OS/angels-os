/**
 * walletSummary — read a holder's token balances + recent ledger for a tenant.
 *
 * The read side of the economy: what the dashboard widget and the Nimue (Android)
 * thin client consume. Balances come from the denormalized Wallets cache; the
 * recent ledger gives a verifiable transaction history. Custodial — the server
 * holds the balance; the client just renders it.
 *
 * @see src/utilities/tokenLedger.ts  @see src/endpoints/wallet-balance.ts
 */
import type { Payload } from 'payload'
import type { TokenKind } from '@/utilities/tokenLedger'

export interface LedgerLine {
  seq: number
  direction: 'credit' | 'debit'
  tokenKind: TokenKind
  amount: number
  reason: string
  ref?: string | null
  at: string
}

export interface WalletSummary {
  account: string
  tenantId: number | string
  balances: Record<TokenKind, number>
  recent: LedgerLine[]
  /** Whether the returned slice of the chain verifies (tamper-evidence signal). */
  chainOk: boolean
}

export async function getWalletSummary(
  payload: Payload,
  opts: { tenantId: number | string; account: string; limit?: number },
): Promise<WalletSummary> {
  const limit = Math.min(opts.limit ?? 25, 100)

  const wRes = await payload.find({
    collection: 'wallets' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    where: { and: [{ tenant: { equals: opts.tenantId } }, { account: { equals: opts.account } }] },
    limit: 10,
    depth: 0,
    overrideAccess: true,
  })
  const balances: Record<TokenKind, number> = { AT: 0, KC: 0, LT: 0 }
  for (const w of wRes.docs as Array<{ tokenKind: TokenKind; balance: number | string }>) {
    balances[w.tokenKind] = Number(w.balance)
  }

  const lRes = await payload.find({
    collection: 'token-ledger' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    where: { and: [{ tenant: { equals: opts.tenantId } }, { account: { equals: opts.account } }] },
    sort: '-seq',
    limit,
    depth: 0,
    overrideAccess: true,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docs = lRes.docs as any[]
  const recent: LedgerLine[] = docs.map((e) => ({
    seq: Number(e.seq),
    direction: e.direction,
    tokenKind: e.tokenKind,
    amount: Number(e.amount),
    reason: e.reason,
    ref: e.ref ?? null,
    at: e.at,
  }))

  // Tamper signal over the fetched slice (full-chain audit uses verifyChain
  // elsewhere). A partial slice won't start at genesis, so we only flag a HARD
  // break — a prevHash that doesn't link to its predecessor's hash within the slice.
  const asc = [...docs].sort((a, b) => Number(a.seq) - Number(b.seq))
  let chainOk = true
  for (let i = 1; i < asc.length; i++) {
    if (asc[i].prevHash !== asc[i - 1].hash) { chainOk = false; break }
  }

  return { account: opts.account, tenantId: opts.tenantId, balances, recent, chainOk }
}
