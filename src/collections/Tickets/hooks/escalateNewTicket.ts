import type { CollectionAfterChangeHook } from 'payload'

import { dispatchEscalation } from '@/utilities/escalation'

/**
 * Tell somebody a ticket arrived.
 *
 * A claims queue nobody is notified about is a mailbox — and the whole reason
 * to build this as a record rather than a form was that forms end in a void.
 * dispatchEscalation posts a durable AI Bus message FIRST (config-free, so it
 * works on a tenant with no connectors at all) and then fans out to whatever
 * connectors exist. That means LEO can answer "any warranty claims today?"
 * whether or not the owner ever set up a phone push.
 *
 * Create only, and fail-soft: the ticket is already saved before this runs, so
 * a notification problem must never cost the claim.
 */
export const escalateNewTicket: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create') return doc

  const tenantId =
    typeof doc.tenant === 'object' && doc.tenant ? (doc.tenant as { id?: unknown }).id : doc.tenant
  if (tenantId == null) return doc

  // Fire-and-forget: escalation fans out to external services, and a slow
  // connector must not hold the request that created the ticket.
  void (async () => {
    try {
      const kind = String(doc.type || 'support')
      const label =
        kind === 'warranty'
          ? 'Warranty claim'
          : kind === 'return'
            ? 'Return request'
            : kind === 'question'
              ? 'Question'
              : 'Support request'

      const requester =
        typeof doc.requester === 'object' && doc.requester
          ? ((doc.requester as { name?: string; email?: string }).name ??
            (doc.requester as { email?: string }).email ??
            'a customer')
          : 'a customer'

      const parts = [String(doc.description || '').slice(0, 300)]
      if (doc.orderNumber) parts.push(`Order: ${doc.orderNumber}`)
      const attachmentCount = Array.isArray(doc.attachments) ? doc.attachments.length : 0
      if (attachmentCount) parts.push(`${attachmentCount} attachment(s)`)

      await dispatchEscalation(req.payload, {
        tenantId: tenantId as number | string,
        eventType: 'itsm_incident',
        title: `${label}: ${doc.subject}`,
        message: `From ${requester}.\n\n${parts.join('\n')}`,
        // Warranty and returns cost money and have a clock on them; a question
        // can wait for someone to look at the queue.
        priority: kind === 'warranty' || kind === 'return' ? 7 : 5,
        // Per ticket, not per type — a burst of different claims should each get
        // through, while a double-submit of the same one shouldn't.
        dedupeKey: `ticket:${doc.id}`,
        extras: { ticketId: doc.id, type: kind, status: doc.status },
      })
    } catch {
      // Never let a notification failure surface on a saved ticket.
    }
  })()

  return doc
}
