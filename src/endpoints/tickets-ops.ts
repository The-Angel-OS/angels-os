import type { PayloadHandler, PayloadRequest } from 'payload'

import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'

/**
 * Customer-facing ticket submission — the front door to the Tickets queue.
 *
 * Deliberately NOT the plain `/api/tickets` REST create. Three things have to be
 * decided by the server, not the browser:
 *
 *   1. `requester` comes from the SESSION. Taking it from the body would let
 *      anyone file a claim in someone else's name.
 *   2. `tenant` comes from the HOST. Taking it from the body would let a claim
 *      raised on one portal land in another tenant's queue.
 *   3. `status` and `priority` are fixed at submitted/normal. A form that can
 *      set its own status is a form that can mark itself approved.
 *
 * The customer supplies the story and the photographs. Nothing else.
 *
 * @see src/blocks/TicketForm/Component.tsx  @see src/collections/Tickets
 */

const VALID_TYPES = new Set(['warranty', 'support', 'return', 'question'])

export const ticketSubmitHandler: PayloadHandler = async (req: PayloadRequest) => {
  const user = req.user
  if (!user?.id) {
    // The form turns this into a sign-in prompt rather than an error. Anonymous
    // claims would let anyone file against any order number, and the review step
    // would carry all of that weight.
    return Response.json({ message: 'Please sign in to file this.' }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = ((await req.json?.()) as Record<string, unknown>) || {}
  } catch {
    return Response.json({ message: 'Invalid request body.' }, { status: 400 })
  }

  const type = String(body.type || 'support')
  if (!VALID_TYPES.has(type)) {
    return Response.json({ message: 'Unknown request type.' }, { status: 400 })
  }

  const subject = String(body.subject || '').trim().slice(0, 140)
  const description = String(body.description || '').trim().slice(0, 5000)
  if (!subject || !description) {
    return Response.json({ message: 'A subject and a description are required.' }, { status: 400 })
  }

  const { tenantId } = await resolveTenantFromHeaders()
  if (!tenantId) {
    return Response.json({ message: 'No portal context for this request.' }, { status: 400 })
  }

  // Only accept media the SUBMITTER owns. Without this check a caller could post
  // arbitrary media ids and pull another tenant's images into a ticket the
  // seller's staff will then open — a read primitive dressed up as an upload.
  const rawIds = Array.isArray(body.attachments) ? body.attachments : []
  const wanted = rawIds
    .map((v) => (typeof v === 'number' || typeof v === 'string' ? v : null))
    .filter((v): v is number | string => v != null)
    .slice(0, 12)

  const attachments: Array<{ file: number | string }> = []
  if (wanted.length) {
    const owned = await req.payload.find({
      collection: 'media',
      where: { and: [{ id: { in: wanted } }, { createdBy: { equals: user.id } }] },
      limit: wanted.length,
      depth: 0,
      overrideAccess: true,
      req,
    })
    for (const doc of owned.docs as Array<{ id: number | string }>) {
      attachments.push({ file: doc.id })
    }
  }

  try {
    const created = (await req.payload.create({
      collection: 'tickets',
      data: {
        type,
        subject,
        description,
        status: 'submitted',
        priority: 'normal',
        requester: user.id,
        tenant: tenantId,
        ...(attachments.length ? { attachments } : {}),
        ...(body.orderNumber ? { orderNumber: String(body.orderNumber).slice(0, 120) } : {}),
        ...(body.purchaseDate ? { purchaseDate: String(body.purchaseDate) } : {}),
        ...(body.sellerName ? { sellerName: String(body.sellerName).slice(0, 120) } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      overrideAccess: true,
      // Pass req so the escalation hook's writes join THIS transaction. A hook
      // that writes without req lands on a second pooled connection and either
      // drops silently or deadlocks for exactly 300s. FOOTGUNS §2.1.
      req,
    })) as { id: number | string }

    return Response.json({ ok: true, reference: created.id })
  } catch (err) {
    req.payload.logger.error(
      `[tickets-ops/submit] create failed: ${err instanceof Error ? err.message : String(err)}`,
    )
    return Response.json({ message: 'Could not file this request. Please try again.' }, { status: 500 })
  }
}
