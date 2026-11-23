import type { PayloadHandler, PayloadRequest } from 'payload'

import { canManagePortal } from '@/utilities/canManagePortal'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import {
  formatIncidentId,
  sanitizeTicketForRequester,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_TYPES,
} from '@/utilities/ticketHelpers'

/**
 * Customer-facing & ServiceNow-lite Support Desk API:
 *   - POST /api/tickets-ops/submit — file a new support incident / warranty claim / question
 *   - GET  /api/tickets-ops/mine   — requester's own tickets (never exposes internalNotes)
 *   - POST /api/tickets-ops/update — staff status / priority / assignee / resolution / internalNotes update
 *
 * Security invariants:
 *   1. `requester` comes from the SESSION, never the body.
 *   2. `tenant` comes from the HOST on submit (with cross-tenant updates restricted to super_admin).
 *   3. Non-staff callers on submit are pinned to status='submitted' and priority='normal'.
 *   4. `GET /mine` projects through `sanitizeTicketForRequester` so `internalNotes` can NEVER leak.
 */

const VALID_TYPES = new Set<string>(TICKET_TYPES)
const VALID_STATUSES = new Set<string>(TICKET_STATUSES)
const VALID_PRIORITIES = new Set<string>(TICKET_PRIORITIES)

export const ticketSubmitHandler: PayloadHandler = async (req: PayloadRequest) => {
  const user = req.user
  if (!user?.id) {
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

  // Only verified portal staff may specify initial priority or assignee (e.g. "+ New Incident" on /dashboard/tickets)
  const isStaff = await canManagePortal(req.payload, user, tenantId)
  const requestedPriority =
    isStaff && typeof body.priority === 'string' && VALID_PRIORITIES.has(body.priority)
      ? body.priority
      : 'normal'
  const requestedAssignee =
    isStaff && (typeof body.assignee === 'number' || typeof body.assignee === 'string') && body.assignee !== ''
      ? body.assignee
      : undefined

  // Only accept media the SUBMITTER owns.
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
        priority: requestedPriority,
        requester: user.id,
        tenant: tenantId,
        ...(requestedAssignee != null ? { assignee: requestedAssignee } : {}),
        ...(attachments.length ? { attachments } : {}),
        ...(body.orderNumber ? { orderNumber: String(body.orderNumber).slice(0, 120) } : {}),
        ...(body.purchaseDate ? { purchaseDate: String(body.purchaseDate) } : {}),
        ...(body.sellerName ? { sellerName: String(body.sellerName).slice(0, 120) } : {}),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      overrideAccess: true,
      req,
    })) as { id: number | string }

    return Response.json({
      ok: true,
      reference: created.id,
      incidentNumber: formatIncidentId(created.id),
    })
  } catch (err) {
    req.payload.logger.error(
      `[tickets-ops/submit] create failed: ${err instanceof Error ? err.message : String(err)}`,
    )
    return Response.json({ message: 'Could not file this request. Please try again.' }, { status: 500 })
  }
}

export const ticketMineHandler: PayloadHandler = async (req: PayloadRequest) => {
  const user = req.user
  if (!user?.id) {
    return Response.json({ message: 'Please sign in to view your tickets.' }, { status: 401 })
  }

  try {
    const res = await req.payload.find({
      collection: 'tickets',
      where: { requester: { equals: user.id } },
      limit: 50,
      depth: 0,
      sort: '-createdAt',
      overrideAccess: true,
      req,
    })
    const tickets = (res.docs || []).map((doc) =>
      sanitizeTicketForRequester(doc as unknown as Record<string, unknown>),
    )
    return Response.json({ ok: true, tickets, total: res.totalDocs ?? tickets.length })
  } catch (err) {
    req.payload.logger.error(
      `[tickets-ops/mine] query failed: ${err instanceof Error ? err.message : String(err)}`,
    )
    return Response.json({ message: 'Could not load your tickets.' }, { status: 500 })
  }
}

export const ticketUpdateHandler: PayloadHandler = async (req: PayloadRequest) => {
  const user = req.user
  if (!user?.id) {
    return Response.json({ message: 'Authentication required.' }, { status: 401 })
  }

  let body: Record<string, unknown> = {}
  try {
    body = ((await req.json?.()) as Record<string, unknown>) || {}
  } catch {
    return Response.json({ message: 'Invalid JSON body.' }, { status: 400 })
  }

  const ticketId = body.ticketId
  if (ticketId == null || ticketId === '') {
    return Response.json({ message: 'ticketId is required.' }, { status: 400 })
  }

  let existing: Record<string, unknown> | null = null
  try {
    existing = (await req.payload.findByID({
      collection: 'tickets',
      id: ticketId as string | number,
      depth: 0,
      overrideAccess: true,
      req,
    })) as unknown as Record<string, unknown>
  } catch {
    existing = null
  }
  if (!existing) {
    return Response.json({ message: 'Ticket not found.' }, { status: 404 })
  }

  const docTenant =
    typeof existing.tenant === 'object' && existing.tenant !== null
      ? (existing.tenant as { id?: number | string }).id
      : existing.tenant
  const isSuper = checkRole(ADMIN_ROLES, user)
  const canManage = isSuper || (await canManagePortal(req.payload, user, docTenant as number | string))
  if (!canManage) {
    return Response.json({ message: 'Portal manager permission required.' }, { status: 403 })
  }

  const patch: Record<string, unknown> = {}
  if (typeof body.status === 'string') {
    if (!VALID_STATUSES.has(body.status)) {
      return Response.json({ message: 'Invalid ticket status.' }, { status: 400 })
    }
    patch.status = body.status
  }
  if (typeof body.priority === 'string') {
    if (!VALID_PRIORITIES.has(body.priority)) {
      return Response.json({ message: 'Invalid ticket priority.' }, { status: 400 })
    }
    patch.priority = body.priority
  }
  if ('assignee' in body) {
    patch.assignee =
      body.assignee === null || body.assignee === '' ? null : (body.assignee as number | string)
  }
  if (typeof body.resolution === 'string') {
    patch.resolution = body.resolution.slice(0, 5000)
  }
  if (typeof body.internalNotes === 'string') {
    patch.internalNotes = body.internalNotes.slice(0, 10000)
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ message: 'No valid update fields supplied.' }, { status: 400 })
  }

  try {
    const updated = (await req.payload.update({
      collection: 'tickets',
      id: ticketId as string | number,
      data: patch as never,
      overrideAccess: true,
      req,
    })) as unknown as Record<string, unknown>

    return Response.json({
      ok: true,
      ticket: {
        id: updated.id,
        incidentNumber: formatIncidentId(updated.id as number | string),
        status: updated.status,
        priority: updated.priority,
        assignee: updated.assignee ?? null,
        resolution: updated.resolution ?? null,
        internalNotes: updated.internalNotes ?? null,
        updatedAt: updated.updatedAt,
      },
    })
  } catch (err) {
    req.payload.logger.error(
      `[tickets-ops/update] update failed: ${err instanceof Error ? err.message : String(err)}`,
    )
    return Response.json({ message: 'Could not update ticket.' }, { status: 500 })
  }
}
