/**
 * creditOnApproval — when a QuestParticipation transitions to `approved`, pay the
 * participant their token payout (AT) from the Diocese float via the ledger.
 *
 * The evidence + reviewer approval already on the record IS the Proof-of-Human-Worth
 * gate; this hook just settles the payout. Idempotent + fail-soft (creditQuestPayout
 * never throws), so it can never block or double-pay the participation write.
 */
import type { CollectionAfterChangeHook } from 'payload'
import { creditQuestPayout } from '@/utilities/creditQuestPayout'

export const creditOnApproval: CollectionAfterChangeHook = async ({ doc, previousDoc, req }) => {
  try {
    const becameApproved = doc?.status === 'approved' && previousDoc?.status !== 'approved'
    if (!becameApproved || doc?.payoutStatus === 'paid') return doc

    await creditQuestPayout(req.payload, {
      id: doc.id,
      quest: doc.quest,
      participant: doc.participant,
      tenant: doc.tenant,
    })
  } catch (err) {
    req.payload.logger?.error?.({ err, msg: `[creditOnApproval] payout failed for participation ${doc?.id}` })
  }
  return doc
}
