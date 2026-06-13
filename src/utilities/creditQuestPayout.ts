/**
 * creditQuestPayout — pay a quest performer in tokens, ledger-backed.
 *
 * When a QuestParticipation is approved (the evidence + review = Proof of Human
 * Worth), this credits the participant's wallet by debiting the Diocese FLOAT —
 * issuance is always backed (buildTransfer enforces it). Writes the two
 * hash-linked TokenLedger entries, updates the denormalized Wallet balances, and
 * flips payoutStatus → 'paid'.
 *
 * Quest payouts pay in AT (the convertible unit). KC (social/tips) is a separate
 * flow. Fully idempotent: a participation already settled in the ledger is skipped.
 *
 * Fail-soft: an unfunded float or any error logs via createLogger('quest-payout')
 * and leaves payoutStatus where it was (retryable once the float is funded) —
 * never throws into the participation write.
 *
 * @see src/utilities/tokenLedger.ts  @see src/collections/TokenLedger
 */
import type { Payload } from 'payload'
import { buildTransfer, type LedgerEntry, type TokenKind } from '@/utilities/tokenLedger'
import { createLogger } from '@/utilities/createLogger'

export interface QuestPayoutResult {
  ok: boolean
  skipped?: boolean
  reason?: string
  amount?: number
  tokenKind?: TokenKind
}

/**
 * Hard ceiling on a single quest payout (in minor token units). Defense in depth
 * against a mis-configured / malicious quest minting an absurd amount out of the
 * float in one transfer. A legitimately larger payout is a deliberate config change.
 */
export const MAX_QUEST_PAYOUT = 1_000_000

function floatAccount(tenantId: number | string): string {
  return `float:tenant:${tenantId}`
}
function userAccount(userId: number | string): string {
  return `user:${userId}`
}

/** Find the running balance for an account+kind from the Wallet cache (0 if none). */
async function walletBalance(
  payload: Payload,
  tenantId: number | string,
  account: string,
  tokenKind: TokenKind,
): Promise<{ id: number | string | null; balance: number }> {
  const res = await payload.find({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    collection: 'wallets' as any,
    where: { and: [{ tenant: { equals: tenantId } }, { account: { equals: account } }, { tokenKind: { equals: tokenKind } }] },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = res.docs?.[0] as { id: number | string; balance?: number } | undefined
  return { id: doc?.id ?? null, balance: doc?.balance ?? 0 }
}

async function setWalletBalance(
  payload: Payload,
  tenantId: number | string,
  account: string,
  tokenKind: TokenKind,
  walletId: number | string | null,
  newBalance: number,
): Promise<void> {
  if (walletId != null) {
    await payload.update({ collection: 'wallets' as any, id: walletId, data: { balance: newBalance } as any, overrideAccess: true }) // eslint-disable-line @typescript-eslint/no-explicit-any
  } else {
    await payload.create({ collection: 'wallets' as any, data: { tenant: tenantId, account, tokenKind, balance: newBalance } as any, overrideAccess: true }) // eslint-disable-line @typescript-eslint/no-explicit-any
  }
}

/** The latest ledger entry for a tenant's chain (prev for the next append). */
async function latestEntry(payload: Payload, tenantId: number | string): Promise<LedgerEntry | null> {
  const res = await payload.find({
    collection: 'token-ledger' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    where: { tenant: { equals: tenantId } },
    sort: '-seq',
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return (res.docs?.[0] as LedgerEntry | undefined) ?? null
}

export async function creditQuestPayout(
  payload: Payload,
  participation: {
    id: number | string
    quest: number | string | { id: number | string; payout?: unknown; tenant?: unknown }
    participant: number | string | { id: number | string }
    tenant?: number | string | { id: number | string }
    /** Current participation status — payout only mints for an `approved` record. */
    status?: string
  },
  now: string = new Date().toISOString(),
): Promise<QuestPayoutResult> {
  const log = createLogger('quest-payout')
  try {
    const participationId = participation.id
    const ref = `questParticipation:${participationId}`

    // Defense in depth: never mint unless the participation is actually approved.
    // The caller (creditOnApproval) already checks this, but the mint path must not
    // rely solely on its caller. When status is unknown (legacy call sites), we
    // re-read the record to confirm rather than trusting the absence of a value.
    let status = participation.status
    if (status == null) {
      try {
        const fresh = (await payload.findByID({
          collection: 'quest-participations' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          id: participationId,
          depth: 0,
          overrideAccess: true,
        })) as { status?: string } | null
        status = fresh?.status
      } catch {
        /* lookup failed — treat as unverified below */
      }
    }
    if (status !== 'approved') {
      await log.warn('payout refused — participation not approved', { details: `${ref} status=${status ?? 'unknown'}` })
      return { ok: false, skipped: true, reason: 'participation not approved' }
    }

    // Idempotency: already settled in the ledger? skip.
    const existing = await payload.find({
      collection: 'token-ledger' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      where: { ref: { equals: ref } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (existing.totalDocs > 0) return { ok: true, skipped: true, reason: 'already settled' }

    // Resolve the quest (for payout) — hydrate if only an id was passed.
    let quest = participation.quest as { id: number | string; payout?: any; tenant?: any; title?: string } // eslint-disable-line @typescript-eslint/no-explicit-any
    if (typeof quest !== 'object') {
      quest = (await payload.findByID({ collection: 'quests' as any, id: quest, depth: 0, overrideAccess: true })) as any // eslint-disable-line @typescript-eslint/no-explicit-any
    }
    const amount = Number(quest?.payout?.amount)
    if (!Number.isInteger(amount) || amount <= 0) {
      return { ok: true, skipped: true, reason: 'quest has no positive token payout' }
    }
    // Reject absurd amounts before they can touch the float (mint-path guardrail).
    if (amount > MAX_QUEST_PAYOUT) {
      await log.error('payout refused — amount exceeds MAX_QUEST_PAYOUT', { details: `${ref} amount=${amount} max=${MAX_QUEST_PAYOUT}` })
      return { ok: false, reason: 'payout exceeds maximum' }
    }
    const tokenKind: TokenKind = 'AT' // quest payouts pay in Angel Tokens

    const tenantId =
      (typeof participation.tenant === 'object' ? participation.tenant?.id : participation.tenant) ??
      (typeof quest.tenant === 'object' ? quest.tenant?.id : quest.tenant)
    const participantId = typeof participation.participant === 'object' ? participation.participant.id : participation.participant
    if (tenantId == null || participantId == null) {
      await log.error('cannot resolve tenant/participant for payout', { details: ref })
      return { ok: false, reason: 'missing tenant or participant' }
    }

    const from = floatAccount(tenantId)
    const to = userAccount(participantId)
    const fromWallet = await walletBalance(payload, tenantId, from, tokenKind)
    const toWallet = await walletBalance(payload, tenantId, to, tokenKind)

    // Build the double-entry transfer (throws if the float can't back it).
    let entries: [LedgerEntry, LedgerEntry]
    try {
      const prev = await latestEntry(payload, tenantId)
      entries = buildTransfer(prev, {
        from, to, tokenKind, amount,
        reason: `Quest payout: ${quest.title ?? quest.id}`,
        ref, tenantId, at: now,
        fromPriorBalance: fromWallet.balance,
        toPriorBalance: toWallet.balance,
      })
    } catch (e) {
      await log.warn(`payout deferred — float not funded for tenant ${tenantId}`, { details: `${ref}: ${e instanceof Error ? e.message : e}`, tenantId })
      return { ok: false, reason: 'float underfunded' }
    }

    // Persist both ledger entries, then move the wallet balances in lock-step.
    for (const e of entries) {
      await payload.create({ collection: 'token-ledger' as any, data: { ...e, tenant: tenantId } as any, overrideAccess: true }) // eslint-disable-line @typescript-eslint/no-explicit-any
    }
    await setWalletBalance(payload, tenantId, from, tokenKind, fromWallet.id, fromWallet.balance - amount)
    await setWalletBalance(payload, tenantId, to, tokenKind, toWallet.id, toWallet.balance + amount)

    await payload.update({
      collection: 'quest-participations' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      id: participationId,
      data: { payoutStatus: 'paid', payoutAmount: amount } as any,
      overrideAccess: true,
    })

    return { ok: true, amount, tokenKind }
  } catch (err) {
    await log.caught(err, { details: `participation ${participation.id}` })
    return { ok: false, reason: 'unexpected error' }
  }
}
