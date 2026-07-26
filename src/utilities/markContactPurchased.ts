/**
 * Join the CRM to the till: tag the contact who just bought.
 *
 * Contacts and orders do not touch. Orders relate to `users`; a lead captured by
 * the embed widget has an email and no account, so nothing connects the two.
 * Without this link the single most important campaign segment — "gave us their
 * email and did NOT buy" — cannot be computed, and the first thing a drip
 * sequence does is email a discount to someone who already paid full price.
 * That is a refund request and a lost customer in one send.
 *
 * A tag rather than new columns on purpose: the only question sequences ask is
 * "has this person bought?", and revenue reporting should read `orders`, which
 * is the actual source of truth. @see docs/FOOTGUNS.md — money lives in one place.
 */
import type { Payload, PayloadRequest } from 'payload'

export const PURCHASED_TAG = 'bought'

/**
 * Idempotent. Silent when there's no matching contact — most buyers never came
 * through the capture widget, and that is not an error.
 *
 * Always pass `req` when you have one: a write on a second pooled connection
 * inside an open transaction is the 300s deadlock. @see docs/FOOTGUNS.md §2.1
 */
export async function markContactPurchased(
  payload: Payload,
  opts: {
    tenantId: number | string
    email?: string | null
    req?: PayloadRequest
  },
): Promise<boolean> {
  const email = opts.email?.trim().toLowerCase()
  if (!email || !opts.tenantId) return false

  try {
    const found = await payload.find({
      collection: 'contacts',
      where: { and: [{ tenant: { equals: opts.tenantId } }, { email: { equals: email } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req: opts.req,
    })

    const contact = found.docs?.[0] as { id: number | string; tags?: string[] | null } | undefined
    if (!contact) return false

    const tags = contact.tags || []
    if (tags.includes(PURCHASED_TAG)) return true // already tagged — nothing to do

    await payload.update({
      collection: 'contacts',
      id: contact.id,
      data: { tags: [...tags, PURCHASED_TAG] } as Record<string, unknown>,
      depth: 0,
      overrideAccess: true,
      req: opts.req,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

    return true
  } catch {
    // Never let CRM bookkeeping fail a payment. The order is already recorded.
    return false
  }
}
