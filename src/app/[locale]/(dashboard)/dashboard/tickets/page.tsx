import { headers } from 'next/headers'
import { setRequestLocale } from 'next-intl/server'
import { getPayload, type Where } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'

import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { requirePortalManager } from '@/utilities/requirePortalManager'
import {
  formatIncidentId,
  OPEN_TICKET_STATUS_SET,
  parseIncidentSearch,
  TICKET_PRIORITY_BADGE,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_BADGE,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
} from '@/utilities/ticketHelpers'
import { NewIncidentButton } from './NewIncidentButton'

export const dynamic = 'force-dynamic'

function formatRelativeAge(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.max(0, Math.floor(diffMs / 60000))
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

/**
 * ServiceNow-Lite Incident Queue — /dashboard/tickets
 *
 * Shows open & resolved incidents, warranty claims, returns, and support
 * questions. Platform super_admins on the platform view can inspect ALL
 * portals' incidents across the network or scope to the current portal.
 */
export default async function TicketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{
    status?: string
    priority?: string
    type?: string
    unassigned?: string
    q?: string
    scope?: string
  }>
}) {
  const { locale } = await params
  const { status, priority, type, unassigned, q, scope } = await searchParams
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  const isSuperAdmin = Boolean(user && checkRole(ADMIN_ROLES, user))

  const { tenant, tenantFilter } = await resolveTenantFromHeaders()
  const isPlatformTenant =
    !tenant || (tenant as { type?: string; slug?: string }).type === 'platform' || tenant.slug === 'platform'
  const showAllPortals = isSuperAdmin && isPlatformTenant && scope !== 'portal'

  const baseWhere: Where | undefined = showAllPortals ? undefined : (tenantFilter as Where)

  // Fetch queue slice (up to 250 recent rows) so KPIs + client filters stay fast & accurate
  const tickets = await payload.find({
    collection: 'tickets',
    ...(baseWhere ? { where: baseWhere } : {}),
    limit: 250,
    depth: 1,
    sort: '-createdAt',
    overrideAccess: true,
  })

  type TicketRow = {
    id: number | string
    subject: string
    type: string
    status: string
    priority?: string
    orderNumber?: string
    createdAt: string
    requester?: { id?: number | string; name?: string; email?: string } | number | null
    assignee?: { id?: number | string; name?: string; email?: string } | number | null
    tenant?: { id?: number | string; name?: string; slug?: string; branding?: { siteName?: string } } | number | null
    attachments?: unknown[]
  }

  const allRows = (tickets.docs || []) as unknown as TicketRow[]

  // KPI metrics over the portal/platform queue
  const openCount = allRows.filter((t) => OPEN_TICKET_STATUS_SET.has(t.status)).length
  const urgentHighCount = allRows.filter(
    (t) => OPEN_TICKET_STATUS_SET.has(t.status) && (t.priority === 'urgent' || t.priority === 'high'),
  ).length
  const unassignedCount = allRows.filter(
    (t) => OPEN_TICKET_STATUS_SET.has(t.status) && !t.assignee,
  ).length
  const resolvedCount = allRows.filter((t) => t.status === 'resolved').length

  // Apply URL filters
  const activeStatus = status || 'open'
  const parsedId = q ? parseIncidentSearch(q) : null
  const qLower = q ? q.trim().toLowerCase() : ''

  const filtered = allRows.filter((t) => {
    if (activeStatus === 'open') {
      if (!OPEN_TICKET_STATUS_SET.has(t.status)) return false
    } else if (activeStatus !== 'all') {
      if (t.status !== activeStatus) return false
    }
    if (priority && (t.priority || 'normal') !== priority) return false
    if (type && t.type !== type) return false
    if (unassigned === '1' && t.assignee) return false
    if (qLower) {
      const idMatch = parsedId != null && String(t.id) === parsedId
      const subjMatch = String(t.subject || '').toLowerCase().includes(qLower)
      const orderMatch = String(t.orderNumber || '').toLowerCase().includes(qLower)
      const reqName =
        typeof t.requester === 'object' && t.requester
          ? `${t.requester.name || ''} ${t.requester.email || ''}`.toLowerCase()
          : ''
      if (!idMatch && !subjMatch && !orderMatch && !reqName.includes(qLower)) return false
    }
    return true
  })

  // Sort open queue: urgent -> high -> normal -> low, newest first inside same priority
  const PRIO_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 }
  const rows = [...filtered].sort((a, b) => {
    const ao = OPEN_TICKET_STATUS_SET.has(a.status) ? 0 : 1
    const bo = OPEN_TICKET_STATUS_SET.has(b.status) ? 0 : 1
    if (ao !== bo) return ao - bo
    const ap = PRIO_RANK[a.priority || 'normal'] ?? 2
    const bp = PRIO_RANK[b.priority || 'normal'] ?? 2
    if (ap !== bp) return ap - bp
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  const buildHref = (overrides: Record<string, string | undefined>) => {
    const paramsObj = new URLSearchParams()
    const merged: Record<string, string | undefined> = {
      status: activeStatus,
      priority,
      type,
      unassigned,
      q,
      scope,
      ...overrides,
    }
    for (const [k, v] of Object.entries(merged)) {
      if (v) paramsObj.set(k, v)
    }
    const qs = paramsObj.toString()
    return `/${locale}/dashboard/tickets${qs ? `?${qs}` : ''}`
  }

  const chip = (label: string, href: string, active: boolean) => (
    <Link
      key={`${label}-${href}`}
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground'
      }`}
    >
      {label}
    </Link>
  )

  return (
    <div className="container max-w-6xl py-8 space-y-6">
      {/* Header + New Incident CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <span>Support Desk</span>
            <span>·</span>
            <span>{showAllPortals ? 'All Portals' : tenant?.branding?.siteName || tenant?.name || 'Portal'}</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Incident Queue</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Track support incidents, warranty claims, returns, and customer questions with INC numbers and SLAs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSuperAdmin && isPlatformTenant && (
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
              <Link
                href={buildHref({ scope: undefined })}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  showAllPortals ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                All Portals
              </Link>
              <Link
                href={buildHref({ scope: 'portal' })}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  !showAllPortals ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
                }`}
              >
                Platform Only
              </Link>
            </div>
          )}
          <Link
            href={`/${locale}/dashboard/support`}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Help &amp; My Tickets
          </Link>
          <NewIncidentButton />
        </div>
      </div>

      {/* ServiceNow-style KPI Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          href={buildHref({ status: 'open', priority: undefined, unassigned: undefined })}
          className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
        >
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Open Incidents</div>
          <div className="mt-1 text-2xl font-bold text-foreground">{openCount}</div>
        </Link>
        <Link
          href={buildHref({ status: 'open', priority: 'urgent', unassigned: undefined })}
          className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-red-500/40"
        >
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Urgent / High</div>
          <div className={`mt-1 text-2xl font-bold ${urgentHighCount > 0 ? 'text-red-500' : 'text-foreground'}`}>
            {urgentHighCount}
          </div>
        </Link>
        <Link
          href={buildHref({ status: 'open', unassigned: '1', priority: undefined })}
          className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-amber-500/40"
        >
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Unassigned</div>
          <div className={`mt-1 text-2xl font-bold ${unassignedCount > 0 ? 'text-amber-500' : 'text-foreground'}`}>
            {unassignedCount}
          </div>
        </Link>
        <Link
          href={buildHref({ status: 'resolved', priority: undefined, unassigned: undefined })}
          className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-emerald-500/40"
        >
          <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground">Resolved</div>
          <div className="mt-1 text-2xl font-bold text-emerald-500">{resolvedCount}</div>
        </Link>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="space-y-3 rounded-xl border border-border bg-card/50 p-4">
        <form method="GET" action={`/${locale}/dashboard/tickets`} className="flex flex-wrap gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {priority && <input type="hidden" name="priority" value={priority} />}
          {type && <input type="hidden" name="type" value={type} />}
          {unassigned && <input type="hidden" name="unassigned" value={unassigned} />}
          {scope && <input type="hidden" name="scope" value={scope} />}
          <input
            type="search"
            name="q"
            defaultValue={q || ''}
            placeholder="Search INC-000014, subject, order #, or requester..."
            className="min-w-[240px] flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Search
          </button>
          {q && (
            <Link
              href={buildHref({ q: undefined })}
              className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
            >
              Clear
            </Link>
          )}
        </form>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            State:
          </span>
          {chip('Open', buildHref({ status: 'open' }), activeStatus === 'open')}
          {chip('All', buildHref({ status: 'all' }), activeStatus === 'all')}
          {chip('Submitted', buildHref({ status: 'submitted' }), activeStatus === 'submitted')}
          {chip('In Progress', buildHref({ status: 'reviewing' }), activeStatus === 'reviewing')}
          {chip('Approved', buildHref({ status: 'approved' }), activeStatus === 'approved')}
          {chip('Resolved', buildHref({ status: 'resolved' }), activeStatus === 'resolved')}
          {chip('Denied', buildHref({ status: 'denied' }), activeStatus === 'denied')}

          <span className="mx-1 text-border">|</span>
          {chip(
            'Unassigned',
            buildHref({ unassigned: unassigned === '1' ? undefined : '1' }),
            unassigned === '1',
          )}
          {chip(
            'Urgent',
            buildHref({ priority: priority === 'urgent' ? undefined : 'urgent' }),
            priority === 'urgent',
          )}
          {chip(
            'High',
            buildHref({ priority: priority === 'high' ? undefined : 'high' }),
            priority === 'high',
          )}

          <span className="mx-1 text-border">|</span>
          {(['support', 'question', 'warranty', 'return'] as const).map((t) =>
            chip(
              t.charAt(0).toUpperCase() + t.slice(1),
              buildHref({ type: type === t ? undefined : t }),
              type === t,
            ),
          )}
        </div>
      </div>

      {/* Incident Table */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center">
          <p className="text-sm font-medium text-foreground">No matching incidents in this view.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try switching State to &ldquo;All&rdquo; or use &ldquo;New Incident&rdquo; to log a ticket.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5">Number</th>
                <th className="px-4 py-2.5">Priority</th>
                <th className="px-4 py-2.5">State</th>
                <th className="px-4 py-2.5">Summary &amp; Requester</th>
                <th className="hidden px-4 py-2.5 md:table-cell">Assignee</th>
                <th className="px-4 py-2.5 text-right">Opened</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((t) => {
                const who =
                  typeof t.requester === 'object' && t.requester
                    ? t.requester.name || t.requester.email || 'Requester'
                    : 'Requester'
                const assigneeName =
                  typeof t.assignee === 'object' && t.assignee
                    ? t.assignee.name || t.assignee.email || 'Assigned'
                    : null
                const tenantObj = typeof t.tenant === 'object' && t.tenant ? t.tenant : null
                const portalLabel = tenantObj?.branding?.siteName || tenantObj?.name || tenantObj?.slug
                const prio = t.priority || 'normal'

                return (
                  <tr key={String(t.id)} className="group transition-colors hover:bg-muted/40">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold">
                      <Link
                        href={`/${locale}/dashboard/tickets/${t.id}`}
                        className="text-primary hover:underline"
                      >
                        {formatIncidentId(t.id)}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${TICKET_PRIORITY_BADGE[prio] ?? TICKET_PRIORITY_BADGE.normal}`}
                      >
                        {TICKET_PRIORITY_LABELS[prio] ?? prio}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${TICKET_STATUS_BADGE[t.status] ?? 'bg-muted border-border'}`}
                      >
                        {TICKET_STATUS_LABELS[t.status] ?? t.status}
                      </span>
                    </td>
                    <td className="min-w-[220px] px-4 py-3">
                      <Link href={`/${locale}/dashboard/tickets/${t.id}`} className="block">
                        <span className="block font-medium text-foreground group-hover:text-primary">
                          {t.subject}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {TICKET_TYPE_LABELS[t.type] ?? t.type} · {who}
                          {showAllPortals && portalLabel ? ` · ${portalLabel}` : ''}
                          {t.orderNumber ? ` · Order #${t.orderNumber}` : ''}
                          {Array.isArray(t.attachments) && t.attachments.length
                            ? ` · ${t.attachments.length} file${t.attachments.length === 1 ? '' : 's'}`
                            : ''}
                        </span>
                      </Link>
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-3 text-xs md:table-cell">
                      {assigneeName ? (
                        <span className="font-medium text-foreground">{assigneeName}</span>
                      ) : (
                        <span className="italic text-amber-500">Unassigned</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-muted-foreground">
                      {formatRelativeAge(t.createdAt)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
