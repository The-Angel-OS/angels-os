/**
 * fundFloat — the controlled AT issuance point (a Diocese funds its float).
 *
 * AT enters circulation HERE and only here: a super_admin credits an Enterprise's
 * float, asserting real backing (Justice Fund deposit / Stripe / platform revenue).
 * The credit is recorded as a hash-linked TokenLedger entry, so total issued AT for
 * a tenant = the sum of its float fundings = the backing. Quest payouts then move AT
 * from the float to users (creditQuestPayout) without ever exceeding it.
 *
 * This is the only single-sided credit in the system (issuance increases supply);
 * every downstream movement is balanced double-entry.
 *
 * @see src/utilities/tokenLedger.ts  @see src/utilities/creditQuestPayout.ts
 */
import type { Payload } from 'payload'
import { appendEntry, type LedgerEntry, type TokenKind } from '@/utilities/tokenLedger'

export interface FundFloatResult {
  ok: boolean
  account?: string
  balance?: number
  reason?: string
}

export async function fundFloat(
  payload: Payload,
  opts: {
    tenantId: number | string
    /** Positive integer, minor units. */
    amount: number
    tokenKind?: TokenKind
    /** Backing source, e.g. 'Justice Fund deposit', 'Stripe pi_123'. */
    reason?: string
    ref?: string
    at?: string
  },
): Promise<FundFloatResult> {
  const tokenKind = opts.tokenKind ?? 'AT'
  const account = `float:tenant:${opts.tenantId}`
  const at = opts.at ?? new Date().toISOString()

  if (!Number.isInteger(opts.amount) || opts.amount <= 0) {
    return { ok: false, reason: 'amount must be a positive integer (minor units)' }
  }

  // Float wallet (current balance, if any).
  const wRes = await payload.find({
    collection: 'wallets' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    where: { and: [{ tenant: { equals: opts.tenantId } }, { account: { equals: account } }, { tokenKind: { equals: tokenKind } }] },
    limit: 1, depth: 0, overrideAccess: true,
  })
  const wallet = wRes.docs?.[0] as { id: number | string; balance?: number } | undefined
  const prior = wallet?.balance ?? 0

  // Latest entry on this tenant's chain (for hash linking).
  const pRes = await payload.find({
    collection: 'token-ledger' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    where: { tenant: { equals: opts.tenantId } }, sort: '-seq', limit: 1, depth: 0, overrideAccess: true,
  })
  const prev = (pRes.docs?.[0] as LedgerEntry | undefined) ?? null

  const entry = appendEntry(prev, {
    account, tokenKind, direction: 'credit', amount: opts.amount,
    reason: opts.reason ?? 'Float funded (backed issuance)',
    ref: opts.ref, tenantId: opts.tenantId, at,
  }, prior)

  await payload.create({ collection: 'token-ledger' as any, data: { ...entry, tenant: opts.tenantId } as any, overrideAccess: true }) // eslint-disable-line @typescript-eslint/no-explicit-any

  const newBalance = prior + opts.amount
  if (wallet) {
    await payload.update({ collection: 'wallets' as any, id: wallet.id, data: { balance: newBalance } as any, overrideAccess: true }) // eslint-disable-line @typescript-eslint/no-explicit-any
  } else {
    await payload.create({ collection: 'wallets' as any, data: { tenant: opts.tenantId, account, tokenKind, balance: newBalance } as any, overrideAccess: true }) // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  return { ok: true, account, balance: newBalance }
}
