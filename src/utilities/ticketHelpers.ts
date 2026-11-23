/**
 * Shared ServiceNow-lite incident ticket helpers (zero DB schema changes).
 * Pure utilities so both server pages, client components, endpoints, and unit
 * tests share identical formatting and status/priority metadata.
 */

export const TICKET_TYPES = ['support', 'question', 'warranty', 'return'] as const
export type TicketType = (typeof TICKET_TYPES)[number]

export const TICKET_STATUSES = ['submitted', 'reviewing', 'approved', 'denied', 'resolved'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const TICKET_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]

export const OPEN_TICKET_STATUSES = ['submitted', 'reviewing', 'approved'] as const
export const OPEN_TICKET_STATUS_SET = new Set<string>(OPEN_TICKET_STATUSES)

export const TICKET_TYPE_LABELS: Record<string, string> = {
  support: 'Support / Incident',
  question: 'General Question',
  warranty: 'Warranty Claim',
  return: 'Return Request',
}

export const TICKET_STATUS_LABELS: Record<string, string> = {
  submitted: 'New / Submitted',
  reviewing: 'In Progress',
  approved: 'Approved',
  denied: 'Closed — Denied',
  resolved: 'Resolved',
}

export const TICKET_STATUS_BADGE: Record<string, string> = {
  submitted: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
  reviewing: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
  approved: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  denied: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30',
  resolved: 'bg-muted text-muted-foreground border-border',
}

export const TICKET_PRIORITY_LABELS: Record<string, string> = {
  urgent: 'P1 — Urgent',
  high: 'P2 — High',
  normal: 'P3 — Normal',
  low: 'P4 — Low',
}

export const TICKET_PRIORITY_BADGE: Record<string, string> = {
  urgent: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 font-semibold',
  high: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-medium',
  normal: 'bg-muted/60 text-muted-foreground border-border',
  low: 'bg-muted/30 text-muted-foreground/80 border-border/60',
}

/** Format a numeric/string Payload ticket ID as ServiceNow-style INC-000014. */
export function formatIncidentId(id: number | string): string {
  const raw = String(id).trim()
  if (/^\d+$/.test(raw)) {
    return `INC-${raw.padStart(6, '0')}`
  }
  return `INC-${raw.toUpperCase()}`
}

/** Parse either "INC-000014" or "14" back to a ticket ID string when numeric. */
export function parseIncidentSearch(query: string): string | null {
  const cleaned = query.trim().toUpperCase().replace(/^#/, '')
  const incMatch = /^INC-?0*(\d+)$/.exec(cleaned)
  if (incMatch?.[1]) return incMatch[1]
  if (/^\d+$/.test(cleaned)) return String(Number(cleaned))
  return null
}

export interface RequesterTicketView {
  id: number | string
  incidentNumber: string
  type: string
  subject: string
  description: string
  status: string
  priority: string
  orderNumber?: string | null
  resolution?: string | null
  createdAt: string
  updatedAt?: string | null
}

/** Project a ticket doc into a requester-safe shape (never leaks internalNotes). */
export function sanitizeTicketForRequester(doc: Record<string, unknown>): RequesterTicketView {
  const id = (doc.id ?? '') as number | string
  return {
    id,
    incidentNumber: formatIncidentId(id),
    type: String(doc.type || 'support'),
    subject: String(doc.subject || ''),
    description: String(doc.description || ''),
    status: String(doc.status || 'submitted'),
    priority: String(doc.priority || 'normal'),
    orderNumber: typeof doc.orderNumber === 'string' ? doc.orderNumber : null,
    resolution: typeof doc.resolution === 'string' ? doc.resolution : null,
    createdAt: String(doc.createdAt || ''),
    updatedAt: typeof doc.updatedAt === 'string' ? doc.updatedAt : null,
  }
}
