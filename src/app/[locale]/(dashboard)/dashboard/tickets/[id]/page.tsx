import { headers } from 'next/headers'
import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { checkRole, ADMIN_ROLES } from '@/access/utilities'
import { requirePortalManager } from '@/utilities/requirePortalManager'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import {
  formatIncidentId,
  TICKET_PRIORITY_BADGE,
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_BADGE,
  TICKET_STATUS_LABELS,
  TICKET_TYPE_LABELS,
} from '@/utilities/ticketHelpers'
import { TicketStatusControls, type AssigneeOption } from './TicketStatusControls'

export const dynamic = 'force-dynamic'

/**
 * ServiceNow-Lite Incident Detail Workbench — /dashboard/tickets/[id]
 */
export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>
}) {
  const { locale, id } = await params
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })
  const { user } = await payload.auth({ headers: await headers() })
  const isSuperAdmin = Boolean(user && checkRole(ADMIN_ROLES, user))
  const { tenantId } = await resolveTenantFromHeaders()

  let doc: Record<string, unknown> | null = null
  try {
    doc = (await payload.findByID({
      collection: 'tickets',
      id,
      depth: 2,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
  } catch {
    notFound()
  }
  if (!doc) notFound()

  const docTenantObj =
    typeof doc.tenant === 'object' && doc.tenant
      ? (doc.tenant as { id?: number | string; name?: string; slug?: string; branding?: { siteName?: string } })
      : null
  const docTenantId = docTenantObj ? docTenantObj.id : doc.tenant

  // Enforce tenant boundary for non-super-admins
  if (!isSuperAdmin && tenantId != null && docTenantId != null && String(docTenantId) !== String(tenantId)) {
    notFound()
  }

  // Build assignable staff list (active tenant managers on ticket's tenant + super_admins)
  const assigneeMap = new Map<string, AssigneeOption>()
  try {
    if (docTenantId != null) {
      const members = await payload.find({
        collection: 'tenant-memberships',
        where: {
          and: [
            { tenant: { equals: docTenantId } },
            { status: { equals: 'active' } },
            { role: { in: ['tenant_admin', 'tenant_manager'] } },
          ],
        },
        limit: 50,
        depth: 1,
        overrideAccess: true,
      })
      for (const m of members.docs || []) {
        const u = (m as { user?: unknown }).user
        if (u && typeof u === 'object') {
          const uObj = u as { id?: number | string; name?: string; email?: string }
          if (uObj.id != null) {
            assigneeMap.set(String(uObj.id), {
              id: String(uObj.id),
              label: uObj.name || uObj.email || `User #${uObj.id}`,
            })
          }
        }
      }
    }
    if (isSuperAdmin && user?.id != null) {
      const uObj = user as { id: number | string; name?: string | null; email?: string | null }
      assigneeMap.set(String(uObj.id), {
        id: String(uObj.id),
        label: uObj.name || uObj.email || `Admin #${uObj.id}`,
      })
    }
  } catch {
    /* non-fatal — dropdown falls back to Unassigned / current assignee */
  }

  const requester = doc.requester as { name?: string; email?: string } | undefined
  const assigneeObj =
    typeof doc.assignee === 'object' && doc.assignee
      ? (doc.assignee as { id?: number | string; name?: string; email?: string })
      : null
  const currentAssigneeId = assigneeObj?.id != null ? String(assigneeObj.id) : doc.assignee ? String(doc.assignee) : null
  if (assigneeObj?.id != null && !assigneeMap.has(String(assigneeObj.id))) {
    assigneeMap.set(String(assigneeObj.id), {
      id: String(assigneeObj.id),
      label: assigneeObj.name || assigneeObj.email || `User #${assigneeObj.id}`,
    })
  }

  const product = doc.product as { title?: string } | undefined
  const attachments =
    (doc.attachments as Array<{ file?: { url?: string; mimeType?: string; filename?: string } }>) || []

  const showPurchase =
    doc.type === 'warranty' ||
    doc.type === 'return' ||
    Boolean(product?.title || doc.orderNumber || doc.purchaseDate || doc.sellerName)

  const field = (label: string, value?: string | null) =>
    value ? (
      <div>
        <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
      </div>
    ) : null

  const prio = String(doc.priority ?? 'normal')
  const st = String(doc.status ?? 'submitted')
  const portalName = docTenantObj?.branding?.siteName || docTenantObj?.name || docTenantObj?.slug

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/${locale}/dashboard/tickets`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Incident Queue
        </Link>
        <Link
          href={`/${locale}/dashboard/spaces`}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Discuss in Spaces ↗
        </Link>
      </div>

      {/* Incident Header */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-primary/10 px-2.5 py-0.5 font-mono text-xs font-bold text-primary">
            {formatIncidentId(doc.id as number | string)}
          </span>
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${TICKET_STATUS_BADGE[st] ?? 'bg-muted border-border'}`}
          >
            {TICKET_STATUS_LABELS[st] ?? st}
          </span>
          <span
            className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs ${TICKET_PRIORITY_BADGE[prio] ?? TICKET_PRIORITY_BADGE.normal}`}
          >
            {TICKET_PRIORITY_LABELS[prio] ?? prio}
          </span>
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {TICKET_TYPE_LABELS[String(doc.type)] ?? String(doc.type)}
            {portalName ? ` · ${portalName}` : ''}
          </span>
        </div>

        <h1 className="mt-3 text-2xl font-bold">{String(doc.subject)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Raised by <span className="font-medium text-foreground">{requester?.name || requester?.email || 'a customer'}</span>{' '}
          {requester?.email && requester?.name ? `(${requester.email}) ` : ''}
          on {new Date(String(doc.createdAt)).toLocaleString()}
        </p>
      </div>

      {/* Workbench Controls (State, Priority, Assignee, Resolution, Work Notes) */}
      <TicketStatusControls
        ticketId={String(doc.id)}
        status={st}
        priority={prio}
        assigneeId={currentAssigneeId}
        currentUserId={user?.id != null ? String(user.id) : null}
        assignees={Array.from(assigneeMap.values())}
        initialResolution={typeof doc.resolution === 'string' ? doc.resolution : ''}
        initialInternalNotes={typeof doc.internalNotes === 'string' ? doc.internalNotes : ''}
      />

      {/* Reported Incident Description */}
      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-2 text-sm font-semibold">Incident Description</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {String(doc.description || '—')}
        </p>
      </section>

      {attachments.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold">
            Evidence · {attachments.length} file{attachments.length === 1 ? '' : 's'}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {attachments.map((a, i) => {
              const f = a.file
              if (!f?.url) return null
              const isVideo = f.mimeType?.startsWith('video/')
              return (
                <div key={i} className="overflow-hidden rounded-lg border border-border bg-black">
                  {isVideo ? (
                    <video src={f.url} controls playsInline preload="metadata" className="w-full" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <a href={f.url} target="_blank" rel="noopener noreferrer">
                      <img src={f.url} alt={f.filename || 'Attachment'} className="w-full" />
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {showPurchase && (
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-3 text-sm font-semibold">Order &amp; Product Context</h2>
          <dl className="grid gap-4 sm:grid-cols-2">
            {field('Product', product?.title)}
            {field('Order number', doc.orderNumber as string)}
            {field(
              'Date of purchase',
              doc.purchaseDate ? new Date(String(doc.purchaseDate)).toLocaleDateString() : null,
            )}
            {field('Seller', doc.sellerName as string)}
          </dl>
        </section>
      )}
    </div>
  )
}
