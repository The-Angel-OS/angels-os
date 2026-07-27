import { setRequestLocale } from 'next-intl/server'
import { getPayload, type Where } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'

import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { requirePortalManager } from '@/utilities/requirePortalManager'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = {
  warranty: 'Warranty',
  support: 'Support',
  return: 'Return',
  question: 'Question',
}

const STATUS_STYLE: Record<string, string> = {
  submitted: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  reviewing: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  approved: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  denied: 'bg-red-500/15 text-red-600 dark:text-red-400',
  resolved: 'bg-muted text-muted-foreground',
}

const PRIORITY_STYLE: Record<string, string> = {
  urgent: 'text-red-600 dark:text-red-400 font-semibold',
  high: 'text-amber-600 dark:text-amber-400 font-medium',
  normal: 'text-muted-foreground',
  low: 'text-muted-foreground/70',
}

/**
 * The queue. Open tickets first, because a list sorted by date buries the thing
 * you actually have to act on under everything already dealt with.
 */
export default async function TicketsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ status?: string; type?: string }>
}) {
  const { locale } = await params
  const { status, type } = await searchParams
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })
  const { tenantFilter } = await resolveTenantFromHeaders()

  const and: Where[] = [tenantFilter as Where]
  if (status) and.push({ status: { equals: status } })
  if (type) and.push({ type: { equals: type } })

  const tickets = await payload.find({
    collection: 'tickets',
    where: { and },
    limit: 200,
    depth: 1,
    sort: '-createdAt',
    overrideAccess: true,
  })

  const rows = tickets.docs as unknown as Array<{
    id: number
    subject: string
    type: string
    status: string
    priority?: string
    orderNumber?: string
    createdAt: string
    requester?: { name?: string; email?: string } | number
    attachments?: unknown[]
  }>

  // Open work at the top. Resolved and denied are history.
  const OPEN = new Set(['submitted', 'reviewing', 'approved'])
  const open = rows.filter((t) => OPEN.has(t.status))
  const closed = rows.filter((t) => !OPEN.has(t.status))

  const chip = (label: string, href: string, active: boolean) => (
    <Link
      key={href}
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
      }`}
    >
      {label}
    </Link>
  )

  const row = (t: (typeof rows)[number]) => {
    const who =
      typeof t.requester === 'object' && t.requester
        ? t.requester.name || t.requester.email || '—'
        : '—'
    return (
      <Link
        key={t.id}
        href={`/${locale}/dashboard/tickets/${t.id}`}
        className="flex items-center gap-4 border-b border-border px-4 py-3 transition-colors hover:bg-muted/40"
      >
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[t.status] ?? 'bg-muted'}`}
        >
          {t.status}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">{t.subject}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {TYPE_LABEL[t.type] ?? t.type} · {who}
            {t.orderNumber ? ` · order ${t.orderNumber}` : ''}
            {Array.isArray(t.attachments) && t.attachments.length
              ? ` · ${t.attachments.length} attachment${t.attachments.length === 1 ? '' : 's'}`
              : ''}
          </span>
        </span>
        <span className={`shrink-0 text-xs ${PRIORITY_STYLE[t.priority ?? 'normal']}`}>
          {t.priority ?? 'normal'}
        </span>
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
          {new Date(t.createdAt).toLocaleDateString()}
        </span>
      </Link>
    )
  }

  return (
    <div className="container py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Tickets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Warranty claims, returns and support requests — one queue.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {chip('All', `/${locale}/dashboard/tickets`, !status && !type)}
        {chip('Warranty', `/${locale}/dashboard/tickets?type=warranty`, type === 'warranty')}
        {chip('Returns', `/${locale}/dashboard/tickets?type=return`, type === 'return')}
        {chip('Support', `/${locale}/dashboard/tickets?type=support`, type === 'support')}
        {chip('Submitted', `/${locale}/dashboard/tickets?status=submitted`, status === 'submitted')}
        {chip('Reviewing', `/${locale}/dashboard/tickets?status=reviewing`, status === 'reviewing')}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <p className="text-sm text-muted-foreground">Nothing here.</p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Warranty claims and support requests will appear as they come in.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          {open.length > 0 && (
            <>
              <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Open · {open.length}
              </div>
              {open.map(row)}
            </>
          )}
          {closed.length > 0 && (
            <>
              <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Closed · {closed.length}
              </div>
              {closed.map(row)}
            </>
          )}
        </div>
      )}
    </div>
  )
}
