import { setRequestLocale } from 'next-intl/server'
import { getPayload } from 'payload'
import type { Where } from 'payload'
import configPromise from '@payload-config'
import { resolveTenantFromHeaders } from '@/utilities/resolveTenantFromHeaders'
import Link from 'next/link'
import { requirePortalManager } from '@/utilities/requirePortalManager'
import { resolvePageSize } from '@/utilities/pageSize'
import { ListControls } from '../_components/ListControls'
import { Pager } from '../_components/Pager'

export const dynamic = 'force-dynamic'

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'draft', label: 'Drafts' },
]

export default async function DashboardPagesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ q?: string; status?: string; page?: string; limit?: string }>
}) {
  const { locale } = await params
  const { q = '', status = 'all', page: pageParam, limit: limitParam } = await searchParams
  setRequestLocale(locale)
  await requirePortalManager()

  const payload = await getPayload({ config: configPromise })
  const { tenantFilter } = await resolveTenantFromHeaders()
  const pageSize = resolvePageSize(limitParam)
  const page = Math.max(1, Number(pageParam) || 1)

  const and: Where[] = [tenantFilter as Where]
  if (status === 'published' || status === 'draft') and.push({ _status: { equals: status } })
  if (q.trim()) and.push({ title: { like: q.trim() } })

  const pages = await payload.find({
    collection: 'pages',
    where: { and },
    limit: pageSize,
    page,
    depth: 0,
    sort: '-updatedAt',
    overrideAccess: true,
  })
  const hasFilter = !!(q || status !== 'all')

  const statusColors: Record<string, string> = {
    published: 'bg-green-500 text-white',
    draft: 'bg-yellow-500 text-black',
  }

  const prefix = locale === 'en' ? '' : `/${locale}`

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pages</h1>
          <p className="text-sm text-muted-foreground">
            {pages.totalDocs} page{pages.totalDocs !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link
          href="/admin/collections/pages/create?returnTo=/dashboard/pages&returnLabel=Pages"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          New Page
        </Link>
      </div>

      {(pages.totalDocs > 0 || hasFilter) && (
        <ListControls searchPlaceholder="Search pages…" tabParam="status" tabs={STATUS_TABS} />
      )}

      {pages.totalDocs === 0 && hasFilter ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 p-12 text-center">
          <h3 className="mb-2 text-lg font-semibold">No pages match your filters</h3>
          <p className="text-sm text-muted-foreground">Try a different search term or status.</p>
        </div>
      ) : pages.totalDocs === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 p-12 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" /></svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold">Build your site, one page at a time</h3>
          <p className="mb-6 text-sm text-muted-foreground max-w-md mx-auto">
            Pages are the building blocks of your website. Start with a homepage and add more as your site grows.
          </p>
          <div className="flex flex-col items-center gap-3">
            <Link
              href="/admin/collections/pages/create?returnTo=/dashboard/pages&returnLabel=Pages"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Create Your First Page
            </Link>
            <Link
              href="/dashboard/spaces"
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
              Ask LEO: &quot;Help me design my site layout&quot;
            </Link>
          </div>
        </div>
      ) : (
        <>
        <div className="space-y-2">
          {pages.docs.map((page: any) => {
            const status = page._status || 'draft'
            return (
              <div
                key={page.id}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted text-lg">
                  {page.slug === 'home' ? '🏠' : '📄'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold">
                      {page.title || 'Untitled'}
                    </h3>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[status] || 'bg-gray-500 text-white'}`}
                    >
                      {status}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    /{page.slug || ''}
                    {' · Updated '}
                    {new Date(page.updatedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {status === 'published' && page.slug && (
                    <Link
                      href={`${prefix}/${page.slug}`}
                      className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                    >
                      View
                    </Link>
                  )}
                  <Link
                    href={`/admin/collections/pages/${page.id}?returnTo=/dashboard/pages&returnLabel=Pages`}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
        <Pager page={pages.page || 1} totalPages={pages.totalPages} />
        </>
      )}
    </div>
  )
}
