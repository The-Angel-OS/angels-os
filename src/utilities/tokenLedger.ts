/**
 * tokenLedger — the hash-linked, append-only ledger primitive for the Angel OS
 * token economy (Angel Tokens, Karma Coins, Legacy Tokens).
 *
 * This is Phase 1 of docs/vision/ANGEL_TOKENS_BLOCKCHAIN_ECONOMY.md: you do NOT
 * need a distributed chain to pay people in tokens — you need a ledger with
 * blockchain *data properties*. Each entry hashes the previous one (Merkle-style
 * tamper-evidence) and balances are a deterministic replay of the log. Migrating
 * to a real AngelChain later (Delegated Proof of Human Worth, ERC-20-style
 * contracts) becomes a transport swap, not a rewrite — the ledger semantics are
 * already correct. Same instinct as ExecutionTrace: a tamper-evident append-only
 * record, here of value instead of execution.
 *
 * Pure + deterministic — pass the timestamp in (no Date.now) so hashes are stable
 * and testable. No I/O here; the collection/hook layer persists these entries.
 *
 * Banking model (two-tier, Diocese-as-bank): AT is backed by the Enterprise/
 * Diocese FLOAT (local bank) with the JUSTICE FUND as central reserve. KC is the
 * ungated social layer — tracked here, but the CONVERSION layer (not this file)
 * refuses to cash it out. Convertibility policy lives at the exchange, not the
 * ledger; the ledger only proves balances.
 */
import { createHash } from 'crypto'

export type TokenKind = 'AT' | 'KC' | 'LT'
export type Direction = 'credit' | 'debit'

/** Per-kind policy. `convertible` gates the (separate) cash-out exchange. */
export const TOKEN_KINDS: Record<TokenKind, { label: string; convertible: boolean; note: string }> = {
  AT: { label: 'Angel Token', convertible: true, note: 'Real, backed value — quest payouts, services, cash-out.' },
  KC: { label: 'Karma Coin', convertible: false, note: 'Ungated social/karma layer — tips, reputation. Never directly cashable.' },
  LT: { label: 'Legacy Token', convertible: false, note: 'Long-term governance weight — earned, not bought; not cashable.' },
}

export interface LedgerEntryInput {
  /** Namespaced account, e.g. 'user:123', 'float:tenant:5', 'reserve:justice-fund'. */
  account: string
  tokenKind: TokenKind
  direction: Direction
  /** Positive integer in minor units (cents-equivalent). */
  amount: number
  /** Human reason, e.g. 'Quest payout: Beach cleanup'. */
  reason: string
  /** Source reference, e.g. 'questParticipation:42', 'conversion:9', 'order:7'. */
  ref?: string
  tenantId?: number | string
  /** ISO timestamp — injected (never Date.now here) so hashes stay deterministic. */
  at: string
}

export interface LedgerEntry extends LedgerEntryInput {
  seq: number
  balanceAfter: number
  prevHash: string
  hash: string
}

export const GENESIS_HASH = '0'.repeat(64)

/** Canonical SHA-256 of an entry (excluding its own hash). Stable field order. */
export function hashEntry(e: Omit<LedgerEntry, 'hash'>): string {
  const canonical = JSON.stringify([
    e.seq, e.account, e.tokenKind, e.direction, e.amount, e.reason,
    e.ref ?? null, e.tenantId ?? null, e.at, e.balanceAfter, e.prevHash,
  ])
  return createHash('sha256').update(canonical).digest('hex')
}

/**
 * Build the next ledger entry, hash-linked to `prev` (the global last entry) and
 * balance-checked against `priorBalance` (the running balance for THIS
 * account+tokenKind). Throws on invalid amount or insufficient balance — no
 * account may go negative, including the reserve/float (overdraft must be an
 * explicit, separate credit, never an accident).
 */
export function appendEntry(
  prev: LedgerEntry | null,
  input: LedgerEntryInput,
  priorBalance: number,
): LedgerEntry {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error('amount must be a positive integer (minor units)')
  }
  const delta = input.direction === 'credit' ? input.amount : -input.amount
  const balanceAfter = priorBalance + delta
  if (balanceAfter < 0) {
    throw new Error(`insufficient ${input.tokenKind} balance for ${input.account} (have ${priorBalance}, debit ${input.amount})`)
  }
  const seq = prev ? prev.seq + 1 : 0
  const prevHash = prev ? prev.hash : GENESIS_HASH
  const unhashed: Omit<LedgerEntry, 'hash'> = { ...input, seq, balanceAfter, prevHash }
  return { ...unhashed, hash: hashEntry(unhashed) }
}

/** Replay the log to get the balance of one account+kind. */
export function computeBalance(entries: LedgerEntry[], account: string, tokenKind: TokenKind): number {
  let bal = 0
  for (const e of entries) {
    if (e.account !== account || e.tokenKind !== tokenKind) continue
    bal += e.direction === 'credit' ? e.amount : -e.amount
  }
  return bal
}

export interface ChainVerdict {
  ok: boolean
  brokenAt?: number
  reason?: string
}

/** Verify hash links, sequence, and per-entry integrity over the whole chain. */
export function verifyChain(entries: LedgerEntry[]): ChainVerdict {
  let prevHash = GENESIS_HASH
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]
    if (e.seq !== i) return { ok: false, brokenAt: i, reason: `seq ${e.seq} ≠ index ${i}` }
    if (e.prevHash !== prevHash) return { ok: false, brokenAt: i, reason: 'prevHash does not link' }
    const recomputed = hashEntry({
      seq: e.seq, account: e.account, tokenKind: e.tokenKind, direction: e.direction,
      amount: e.amount, reason: e.reason, ref: e.ref, tenantId: e.tenantId,
      at: e.at, balanceAfter: e.balanceAfter, prevHash: e.prevHash,
    })
    if (recomputed !== e.hash) return { ok: false, brokenAt: i, reason: 'hash mismatch (tampered)' }
    prevHash = e.hash
  }
  return { ok: true }
}

/**
 * A token payout = a balanced PAIR of entries (double-entry): debit the funding
 * account, credit the recipient. For an internal reward mint the funding account
 * is the Diocese float; the float must hold the balance (so issuance is always
 * backed). Returns the two new entries in order. Caller persists + updates the
 * denormalized wallet balances.
 */
export function buildTransfer(
  prev: LedgerEntry | null,
  params: {
    from: string
    to: string
    tokenKind: TokenKind
    amount: number
    reason: string
    ref?: string
    tenantId?: number | string
    at: string
    fromPriorBalance: number
    toPriorBalance: number
  },
): [LedgerEntry, LedgerEntry] {
  const debit = appendEntry(prev, {
    account: params.from, tokenKind: params.tokenKind, direction: 'debit',
    amount: params.amount, reason: params.reason, ref: params.ref,
    tenantId: params.tenantId, at: params.at,
  }, params.fromPriorBalance)
  const credit = appendEntry(debit, {
    account: params.to, tokenKind: params.tokenKind, direction: 'credit',
    amount: params.amount, reason: params.reason, ref: params.ref,
    tenantId: params.tenantId, at: params.at,
  }, params.toPriorBalance)
  return [debit, credit]
}
