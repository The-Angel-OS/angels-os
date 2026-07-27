import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requirePortalManager } from '@/utilities/requirePortalManager'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import { TicketStatusControls } from './TicketStatusControls'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = {
  warranty: 'Warranty claim',
  support: 'Support request',
  return: 'Return',
  question: 'Question',
}

/**
 * One ticket. The attachments are the point for a warranty claim — you cannot
 * judge a cracked belt from a description — so they render large rather than as
 * a list of filenames.
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

  // The page gate is not the data gate: requirePortalManager proves they manage
  // A portal, not THIS one. @see docs/FOOTGUNS.md §2.2
  const docTenant =
    typeof doc.tenant === 'object' && doc.tenant
      ? (doc.tenant as { id?: number | string }).id
      : doc.tenant
  if (tenantId != null && docTenant != null && String(docTenant) !== String(tenantId)) notFound()

  const requester = doc.requester as { name?: string; email?: string } | undefined
  const product = doc.product as { title?: string } | undefined
  const attachments = (doc.attachments as Array<{ file?: { url?: string; mimeType?: string; filename?: string } }>) || []

  const field = (label: string, value?: string | null) =>
    value ? (
      <div>
        <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
      </div>
    ) : null

  return (
    <div className="container max-w-4xl py-8">
      <Link
        href={`/${locale}/dashboard/tickets`}
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← All tickets
      </Link>

      <div className="mt-4 mb-6">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {TYPE_LABEL[String(doc.type)] ?? String(doc.type)} · #{String(doc.id)}
        </div>
        <h1 className="mt-1 text-2xl font-bold">{String(doc.subject)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Raised by {requester?.name || requester?.email || 'a customer'} on{' '}
          {new Date(String(doc.createdAt)).toLocaleDateString()}
        </p>
      </div>

      <TicketStatusControls
        ticketId={String(doc.id)}
        status={String(doc.status)}
        priority={String(doc.priority ?? 'normal')}
      />

      <section className="mt-6 rounded-lg border border-border p-5">
        <h2 className="mb-2 text-sm font-semibold">What they reported</h2>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {String(doc.description || '—')}
        </p>
      </section>

      {attachments.length > 0 && (
        <section className="mt-6">
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
                    // controls, no autoplay — you scrub through a fault report,
                    // you don't watch it loop.
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

      <section className="mt-6 rounded-lg border border-border p-5">
        <h2 className="mb-3 text-sm font-semibold">Purchase</h2>
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

      {(doc.resolution as string) && (
        <section className="mt-6 rounded-lg border border-border p-5">
          <h2 className="mb-2 text-sm font-semibold">Resolution</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {String(doc.resolution)}
          </p>
        </section>
      )}

      {(doc.internalNotes as string) && (
        <section className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-5">
          <h2 className="mb-2 text-sm font-semibold">Internal notes</h2>
          <p className="mb-2 text-xs text-muted-foreground">Never shown to the requester.</p>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {String(doc.internalNotes)}
          </p>
        </section>
      )}
    </div>
  )
}
