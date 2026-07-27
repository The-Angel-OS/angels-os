/**
 * Put a freshly-captured contact into whatever sequences are listening.
 *
 * Called from the capture endpoint. Fail-soft throughout: a sequence problem
 * must never cost the lead that just arrived — the contact is already saved
 * before this runs.
 */
import type { Payload, PayloadRequest } from 'payload'

interface SequenceDoc {
  id: number | string
  steps?: Array<{ delayHours?: number }>
}

export async function enrollInSequences(
  payload: Payload,
  opts: {
    tenantId: number | string
    contactId: number | string
    trigger?: 'captured'
    req?: PayloadRequest
  },
): Promise<number> {
  const trigger = opts.trigger ?? 'captured'
  let enrolled = 0

  try {
    const sequences = await payload.find({
      collection: 'sequences',
      where: {
        and: [
          { tenant: { equals: opts.tenantId } },
          { trigger: { equals: trigger } },
          { isActive: { equals: true } },
        ],
      },
      limit: 20,
      depth: 0,
      overrideAccess: true,
      req: opts.req,
    })

    for (const doc of sequences.docs as unknown as SequenceDoc[]) {
      const first = doc.steps?.[0]
      if (!first) continue // a sequence with no steps enrols nobody

      // Idempotent: re-submitting the capture form must not enrol twice and
      // double every email this person receives.
      const existing = await payload.find({
        collection: 'sequence-enrollments',
        where: {
          and: [{ sequence: { equals: doc.id } }, { contact: { equals: opts.contactId } }],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        req: opts.req,
      })
      if (existing.docs?.[0]) continue

      const now = new Date()
      await payload.create({
        collection: 'sequence-enrollments',
        data: {
          tenant: opts.tenantId,
          sequence: doc.id,
          contact: opts.contactId,
          status: 'active',
          currentStep: 0,
          enrolledAt: now.toISOString(),
          nextSendAt: new Date(now.getTime() + (first.delayHours ?? 0) * 3600_000).toISOString(),
        } as Record<string, unknown>,
        depth: 0,
        overrideAccess: true,
        req: opts.req,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      enrolled++
    }
  } catch {
    // Never cost the lead.
  }

  return enrolled
}

/**
 * End every active enrolment for a contact. Called when they buy — the whole
 * reason `stopOnPurchase` exists is so a clearance sequence stops offering a
 * discount to someone who already paid.
 */
export async function stopSequencesForContact(
  payload: Payload,
  opts: {
    contactId: number | string
    reason: 'purchased' | 'unsubscribed' | 'manual'
    req?: PayloadRequest
  },
): Promise<number> {
  try {
    const active = await payload.find({
      collection: 'sequence-enrollments',
      where: {
        and: [{ contact: { equals: opts.contactId } }, { status: { equals: 'active' } }],
      },
      limit: 50,
      depth: 0,
      overrideAccess: true,
      req: opts.req,
    })

    // Bulk update by `where` on a RELATIONSHIP silently matches nothing — find
    // the ids, then update each. @see docs/FOOTGUNS.md
    for (const row of active.docs as Array<{ id: number | string }>) {
      await payload.update({
        collection: 'sequence-enrollments',
        id: row.id,
        data: { status: 'stopped', stoppedReason: opts.reason, nextSendAt: null } as Record<string, unknown>,
        depth: 0,
        overrideAccess: true,
        req: opts.req,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    }
    return active.docs.length
  } catch {
    return 0
  }
}
